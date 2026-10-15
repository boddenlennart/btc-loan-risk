// Computes the real numbers shown in the Phase B sketches (test offer from A2,
// BTC price fixed at 72,066 EUR). Uses the page's own engine; writes numbers.json.
// Usage: node ux/sketches/compute-numbers.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'fflate';
import { decodeHourly } from '../../src/data/codec.js';
import { dailyFromHourly, dailyReturns } from '../../src/engine/history.js';
import { fitGarchT } from '../../src/engine/garch.js';
import { runMonteCarlo } from '../../src/engine/montecarlo.js';
import { replayAll, replayOne } from '../../src/engine/replay.js';
import { makeRng, mixSeed } from '../../src/engine/random.js';
import * as L from '../../src/engine/loan.js';

const hourly = decodeHourly(gunzipSync(readFileSync(new URL('../../data/btc-eur-1h.bin.gz', import.meta.url))));
const daily = dailyFromHourly(hourly);
const { returns, lowRel } = dailyReturns(daily);
const garch = fitGarchT(returns);
const P0 = 72066;
const base = {
  currency: 'EUR', btcPrice: P0, loanAmount: 15000, startDate: '2026-11-01', durationMonths: 12, initialLtv: 0.5,
  marginCallLtv: 0.7, liquidationLtv: 0.83, rate: { type: 'fixed', annual: 0.115 }, repayment: 'bullet', compounding: 'monthly',
  dayCount: '30/360', originationFee: { type: 'percent', value: 0.015 }, liquidationFee: { value: 0.04, basis: 'debt' },
  earlyRepaymentFee: 0, curePeriodHours: 48, marginCallConsequence: 'liquidateAfterCure', reserveAmount: 0,
};
const boot = { returns, lowRel, blockDays: 30 };
function mc(t, { model = 'bootstrap', nPaths = 10000, reserve = 0 } = {}) {
  const m = L.marginCallPrices(t);
  const ends = Array.from({ length: t.durationMonths }, (_, i) => L.daysBetween(t.startDate, L.addMonths(t.startDate, i + 1)));
  return runMonteCarlo({
    model, params: model === 'bootstrap' ? boot : garch, s0: t.btcPrice, days: L.loanDays(t), nPaths, seed: 20240101,
    liquidationBarrier: L.liquidationPrices(t).byDay, marginBarrier: m ? m.byDay : null, monthEnds: ends, logDriftPerDay: 0,
    cureDays: t.marginCallConsequence === 'liquidateAfterCure' && m ? Math.ceil(t.curePeriodHours / 24) : null,
    reserve: reserve ? { amount: reserve, collateralBtc: L.collateralBtc(t) } : null,
  });
}
const r = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const out = { P0 };
const head = mc(base); const g = mc(base, { model: 'garch' });
out.fan = head.fanByMonth;
out.headline = { p: head.pLiquidation, pMargin: head.pMarginCall, garch: g.pLiquidation, byMonth: head.cumulativeByMonth.map((x) => r(x)) };
const s = L.loanSummary(base); const lp = L.liquidationPrices(base); const mp = L.marginCallPrices(base);
out.loan = { collateral: L.collateralBtc(base), received: s.amountReceived, payback: s.totalPayback, cost: s.totalCost, interest: s.totalInterest, apr: s.effectiveApr,
  liqStart: lp.atStart, liqEnd: lp.atMaturity, mcStart: mp.atStart, drop: L.dropToLiquidation(base),
  topUp: L.topUpToCure(base, { price: mp.atStart, debt: 15000, targetLtv: 0.5 }), lost: L.costIfLiquidated(base, { price: lp.atStart, debt: 15000 }),
  breakeven: L.breakevenReturn(base, {}) };
out.slider = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map((ltv) => {
  const t = { ...base, initialLtv: ltv, marginCallLtv: ltv < 0.7 ? 0.7 : null };
  return { ltv, p: mc(t, { nPaths: 4000 }).pLiquidation, liq: L.liquidationPrices(t).atStart, btc: L.collateralBtc(t) };
});
const lever = (label, t, o = {}) => ({ label, p: mc(t, { nPaths: 10000, ...o }).pLiquidation });
out.levers = [
  lever('as offered', base),
  lever('starting LTV 40%', { ...base, initialLtv: 0.4 }),
  lever('starting LTV 30%', { ...base, initialLtv: 0.3 }),
  lever('liquidation LTV 90%', { ...base, liquidationLtv: 0.9 }),
  lever('liquidation LTV 95%', { ...base, liquidationLtv: 0.95 }),
  lever('6 months instead of 12', { ...base, durationMonths: 6 }),
  lever('keep 3,000 ready for a margin call', { ...base, reserveAmount: 3000 }, { reserve: 3000 }),
  lever('lender only warns at margin call (no sale after 48 h)', { ...base, marginCallConsequence: 'warningOnly' }),
  lever('liquidation LTV 90% AND margin call only a warning', { ...base, liquidationLtv: 0.9, marginCallConsequence: 'warningOnly' }),
  lever('liquidation LTV 95% AND margin call only a warning', { ...base, liquidationLtv: 0.95, marginCallConsequence: 'warningOnly' }),
  lever('interest paid monthly instead of added', { ...base, repayment: 'interestOnly', compounding: 'none' }),
];
const rp = replayAll(hourly, base);
out.replay = { share: rp.liquidatedShare, starts: rp.starts, marginShare: rp.marginCallShare };
// history stories: real paths after chosen start dates (monthly closes, relative to start)
const story = (iso) => {
  const t0 = Date.parse(iso) / 1000; const res = replayOne(hourly, { ...base, startDate: iso.slice(0, 10) }, t0);
  const i0 = daily.time.indexOf(t0); const path = [];
  for (let d = 0; d <= 365; d += 7) path.push(r(Math.min(...daily.low.slice(i0 + Math.max(0, d - 7), i0 + d + 1)) / daily.open[i0], 4));
  return { start: iso.slice(0, 10), liquidatedAfterDays: res.liquidation ? Math.round((res.liquidation.time - t0) / 86400) : null, reason: res.liquidation?.reason ?? null, marginAfterDays: res.marginCall ? Math.round((res.marginCall.time - t0) / 86400) : null, weeklyLowRel: path, endRel: r(daily.close[i0 + 365] / daily.open[i0], 3) };
};
out.stories = ['2017-12-17T00:00Z', '2021-11-10T00:00Z', '2020-02-13T00:00Z', '2023-01-01T00:00Z'].map(story);
// 20 sample paths (daily) from the same bootstrap the headline uses, trend removed like on the page
const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
const days = L.loanDays(base); const liqByDay = lp.byDay; const mcByDay = mp.byDay; const cureDays = Math.ceil(base.curePeriodHours / 24);
function path(p) {
  const rng = makeRng(mixSeed(20240101, p)); let pos = 0, left = 0, logS = Math.log(P0); const pts = [P0]; let hitDay = null; let deadline = -1;
  for (let d = 1; d <= days; d++) {
    if (left === 0) { pos = Math.floor(rng.uniform() * (returns.length - 30 + 1)); left = 30; }
    const ret = returns[pos] - mean; const lowR = Math.min(lowRel[pos] - mean, 0, ret); pos++; left--;
    const low = Math.exp(logS + lowR); logS += ret;
    // same rules as the engine: liquidation LTV, or margin call not fixed within the cure period (sale after 48 h)
    if (hitDay === null) {
      if (low <= liqByDay[d - 1]) hitDay = d;
      else if (deadline >= 0 && d >= deadline && Math.exp(logS) <= mcByDay[d - 1]) hitDay = d;
      else { if (deadline >= 0 && d >= deadline) deadline = -1; if (deadline < 0 && low <= mcByDay[d - 1]) deadline = d + cureDays; }
    }
    if (d % 7 === 0 || d === days) pts.push(Math.round(Math.exp(logS)));
  }
  return { pts, hitDay, end: Math.exp(logS) };
}
out.samplePaths = Array.from({ length: 20 }, (_, p) => path(p));
// leverage result counted in BTC (profile C), repay by selling BTC at the end; uses the same replicated paths (sketch)
const c = L.collateralBtc(base); const bought = s.amountReceived / P0; const f = base.liquidationFee.value;
let better = 0, worseNoLiq = 0, liq = 0; const N = 10000;
for (let p = 0; p < N; p++) {
  const { hitDay, end } = path(p);
  if (hitDay !== null) liq++;
  else if (c + bought - s.totalPayback / end > c) better++; else worseNoLiq++;
}
out.leverage = { bought, collateral: c, better: better / N, worseNoLiq: worseNoLiq / N, liquidated: liq / N, endBtcIfLiquidated: bought + c * (1 - base.liquidationLtv * (1 + f)), breakevenRise: s.totalPayback / s.amountReceived - 1 };
// trend side by side (profile C): +20 %/year
const tr = (g) => runMonteCarlo({ model: 'bootstrap', params: boot, s0: P0, days, nPaths: 10000, seed: 20240101, liquidationBarrier: liqByDay, marginBarrier: mcByDay, cureDays, logDriftPerDay: Math.log(1 + g) / 365 }).pLiquidation;
out.trend0 = tr(0); out.trend20 = tr(0.2); out.trend50 = tr(0.5);
writeFileSync(new URL('./numbers.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ headline: out.headline, loan: { ...out.loan, topUp: out.loan.topUp, lost: out.loan.lost }, levers: out.levers, replay: out.replay, leverage: out.leverage, trend0: out.trend0, trend20: out.trend20, trend50: out.trend50, stories: out.stories.map((x) => ({ start: x.start, liq: x.liquidatedAfterDays, reason: x.reason, end: x.endRel })), liquidatedSamples: out.samplePaths.filter((x) => x.hitDay).length, slider: out.slider.map((x) => [x.ltv, r(x.p)]) }, null, 1));
