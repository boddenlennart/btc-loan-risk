// Monte Carlo price paths in daily steps, checked against a barrier that can
// change day by day (because unpaid interest makes the debt grow).
//   model 'gbm'       : textbook model, params { mu, sigma } (yearly, same convention as barrier.js)
//   model 'bootstrap' : glues together random blocks of real past days,
//                       params { returns, lowRel, blockDays } from history.dailyReturns
//   model 'garch'     : GARCH(1,1)-t, params from garch.fitGarchT
// Within a day, gbm and garch draw the day's low from a Brownian bridge;
// bootstrap uses the real day's low.
// Trend: by default the models keep the average trend of the data they learned
// from. With logDriftPerDay set, that trend is removed and replaced by the given
// one (the page uses this for the visible "assumed yearly price trend" input).
// The same seed always gives the same paths, and a longer horizon extends the
// same paths (so results for 6 and 12 months are directly comparable).
import { makeRng, mixSeed } from './random.js';

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
    const mean = params.returns.reduce((a, b) => a + b, 0) / params.returns.length;
    const shift = logDriftPerDay - mean;
    return { ...params, returns: params.returns.map((r) => r + shift), lowRel: params.lowRel.map((l) => l + shift) };
  }
  if (model === 'garch') return { ...params, mu: logDriftPerDay };
  if (model === 'gbm') return { ...params, mu: logDriftPerDay * 365 + (params.sigma ** 2) / 2 };
  return params;
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
    let pos = 0;
    let left = 0;
    return () => {
      if (left === 0) { pos = Math.floor(rng.uniform() * (returns.length - block + 1)); left = block; }
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
  throw new Error(`unknown model ${model}`);
}

/**
 * runMonteCarlo({ model, params, s0, days, nPaths, seed,
 *                 liquidationBarrier, marginBarrier?, collectMinRatios?, monthEnds?,
 *                 reserve?: { amount, collateralBtc }, cureDays?, logDriftPerDay? })
 * Barriers are a number or an array with one price per day (0..days); the low
 * during day d (from d to d+1) is compared with the barrier of day d.
 * With a reserve, the money is added as extra BTC at the margin-call price the
 * first time a margin call happens, which lowers the liquidation barrier.
 * With cureDays (lender liquidates when a margin call is not fixed in time):
 * if the closing price is still at or below the margin-call level cureDays
 * after the call, the path counts as liquidated on that day.
 * Returns { pLiquidation, pMarginCall, cumulativeByMonth: [...],
 *           fanByMonth: [{ month, q05, q25, q50, q75, q95 }], minRatios? }
 */
export function runMonteCarlo(opts) {
  const { model, s0, days, nPaths, seed = 1, collectMinRatios = false } = opts;
  const params = withDrift(model, opts.params, opts.logDriftPerDay);
  const liq = barrierFn(opts.liquidationBarrier);
  const mc = barrierFn(opts.marginBarrier);
  const hasMargin = opts.marginBarrier !== null && opts.marginBarrier !== undefined;
  const monthEnds = opts.monthEnds ?? defaultMonthEnds(days);
  const nm = monthEnds.length;
  const monthIndexOfDay = new Int32Array(days + 1).fill(-1);
  monthEnds.forEach((d, i) => { monthIndexOfDay[d] = i; });
  const firstMonthForDay = new Int32Array(days + 1);
  { let m = 0; for (let d = 1; d <= days; d++) { while (monthEnds[m] < d) m++; firstMonthForDay[d] = m; } }

  const fan = new Float64Array(nm * nPaths);
  const hitsByMonth = new Float64Array(nm);
  const minRatios = collectMinRatios ? new Float64Array(nPaths) : null;
  let liquidated = 0;
  let marginCalls = 0;
  const reserve = opts.reserve && opts.reserve.amount > 0 ? opts.reserve : null;
  const cureDays = opts.cureDays ?? null;

  for (let p = 0; p < nPaths; p++) {
    const rng = makeRng(mixSeed(seed, p));
    const step = makeStepper(model, params, rng);
    let logS = Math.log(s0);
    let minLog = logS;
    let hit = false;
    let called = false;
    let scale = 1; // barrier multiplier after a reserve top-up
    let deadline = -1;
    for (let d = 1; d <= days; d++) {
      const [ret, lowRel] = step();
      const lowLog = logS + lowRel;
      const lowPrice = Math.exp(lowLog);
      logS += ret;
      if (lowLog < minLog) minLog = lowLog;
      if (!hit) {
        const liquidate = () => { hit = true; liquidated++; hitsByMonth[firstMonthForDay[d]]++; };
        if (lowPrice <= liq(d - 1) * scale) {
          liquidate();
          if (!called && hasMargin) { called = true; marginCalls++; }
        } else if (deadline >= 0 && d >= deadline && Math.exp(logS) <= mc(d - 1) * scale) {
          liquidate();
        } else {
          if (deadline >= 0 && d >= deadline) deadline = -1;
          if (hasMargin && deadline < 0 && lowPrice <= mc(d - 1) * scale) {
            if (!called) {
              called = true; marginCalls++;
              if (reserve) {
                const c = reserve.collateralBtc;
                scale = c / (c + reserve.amount / (mc(d - 1) * scale));
              }
            }
            if (cureDays !== null) deadline = d + cureDays;
          }
        }
      }
      const mi = monthIndexOfDay[d];
      if (mi >= 0) fan[mi * nPaths + p] = Math.exp(logS);
    }
    if (minRatios) minRatios[p] = Math.exp(minLog) / s0;
  }

  const cumulativeByMonth = [];
  let acc = 0;
  for (let m = 0; m < nm; m++) { acc += hitsByMonth[m]; cumulativeByMonth.push(acc / nPaths); }
  const fanByMonth = [];
  for (let m = 0; m < nm; m++) {
    const s = fan.subarray(m * nPaths, (m + 1) * nPaths).slice().sort();
    fanByMonth.push({ month: m + 1, day: monthEnds[m], q05: quantile(s, 0.05), q25: quantile(s, 0.25), q50: quantile(s, 0.5), q75: quantile(s, 0.75), q95: quantile(s, 0.95) });
  }
  const out = { pLiquidation: liquidated / nPaths, pMarginCall: hasMargin ? marginCalls / nPaths : null, cumulativeByMonth, fanByMonth };
  if (minRatios) out.minRatios = Array.from(minRatios);
  return out;
}
