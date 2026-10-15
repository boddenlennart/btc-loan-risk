// Historical replay: start the same loan at every past day and see what happened.
// Liquidation is triggered by the hourly candle LOW (rules in reference/reference_replay.py):
//   - the loan starts at the OPEN price of the start hour,
//   - checks begin with the hour after the start hour and end at maturity,
//   - debt = loan + interest owed but not yet paid, growing day by day.
// What the lender does at a margin call or liquidation (including partial sales and
// a reserve top-up) is defined once in lender.js and shared with the simulations.
import { collateralBtc, debtByDay, loanDays } from './loan.js';
import { lenderRules, createLoanState, stepLoan, watchPrice } from './lender.js';

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
  const lLtv = t.liquidationLtv;
  const rules = lenderRules(t);
  const cure = (t.curePeriodHours ?? 0) * 3600;
  const s = createLoanState(c0);

  let minLow = startPrice; let minLowTime = t0;
  let reserveNeeded = 0;
  const fast = skipDays && t0 % 86400 === 0;
  const blocks = fast ? blocksFor(hourly) : null;
  for (let i = i0 + 1; i < hourly.time.length && hourly.time[i] < tEnd; i++) {
    if (fast && hourly.time[i] % 86400 === 0 && s.deadline === null) {
      const dt = debt[Math.floor((hourly.time[i] - t0) / 86400)];
      const dayLow = blocks.low[i];
      if (s.liquidation || dayLow > watchPrice(s, rules, dt)) {
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
    stepLoan(s, rules, { time: ti, low, close: hourly.close[i], debt: dt, cure });
  }
  return {
    startTime: t0, startPrice, collateralBtc: c0, marginCall: s.firstMargin, liquidation: s.liquidation, topUp: s.topUp,
    partialSales: s.partialSales, collateralAtEnd: s.liquidation ? s.liquidation.btcReturned : s.c, debtScaleAtEnd: s.scale,
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
 * Returns { starts, liquidatedShare, partialShare (part of the BTC sold, loan continued), marginCallShare, worst, fastest, reserveBtcNeeded, perStart }.
 * reserveBtcNeeded: extra BTC (per BTC pledged) that would have avoided liquidation; quantiles over all starts.
 */
export function replayAll(hourly, terms, { firstStart = -Infinity } = {}) {
  const last = hourly.time[hourly.time.length - 1];
  const perStart = { time: [], liquidated: [], partial: [], marginCall: [], liquidationTime: [] };
  let liq = 0; let mc = 0; let part = 0;
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
    perStart.partial.push(!r.liquidation && r.partialSales.length > 0);
    perStart.marginCall.push(!!r.marginCall);
    if (!r.liquidation && r.partialSales.length) part++;
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
    partialShare: n ? part / n : null,
    marginCallShare: n ? mc / n : null,
    worst, fastest,
    reserveBtcNeeded: n ? { q50: nearestRank(sorted, 0.5), q90: nearestRank(sorted, 0.9), q95: nearestRank(sorted, 0.95), max: sorted[n - 1] } : null,
    perStart,
  };
}
