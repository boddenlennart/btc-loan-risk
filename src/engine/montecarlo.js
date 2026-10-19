// Monte Carlo price paths in daily steps, checked against a barrier that can
// change day by day (because unpaid interest makes the debt grow).
//   model 'gbm'       : textbook model, params { mu, sigma } (yearly, same convention as barrier.js)
//   model 'bootstrap' : glues together random blocks of real past days,
//                       params { returns, lowRel, blockDays, weights?, trace? } from history.dailyReturns;
//                       weights (history.recencyWeights) make recent blocks more likely; trace (an
//                       array) collects where each drawn block starts (for the "one future" chart)
//   model 'garch'     : GARCH(1,1)-t, params from garch.fitGarchT
// Within a day, gbm and garch draw the day's low from a Brownian bridge;
// bootstrap uses the real day's low.
// Trend: by default the models keep the average trend of the data they learned
// from. With logDriftPerDay set, that trend is removed and replaced by the given
// one (the page uses this for the visible "assumed yearly price trend" input).
// The same seed always gives the same paths, and a longer horizon extends the
// same paths (so results for 6 and 12 months are directly comparable).
import { makeRng, mixSeed } from './random.js';
import { createLoanState, stepLoan } from './lender.js';

const barrierFn = (b) => (b === null || b === undefined ? () => -Infinity : typeof b === 'number' ? () => b : (d) => b[Math.min(d, b.length - 1)]);

/** Default month ends in days: about every 30.4 days, the last one exactly at `days`. */
export function defaultMonthEnds(days) {
  const ends = [];
  for (let m = 1; Math.round((m * 365.25) / 12) < days; m++) ends.push(Math.round((m * 365.25) / 12));
  ends.push(days);
  return ends;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Applies an assumed trend (log drift per day) to the model parameters, if one is given. */
function withDrift(model, params, logDriftPerDay) {
  if (logDriftPerDay === null || logDriftPerDay === undefined) return params;
  if (model === 'bootstrap') {
    // the average move as the simulation draws it: with recency weights, the weighted average (otherwise the
    // recent years, which rose less, would carry a built-in downtrend after the shift)
    const w = params.weights;
    const mean = w ? params.returns.reduce((a, r, i) => a + r * w[i], 0) / w.reduce((a, b) => a + b, 0)
      : params.returns.reduce((a, b) => a + b, 0) / params.returns.length;
    const shift = logDriftPerDay - mean;
    return { ...params, returns: params.returns.map((r) => r + shift), lowRel: params.lowRel.map((l) => l + shift) };
  }
  if (model === 'garch') return { ...params, mu: logDriftPerDay };
  if (model === 'gbm') return { ...params, mu: logDriftPerDay * 365 + (params.sigma ** 2) / 2 };
  return params;
}

// Where a block of real days starts: every position equally likely, or, with params.weights (one weight
// per day, e.g. halving every few years back in time), recent blocks more often. Cached per params object.
const pickCache = new WeakMap();
function blockPicker(params, n, block, rng) {
  const starts = n - block + 1;
  if (!params.weights) return () => Math.floor(rng.uniform() * starts);
  let cum = pickCache.get(params);
  if (!cum) {
    cum = new Float64Array(starts); let total = 0;
    for (let i = 0; i < starts; i++) { total += params.weights[i]; cum[i] = total; }
    pickCache.set(params, cum);
  }
  const total = cum[starts - 1];
  return () => {
    const u = rng.uniform() * total; let lo = 0; let hi = starts - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > u) hi = mid; else lo = mid + 1; }
    return lo;
  };
}

/** Makes a stepper: step() -> [logReturn, logLowRelativeToPreviousClose]. */
function makeStepper(model, params, rng) {
  if (model === 'gbm') {
    const dt = 1 / 365;
    const drift = (params.mu - (params.sigma ** 2) / 2) * dt;
    const sd = params.sigma * Math.sqrt(dt);
    return () => {
      const x1 = drift + sd * rng.normal();
      const low = (x1 - Math.sqrt(x1 * x1 - 2 * sd * sd * Math.log(rng.uniform()))) / 2;
      return [x1, low];
    };
  }
  if (model === 'bootstrap') {
    const { returns, lowRel } = params;
    const block = Math.max(1, Math.min(params.blockDays ?? 30, returns.length));
    const pick = blockPicker(params, returns.length, block, rng);
    let pos = 0;
    let left = 0;
    return () => {
      if (left === 0) { pos = pick(); left = block; if (params.trace) params.trace.push(pos); }
      const out = [returns[pos], Math.min(lowRel[pos], 0, returns[pos])];
      pos++; left--;
      return out;
    };
  }
  if (model === 'garch') {
    const { mu, omega, alpha, beta, nu } = params;
    let h = params.hLast ?? omega / (1 - alpha - beta);
    return () => {
      const e = Math.sqrt(h) * rng.studentT(nu);
      const x1 = mu + e;
      const low = (x1 - Math.sqrt(x1 * x1 - 2 * h * Math.log(rng.uniform()))) / 2;
      h = omega + alpha * e * e + beta * h;
      return [x1, low];
    };
  }
  if (model === 'fixed') { // for tests: every path follows the same given daily steps [[logReturn, logLowRel], ...]
    let k = 0;
    return () => params.steps[Math.min(k++, params.steps.length - 1)];
  }
  throw new Error(`unknown model ${model}`);
}

/**
 * runMonteCarlo({ model, params, s0, days, nPaths, seed, logDriftPerDay?, monthEnds?,
 *                 loan?, liquidationBarrier?, marginBarrier?, reserve?, cureDays?,
 *                 collectMinRatios?, samplePaths?, leverage? })
 *
 * Two ways to describe what ends a path:
 *  - loan: { debtByDay, collateralBtc, rules } (rules from lender.js) — the page uses
 *    this; margin calls, partial sales and reserves follow lender.js exactly.
 *  - liquidationBarrier / marginBarrier: prices (a number, or one per day). Translated
 *    into a loan with 1 unit of collateral; reserve { amount, collateralBtc } and
 *    cureDays (sell everything if a margin call is not fixed in time) as before.
 * The low during day d (from d-1 to d) is compared with the debt of day d-1.
 *
 * Returns { pLiquidation, pPartial, pMarginCall, cumulativeByMonth, fanByMonth,
 *           keptAfterSale?, minRatios?, samplePaths?, leverage? }
 *  - keptAfterSale: for paths with any forced sale, the share of the pledged BTC still
 *    yours at the end (quantiles q10, q50, q90)
 *  - samplePaths: n → the first n paths, weekly closing prices plus the day and kind of
 *    the first sale (for the "possible futures" chart)
 *  - leverage: { bought, payback, repay: 'sell' | 'cash' } → BTC held at the end
 *    compared with not borrowing (profile "buy more BTC")
 */
export function runMonteCarlo(opts) {
  const { model, s0, days, nPaths, seed = 1, collectMinRatios = false } = opts;
  const params = withDrift(model, opts.params, opts.logDriftPerDay);
  let loan = opts.loan;
  if (!loan) {
    const liq = barrierFn(opts.liquidationBarrier);
    const hasMargin = opts.marginBarrier !== null && opts.marginBarrier !== undefined;
    const ratio = hasMargin ? liq(0) / barrierFn(opts.marginBarrier)(0) : null;
    const debt = new Float64Array(days + 1).map((_, d) => liq(d));
    loan = {
      debtByDay: debt, collateralBtc: 1,
      rules: {
        mLtv: ratio, lLtv: 1, behaviour: !hasMargin ? 'none' : opts.cureDays != null ? 'liquidateAfterCure' : 'warningOnly',
        afterCure: hasMargin && opts.cureDays != null, rearm: hasMargin && opts.cureDays != null, cureSale: 'all', liquidationSale: 'all',
        target: ratio, feeValue: 0, feeBasis: 'debt',
        reserve: opts.reserve && opts.reserve.amount > 0 ? opts.reserve.amount / opts.reserve.collateralBtc : 0,
      },
    };
  }
  const { debtByDay, rules } = loan;
  const cure = opts.cureDays ?? 0;
  const monthEnds = opts.monthEnds ?? defaultMonthEnds(days);
  const nm = monthEnds.length;
  const monthIndexOfDay = new Int32Array(days + 1).fill(-1);
  monthEnds.forEach((d, i) => { monthIndexOfDay[d] = i; });
  const firstMonthForDay = new Int32Array(days + 1);
  { let m = 0; for (let d = 1; d <= days; d++) { while (monthEnds[m] < d) m++; firstMonthForDay[d] = m; } }

  const fan = new Float64Array(nm * nPaths);
  const hitsByMonth = new Float64Array(nm);
  const minRatios = collectMinRatios ? new Float64Array(nPaths) : null;
  const nSample = Math.min(opts.samplePaths || 0, nPaths);
  const samples = [];
  const lev = opts.leverage || null;
  const endBtc = lev ? new Float64Array(nPaths) : null;
  const endLiq = lev ? new Uint8Array(nPaths) : null; // 1 = this future ended in a liquidation
  const keptAfterSale = []; // share of the pledged BTC still yours at the end, for paths with any forced sale
  let liquidated = 0; let partial = 0; let marginCalls = 0;
  let levMore = 0; let levLessKept = 0;

  for (let p = 0; p < nPaths; p++) {
    const rng = makeRng(mixSeed(seed, p));
    const step = makeStepper(model, params, rng);
    const st = createLoanState(loan.collateralBtc);
    let logS = Math.log(s0);
    let minLog = logS;
    const weekly = p < nSample ? [s0] : null;
    let event = null;
    for (let d = 1; d <= days; d++) {
      const [ret, lowRel] = step();
      const lowLog = logS + lowRel;
      logS += ret;
      if (lowLog < minLog) minLog = lowLog;
      if (!st.liquidation) {
        const nPartial = st.partialSales.length;
        stepLoan(st, rules, { time: d, low: Math.exp(lowLog), close: Math.exp(logS), debt: debtByDay[d - 1], cure });
        if (st.liquidation) {
          hitsByMonth[firstMonthForDay[d]]++;
          if (weekly && !event) event = { day: d, kind: st.liquidation.reason };
        } else if (weekly && !event && st.partialSales.length > nPartial) event = { day: d, kind: 'partial' };
      }
      const mi = monthIndexOfDay[d];
      if (mi >= 0) fan[mi * nPaths + p] = Math.exp(logS);
      if (weekly && (d % 7 === 0 || d === days)) weekly.push(Math.exp(logS));
    }
    if (st.liquidation) liquidated++;
    else if (st.partialSales.length) partial++;
    if (st.liquidation || st.partialSales.length) keptAfterSale.push((st.liquidation ? st.liquidation.btcReturned : st.c) / loan.collateralBtc);
    if (st.firstMargin) marginCalls++;
    if (minRatios) minRatios[p] = Math.exp(minLog) / s0;
    if (weekly) samples.push({ weekly, event, liquidated: !!st.liquidation, partial: !st.liquidation && st.partialSales.length > 0 });
    if (lev) {
      // BTC at the end: collateral left (or returned after a liquidation) + bought BTC
      // − BTC sold at the end to repay (only when repaying by selling)
      const endPrice = Math.exp(logS);
      const repaySell = !st.liquidation && lev.repay === 'sell' ? (lev.payback * st.scale) / endPrice : 0;
      const held = (st.liquidation ? st.liquidation.btcReturned : st.c) + lev.bought - repaySell;
      endBtc[p] = held; endLiq[p] = st.liquidation ? 1 : 0;
      if (!st.liquidation) { if (held > loan.collateralBtc) levMore++; else levLessKept++; }
    }
  }

  const cumulativeByMonth = [];
  let acc = 0;
  for (let m = 0; m < nm; m++) { acc += hitsByMonth[m]; cumulativeByMonth.push(acc / nPaths); }
  const fanByMonth = [];
  for (let m = 0; m < nm; m++) {
    const srt = fan.subarray(m * nPaths, (m + 1) * nPaths).slice().sort();
    fanByMonth.push({ month: m + 1, day: monthEnds[m], q05: quantile(srt, 0.05), q25: quantile(srt, 0.25), q50: quantile(srt, 0.5), q75: quantile(srt, 0.75), q95: quantile(srt, 0.95) });
  }
  const out = {
    pLiquidation: liquidated / nPaths, pPartial: partial / nPaths,
    pMarginCall: rules.mLtv ? marginCalls / nPaths : null, cumulativeByMonth, fanByMonth,
  };
  if (keptAfterSale.length) {
    const srt = Float64Array.from(keptAfterSale).sort();
    out.keptAfterSale = { q10: quantile(srt, 0.1), q50: quantile(srt, 0.5), q90: quantile(srt, 0.9) };
  }
  if (minRatios) out.minRatios = Array.from(minRatios);
  if (nSample) out.samplePaths = samples;
  if (lev) {
    const srt = endBtc.slice().sort();
    // how big each outcome is: the middle value of each group, in BTC compared with not borrowing
    const groups = { more: [], lessKept: [], liquidated: [] };
    for (let p = 0; p < nPaths; p++) {
      const diff = endBtc[p] - loan.collateralBtc;
      groups[endLiq[p] ? 'liquidated' : diff > 0 ? 'more' : 'lessKept'].push(diff);
    }
    const middle = (a) => (a.length ? quantile(Float64Array.from(a).sort(), 0.5) : null);
    out.leverage = {
      more: levMore / nPaths, lessKept: levLessKept / nPaths, liquidated: liquidated / nPaths,
      endBtc: { q05: quantile(srt, 0.05), q50: quantile(srt, 0.5), q95: quantile(srt, 0.95) },
      middleDiff: { more: middle(groups.more), lessKept: middle(groups.lessKept), liquidated: middle(groups.liquidated) },
    };
  }
  return out;
}
