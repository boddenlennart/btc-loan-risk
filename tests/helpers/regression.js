// Regression safety net: reference loans that together use every main function, and
// one function that computes all their results. Used by
//   tests/regression.test.js  (frozen data: results must equal the stored golden file)
//   tests/current-data.test.js (newest data: results must be valid)
//   tools/update-golden.mjs   (writes the golden file, only when a change is intended)
//   tools/update-data.mjs     (drift guard: a week of new data may not move results much)
import { gzipSync } from 'node:zlib';
import { encodeHourly } from '../../src/data/codec.js';
import { dailyFromHourly, dailyReturns } from '../../src/engine/history.js';
import { fitGarchT } from '../../src/engine/garch.js';
import {
  loanSummary, collateralBtc, liquidationPrices, marginCallPrices, dropToLiquidation, topUpToCure, costIfLiquidated, breakevenReturn,
} from '../../src/engine/loan.js';
import { lenderRules } from '../../src/engine/lender.js';
import { validateTerms } from '../../src/engine/validate.js';

// History used for the golden results ends here and therefore never changes.
export const FROZEN_END = Date.parse('2026-10-01T00:00Z') / 1000;

const base = {
  btcPrice: 60000, loanAmount: 15000, startDate: '2026-10-01', durationMonths: 12, initialLtv: 0.5, marginCallLtv: 0.7,
  liquidationLtv: 0.8, rate: { type: 'fixed', annual: 0.1 }, repayment: 'interestOnly', compounding: 'none', dayCount: '30/360',
  originationFee: { type: 'percent', value: 0.01 }, liquidationFee: { value: 0.05, basis: 'debt' }, earlyRepaymentFee: 0,
  curePeriodHours: 48, marginCallConsequence: 'warningOnly', liquidationSale: 'all', cureTargetLtv: null, reserveAmount: 0,
  taxRateNow: 0, taxRateAtMaturity: 0, purpose: 'spend', repayWith: 'sell', mode: 'new',
};
const settings = { nPaths: 2000, blockDays: 30, trend: 0 };

/** Each loan exercises different parts of the engine (named in `uses`). */
export const REFERENCE_LOANS = [
  { id: 'example-eur', currency: 'EUR', uses: 'interest monthly, margin call as warning, five price trends compared', terms: {} },
  { id: 'test-offer-eur', currency: 'EUR', uses: 'added interest with compounding, sale after 48 h, fees', terms: { initialLtv: 0.5, liquidationLtv: 0.83, rate: { type: 'fixed', annual: 0.115 }, repayment: 'bullet', compounding: 'monthly', originationFee: { type: 'percent', value: 0.015 }, liquidationFee: { value: 0.04, basis: 'debt' }, marginCallConsequence: 'liquidateAfterCure' } },
  { id: 'amortizing-usd', currency: 'USD', uses: 'equal payments, 36 months, fixed fee', terms: { durationMonths: 36, repayment: 'amortizing', rate: { type: 'fixed', annual: 0.0725 }, originationFee: { type: 'fixed', value: 250 }, initialLtv: 0.35 } },
  { id: 'variable-rate-usd', currency: 'USD', uses: 'variable rate path, actual days / 365', terms: { rate: { type: 'variable', path: [{ fromMonth: 0, annual: 0.08 }, { fromMonth: 6, annual: 0.12 }] }, dayCount: 'act/365' } },
  { id: 'auto-partial-eur', currency: 'EUR', uses: 'lender sells part at the margin call', terms: { marginCallConsequence: 'autoPartial' } },
  { id: 'partial-everywhere-usd', currency: 'USD', uses: 'partial sale after the deadline and at liquidation, fee on BTC sold, target 45%', terms: { marginCallConsequence: 'partialAfterCure', liquidationSale: 'partial', liquidationFee: { value: 0.02, basis: 'collateralSold' }, cureTargetLtv: 0.45 } },
  { id: 'no-margin-call-eur', currency: 'EUR', uses: 'no margin call, liquidation at 95%', terms: { marginCallLtv: null, liquidationLtv: 0.95 } },
  { id: 'reserve-eur', currency: 'EUR', uses: 'cash reserve added at the margin call, sale after 72 h', terms: { reserveAmount: 3000, marginCallConsequence: 'liquidateAfterCure', curePeriodHours: 72 } },
  { id: 'existing-loan-eur', currency: 'EUR', uses: 'existing loan: LTV from BTC pledged, already above margin call', terms: { mode: 'existing', collateralInput: 0.34, initialLtv: 15000 / (0.34 * 60000), originationFee: { type: 'percent', value: 0 }, cureTargetLtv: 0.5, marginCallConsequence: 'liquidateAfterCure' } },
  { id: 'buy-btc-sell-usd', currency: 'USD', uses: 'buy more BTC, repay by selling, result counted in BTC', terms: { purpose: 'buy', repayWith: 'sell', initialLtv: 0.4 } },
  { id: 'buy-btc-cash-eur', currency: 'EUR', uses: 'buy more BTC, repay with new money, 24 months', terms: { purpose: 'buy', repayWith: 'cash', durationMonths: 24, initialLtv: 0.3 } },
  { id: 'taxes-short-usd', currency: 'USD', uses: '6 months, taxes in the borrow-or-sell comparison', terms: { durationMonths: 6, taxRateNow: 0.25, taxRateAtMaturity: 0 } },
];

export const loanTerms = (ref) => ({ ...base, ...ref.terms, currency: ref.currency });
export const loanSettings = (ref) => ({ ...settings, ...(ref.settings || {}) });

/** Keeps only the hours before `end`. */
export function sliceHourly(h, end) {
  let n = h.time.length;
  while (n > 0 && h.time[n - 1] >= end) n--;
  const cut = (k) => h[k].subarray(0, n);
  return { time: cut('time'), open: cut('open'), high: cut('high'), low: cut('low'), close: cut('close'), noTrade: cut('noTrade') };
}

/** Hourly arrays → the base64 text the page embeds. */
export function toBase64(h) {
  const rows = Array.from({ length: h.time.length }, (_, i) => ({ time: h.time[i], open: h.open[i], high: h.high[i], low: h.low[i], close: h.close[i], volume: h.noTrade[i] ? 0 : 1 }));
  return gzipSync(encodeHourly(rows)).toString('base64');
}

export const fitGarch = (h) => fitGarchT(dailyReturns(dailyFromHourly(h)).returns);

const r = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1e9) / 1e9 : x);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => r(v)));

/** All main results for one reference loan. `job` = { setData, run } from riskjob.js, already loaded with data. */
export async function resultsFor(ref, job, garch) {
  const t = loanTerms(ref);
  const v = validateTerms(t);
  if (!v.ok) throw new Error(`${ref.id}: invalid reference terms ${JSON.stringify(v.errors)}`);
  const s = loanSummary(t); const lp = liquidationPrices(t); const mp = marginCallPrices(t); const rules = lenderRules(t);
  const loan = {
    collateralBtc: collateralBtc(t), amountReceived: s.amountReceived, totalInterest: s.totalInterest, totalPayback: s.totalPayback,
    totalCost: s.totalCost, effectiveApr: s.effectiveApr, payments: s.schedule.map((x) => x.payment),
    liquidation: [lp.atStart, lp.atMaturity], marginCall: mp ? [mp.atStart, mp.atMaturity] : null, drop: dropToLiquidation(t),
    topUp: mp ? topUpToCure(t, { price: mp.atStart, debt: t.loanAmount, targetLtv: rules.target }) : null,
    ifLiquidated: costIfLiquidated(t, { price: lp.atStart, debt: t.loanAmount }),
    breakeven: breakevenReturn(t, { taxRateNow: t.taxRateNow, taxRateAtMaturity: t.taxRateAtMaturity }),
  };
  const res = await job.run(0, t, loanSettings(ref), garch, () => {});
  // every point a chart draws is a finite number, and the real years start at today's price
  // (a chart once started every line at infinity: ux/N-uat-report.md, finding 2)
  const points = [...res.stories.flatMap((x) => x.weekly), ...(res.main.samplePaths || []).flatMap((x) => x.weekly), ...res.main.fanByMonth.flatMap((f) => [f.q05, f.q25, f.q50, f.q75, f.q95])];
  if (points.some((x) => !Number.isFinite(x))) throw new Error(`${ref.id}: a chart point is not a finite number`);
  if (res.stories.some((x) => x.weekly[0] !== 1)) throw new Error(`${ref.id}: a real year does not start at today's price`);
  const m = res.main;
  const risk = {
    pLiquidation: m.pLiquidation, pPartial: m.pPartial, pMarginCall: m.pMarginCall, cumulativeByMonth: m.cumulativeByMonth,
    fanLastMonth: m.fanByMonth.at(-1), keptAfterSale: m.keptAfterSale ?? null, leverage: m.leverage ?? null, riskCost: m.riskCost ?? null,
    samplePaths: { count: m.samplePaths.length, sold: m.samplePaths.filter((p) => p.event).length, firstEvent: m.samplePaths.find((p) => p.event)?.event ?? null },
    trends: res.trends,
    garch: { pLiquidation: res.garchMc.pLiquidation, pPartial: res.garchMc.pPartial },
    replay: { starts: res.replay.starts, liquidatedShare: res.replay.liquidatedShare, partialShare: res.replay.partialShare, marginCallShare: res.replay.marginCallShare, worst: res.replay.worst, reserve: res.replay.reserveBtcNeeded },
    stories: res.stories.map((x) => ({ start: x.start, sale: x.sale, btcLeft: x.btcLeft, endRel: x.endRel })),
    barrier: res.barrier, levers: res.levers, leverBase: res.leverBase, slider: res.slider,
  };
  return round({ id: ref.id, uses: ref.uses, loan, risk, facts: res.facts });
}
