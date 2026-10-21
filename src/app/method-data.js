// The numbers behind "How it works", computed by the build (tools/build.mjs) on the example loan and the
// embedded history, so every figure on that page is current after each weekly data update.
// Uses exactly the page's own calculation (runMonteCarlo, the lender rules, the replay).
import { runMonteCarlo } from '../engine/montecarlo.js';
import { dailyFromHourly, dailyReturns, recencyWeights } from '../engine/history.js';
import { debtByDay, collateralBtc, loanDays, liquidationPrices, marginCallPrices } from '../engine/loan.js';
import { lenderRules, repaidShare } from '../engine/lender.js';
import { riskCostTextbook } from '../engine/barrier.js';
import { replayOne } from '../engine/replay.js';

const year = (t) => new Date(t * 1000).getUTCFullYear();
const volOf = (r, w) => {
  const W = w ? w.reduce((a, b) => a + b, 0) : r.length;
  const m = r.reduce((a, x, i) => a + x * (w ? w[i] : 1), 0) / W;
  return Math.sqrt((r.reduce((a, x, i) => a + (w ? w[i] : 1) * (x - m) ** 2, 0) / W) * 365);
};

/**
 * hourly: the example currency's embedded history; terms: the example loan (engine terms, with btcPrice);
 * garch: the fitted model; settings: { nPaths, blockDays }; halfLifeYears: the page's weighting.
 */
export function methodData({ hourly, terms, garch, settings, halfLifeYears }) {
  const daily = dailyFromHourly(hourly);
  const { returns, lowRel } = dailyReturns(daily);
  const n = returns.length; const H = halfLifeYears * 365;
  const weights = recencyWeights(n, H);
  const W = weights.reduce((a, b) => a + b, 0);
  const days = loanDays(terms);
  const loan = (t = terms) => ({ debtByDay: debtByDay(t), collateralBtc: collateralBtc(t), rules: lenderRules(t) });
  const sim = (params, o = {}) => runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: settings.blockDays, ...params }, s0: terms.btcPrice, days, nPaths: settings.nPaths,
    seed: 20240101, logDriftPerDay: 0, loan: loan(), cureDays: Math.max(1, Math.ceil((terms.curePeriodHours ?? 0) / 24)), ...o });

  // volatility per calendar year, and how much each year counts in the draws
  const byYear = new Map();
  returns.forEach((r, i) => { const y = year(daily.time[i + 1]); if (!byYear.has(y)) byYear.set(y, { r: [], w: 0 }); const b = byYear.get(y); b.r.push(r); b.w += weights[i]; });
  const volByYear = [...byYear].map(([y, b]) => ({ year: y, vol: volOf(b.r), weight: b.w / W, days: b.r.length }));

  // the same loan with the years weighted differently (the page uses halfLifeYears)
  const since2022 = daily.time.findIndex((t) => t >= Date.UTC(2022, 0, 1) / 1000) - 1;
  const recent = { returns: returns.slice(since2022), lowRel: lowRel.slice(since2022) };
  const weighting = [
    { id: 'equal', vol: volOf(returns), p: sim({}).pLiquidation },
    ...[4, 3, 2].map((y) => { const w = recencyWeights(n, y * 365); return { id: `half${y}`, halfLifeYears: y, current: y === halfLifeYears, vol: volOf(returns, w), p: sim({ weights: w }).pLiquidation }; }),
    { id: 'since2022', vol: volOf(recent.returns), p: sim(recent).pLiquidation },
  ];
  const main = weighting.find((x) => x.current);

  // one simulated future: a path that is liquidated after month 3, with the dates its 30-day pieces came from
  const sample = sim({ weights }, { samplePaths: 60, riskCost: true });
  let k = sample.samplePaths.findIndex((p) => p.liquidated && p.event.kind !== 'partial' && p.event.day >= 90 && p.event.day <= 270);
  if (k < 0) k = sample.samplePaths.findIndex((p) => p.liquidated);
  let onePath = null;
  if (k >= 0) {
    const trace = [];
    sim({ weights, trace }, { nPaths: k + 1 });
    const perPath = Math.ceil(days / settings.blockDays);
    const lp = liquidationPrices(terms); const mp = marginCallPrices(terms);
    onePath = {
      weekly: sample.samplePaths[k].weekly, event: sample.samplePaths[k].event, days, liq: [lp.atStart, lp.atMaturity], mc: mp ? [mp.atStart, mp.atMaturity] : null,
      pieces: trace.slice(k * perPath, (k + 1) * perPath).map((pos, j) => ({ fromDay: j * settings.blockDays, origin: daily.time[pos + 1] })),
    };
  }

  // the cost of the risk (ux/M-risk-cost-spec.md) on the example, the one future above worked through,
  // and the textbook option formula with the same volatility (smooth prices, sold at the liquidation price)
  const rc = sample.riskCost; const kRepaid = repaidShare(lenderRules(terms));
  // worked through: a future in which BTC recovered after a full sale, so the missed rise shows
  let riskOne = null;
  const kOne = sample.samplePaths.findIndex((p) => p.liquidated && p.sales.length === 1 && p.weekly.at(-1) * rc.scale > p.sales[0][1]);
  if (kOne >= 0) {
    const sp = sample.samplePaths[kOne]; const end = sp.weekly.at(-1) * rc.scale;
    const [btc, price] = sp.sales[0];
    const repaid = kRepaid * btc; const fee = (1 - kRepaid) * btc;
    riskOne = { day: sp.event.day, price, repaid, fee, end, missed: repaid * Math.max(0, end - price), feeValue: fee * end, total: sp.sales.reduce((a, [b, p]) => a + kRepaid * b * Math.max(0, end - p) + (1 - kRepaid) * b * end, 0) };
  }
  const risk = { value: rc.value, se: rc.se, noSale: rc.noSale, up: 1 / rc.scale - 1, one: riskOne, soldQ50: rc.soldQ50, soldQ90: rc.soldQ90, nPaths: settings.nPaths,
    textbook: riskCostTextbook({ s0: terms.btcPrice, debt: terms.loanAmount, liquidationPrice: liquidationPrices(terms).atStart, repaidShare: kRepaid, sigma: weighting.find((x) => x.current).vol, years: days / 365 }) };

  // the margin-call deadline in whole days, and without any margin call
  const deadline = [1, 2, 3].map((d) => ({ days: d, p: sim({ weights }, { cureDays: d }).pLiquidation }));
  const noMc = { ...terms, marginCallLtv: null };
  const noMarginCall = sim({ weights }, { loan: loan(noMc) }).pLiquidation;

  // real liquidation hours: how far below the liquidation price the hour's lowest price was
  const gaps = [];
  for (let i = 0; i < hourly.time.length - (days + 2) * 24; i += 24 * 7) {
    if (hourly.time[i] % 86400) continue;
    const r = replayOne(hourly, { ...terms, btcPrice: 1 }, hourly.time[i]);
    if (r.liquidation && r.liquidation.reason === 'liquidationLtv') gaps.push(1 - r.liquidation.low / r.liquidation.price);
  }
  gaps.sort((a, b) => a - b);
  const q = (x) => (gaps.length ? gaps[Math.floor(x * (gaps.length - 1))] : null);

  const pre2019 = weights.slice(0, daily.time.findIndex((t) => t >= Date.UTC(2019, 0, 1) / 1000) - 1).reduce((a, b) => a + b, 0) / W;
  // the number as the check page shows it: rounded so that the 100 dots add up (largest remainder)
  const m = sample; const marginOnly = m.pMarginCall === null ? 0 : Math.max(0, m.pMarginCall - m.pLiquidation - m.pPartial);
  const parts = [m.pLiquidation, m.pPartial, marginOnly, 1 - m.pLiquidation - m.pPartial - marginOnly].map((x) => Math.max(0, x) * 100);
  const fl = parts.map(Math.floor); let rest = 100 - fl.reduce((a, b) => a + b, 0);
  parts.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return {
    halfLifeYears, shown: fl[0], nPaths: settings.nPaths, blockDays: settings.blockDays, days: n, from: daily.time[0], to: daily.time.at(-1),
    volByYear, simVol: main.vol, allVol: weighting[0].vol, sharePre2019: pre2019,
    garch: { alpha: garch.alpha, beta: garch.beta, nu: garch.nu, todayVol: Math.sqrt(garch.hLast * 365) },
    weighting, p: main.p, se: Math.sqrt((main.p * (1 - main.p)) / settings.nPaths),
    onePath, deadline, noMarginCall, risk, gap: { n: gaps.length, median: q(0.5), p90: q(0.9), worst: q(1) },
  };
}
