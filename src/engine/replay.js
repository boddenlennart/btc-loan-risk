// Historical replay: start the same loan at every past day and see what happened.
// Liquidation is triggered by the hourly candle LOW (rules in reference/reference_replay.py):
//   - the loan starts at the OPEN price of the start hour,
//   - checks begin with the hour after the start hour and end at maturity,
//   - debt = loan + interest owed but not yet paid, growing day by day.
// Optional behaviour at a margin call:
//   - reserveAmount: that much money is added as BTC at the margin-call price (once),
//   - marginCallConsequence 'liquidateAfterCure': if the LTV is still at or above the
//     margin-call level when the cure period ends, the lender liquidates then.
import { collateralBtc, debtByDay, loanDays } from './loan.js';

const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);

function indexOf(time, t) {
  let lo = 0; let hi = time.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time[mid] === t) return mid;
    if (time[mid] < t) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

// For speed: for every hour that starts a UTC day, the index where that day ends
// and the day's lowest price. Whole days far away from any trigger are skipped in one step.
const dayBlocks = new WeakMap();
function blocksFor(hourly) {
  let b = dayBlocks.get(hourly);
  if (b) return b;
  const n = hourly.time.length;
  const end = new Int32Array(n);
  const low = new Float64Array(n);
  for (let i = 0; i < n;) {
    const day = Math.floor(hourly.time[i] / 86400);
    let j = i; let lo = Infinity;
    while (j < n && Math.floor(hourly.time[j] / 86400) === day) { if (hourly.low[j] < lo) lo = hourly.low[j]; j++; }
    end[i] = j; low[i] = lo;
    i = j;
  }
  b = { end, low };
  dayBlocks.set(hourly, b);
  return b;
}

/** Core loop over one loan window; also measures drawdown and the reserve that would have avoided liquidation. */
function run(hourly, terms, i0, skipDays = true, debtCache = null) {
  const t0 = hourly.time[i0];
  const startPrice = hourly.open[i0];
  const t = { ...terms, btcPrice: startPrice, startDate: isoDay(t0) };
  const c0 = collateralBtc(t);
  // The debt path depends on the start date only through the calendar (month lengths,
  // leap years), so loans starting on the same day of the year (and leap-year phase) share it.
  const key = `${t.startDate.slice(5)}|${+t.startDate.slice(0, 4) % 4}`;
  let debt = debtCache?.get(key);
  if (!debt) { debt = debtByDay(t); debtCache?.set(key, debt); }
  const tEnd = t0 + (debt.length - 1) * 86400;
  const mLtv = t.marginCallLtv || null;
  const lLtv = t.liquidationLtv;
  const reserve = t.reserveAmount > 0 ? t.reserveAmount : 0;
  const afterCure = t.marginCallConsequence === 'liquidateAfterCure' && mLtv;
  const cureSec = (t.curePeriodHours ?? 0) * 3600;

  let c = c0;
  let marginCall = null; let liquidation = null; let topUp = null;
  let deadline = null;
  let minLow = startPrice; let minLowTime = t0;
  let reserveNeeded = 0;
  const fast = skipDays && t0 % 86400 === 0;
  const blocks = fast ? blocksFor(hourly) : null;
  for (let i = i0 + 1; i < hourly.time.length && hourly.time[i] < tEnd; i++) {
    if (fast && hourly.time[i] % 86400 === 0 && deadline === null) {
      const dt = debt[Math.floor((hourly.time[i] - t0) / 86400)];
      const watchMargin = mLtv && (!marginCall || afterCure);
      const threshold = watchMargin ? dt / (c * mLtv) : dt / (c * lLtv);
      const dayLow = blocks.low[i];
      if (liquidation || dayLow > threshold) {
        const need = dt / (lLtv * dayLow) / c0 - 1;
        if (need > reserveNeeded) reserveNeeded = need;
        if (dayLow < minLow) {
          minLow = dayLow;
          for (let k = i; k < blocks.end[i]; k++) if (hourly.low[k] === dayLow) { minLowTime = hourly.time[k]; break; }
        }
        i = blocks.end[i] - 1;
        continue;
      }
    }
    const ti = hourly.time[i];
    const low = hourly.low[i];
    const dt = debt[Math.floor((ti - t0) / 86400)];
    if (low < minLow) { minLow = low; minLowTime = ti; }
    const need = dt / (lLtv * low) / c0 - 1;
    if (need > reserveNeeded) reserveNeeded = need;
    if (liquidation) continue;

    if (low <= dt / (c * lLtv)) {
      liquidation = { time: ti, low, reason: 'liquidationLtv' };
      if (!marginCall && mLtv) marginCall = { time: ti, low };
      continue;
    }
    if (deadline !== null && ti >= deadline) {
      if (hourly.close[i] <= dt / (c * mLtv)) {
        liquidation = { time: ti, low, reason: 'cureExpired' };
        continue;
      }
      deadline = null;
    }
    if (mLtv && deadline === null && low <= dt / (c * mLtv)) {
      const firstCall = !marginCall;
      if (firstCall) marginCall = { time: ti, low };
      if (firstCall && reserve) {
        const price = dt / (c * mLtv);
        topUp = { time: ti, btc: reserve / price, price };
        c += topUp.btc;
      }
      if (afterCure) deadline = ti + cureSec;
    }
  }
  return {
    startTime: t0, startPrice, collateralBtc: c0, marginCall, liquidation, topUp,
    maxDrawdown: 1 - minLow / startPrice, minLowTime, reserveNeeded: Math.max(0, reserveNeeded),
  };
}

/** Replays one loan starting at a given hour (skipDays: false forces the plain hour-by-hour loop). Returns { startPrice, collateralBtc, marginCall, liquidation, topUp, maxDrawdown }. */
export function replayOne(hourly, terms, startTime, { skipDays = true } = {}) {
  const i0 = indexOf(hourly.time, startTime);
  if (i0 < 0) throw new Error(`no price for start time ${startTime}`);
  return run(hourly, terms, i0, skipDays);
}

const nearestRank = (sorted, q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];

/**
 * Replays the loan from every UTC day start where the full duration fits in the history.
 * Returns { starts, liquidatedShare, marginCallShare, worst, fastest, reserveBtcNeeded, perStart }.
 * reserveBtcNeeded: extra BTC (per BTC pledged) that would have avoided liquidation; quantiles over all starts.
 */
export function replayAll(hourly, terms, { firstStart = -Infinity } = {}) {
  const last = hourly.time[hourly.time.length - 1];
  const perStart = { time: [], liquidated: [], marginCall: [], liquidationTime: [] };
  let liq = 0; let mc = 0;
  let worst = null; let fastest = null;
  const reserves = [];
  const debtCache = new Map();
  for (let i = 0; i < hourly.time.length; i++) {
    const t0 = hourly.time[i];
    if (t0 % 86400 !== 0 || t0 < firstStart) continue;
    const days = loanDays({ ...terms, startDate: isoDay(t0) });
    if (t0 + days * 86400 - 3600 > last) break;
    const r = run(hourly, terms, i, true, debtCache);
    perStart.time.push(t0);
    perStart.liquidated.push(!!r.liquidation);
    perStart.marginCall.push(!!r.marginCall);
    perStart.liquidationTime.push(r.liquidation ? r.liquidation.time : null);
    if (r.liquidation) liq++;
    if (r.marginCall) mc++;
    reserves.push(r.reserveNeeded);
    if (!worst || r.maxDrawdown > worst.maxDrawdown) {
      worst = { startTime: t0, startPrice: r.startPrice, maxDrawdown: r.maxDrawdown, minLowTime: r.minLowTime, liquidationTime: r.liquidation ? r.liquidation.time : null };
    }
    if (r.liquidation && (!fastest || r.liquidation.time - t0 < fastest.hours * 3600)) {
      fastest = { startTime: t0, liquidationTime: r.liquidation.time, hours: (r.liquidation.time - t0) / 3600 };
    }
  }
  const n = perStart.time.length;
  const sorted = reserves.slice().sort((a, b) => a - b);
  return {
    starts: n,
    liquidatedShare: n ? liq / n : null,
    marginCallShare: n ? mc / n : null,
    worst, fastest,
    reserveBtcNeeded: n ? { q50: nearestRank(sorted, 0.5), q90: nearestRank(sorted, 0.9), q95: nearestRank(sorted, 0.95), max: sorted[n - 1] } : null,
    perStart,
  };
}
