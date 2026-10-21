// Checks for new hourly candles before they are added to the embedded history.
// Used by tools/update-data.mjs (the scheduled data update). Pure functions, no network.
//
// A candle is { time, open, high, low, close, volume } with time = start of the hour (UTC seconds).

/** Problems inside one series: duplicates, gaps, impossible values, jumps. Returns a list of messages. */
export function checkSeries(candles, { previousClose = null, previousTime = null } = {}) {
  const problems = [];
  const seen = new Set();
  let prevT = previousTime; let prevC = previousClose;
  for (const c of candles) {
    const at = new Date(c.time * 1000).toISOString();
    if (seen.has(c.time)) problems.push(`duplicate hour ${at}`);
    seen.add(c.time);
    if (c.time % 3600 !== 0) problems.push(`not on the full hour: ${at}`);
    for (const k of ['open', 'high', 'low', 'close']) {
      if (!Number.isFinite(c[k]) || c[k] <= 0) problems.push(`impossible ${k} ${c[k]} at ${at}`);
    }
    if (!(c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close))) problems.push(`inconsistent candle at ${at} (low must be ≤ open/close ≤ high)`);
    if (!Number.isFinite(c.volume) || c.volume < 0) problems.push(`impossible volume at ${at}`);
    if (prevT !== null) {
      if (c.time <= prevT) problems.push(`out of order at ${at}`);
      else if (c.time - prevT !== 3600) problems.push(`gap of ${(c.time - prevT) / 3600 - 1} hours before ${at}`);
    }
    if (prevC !== null && (c.close / prevC > 2 || c.close / prevC < 0.5)) problems.push(`price jump of more than 2× within one hour at ${at}`);
    prevT = c.time; prevC = c.close;
  }
  return problems;
}

const q = (sorted, f) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(f * (sorted.length - 1)))] : NaN);

/**
 * Compares the main source with a second exchange over the hours both have.
 * Fails if the closing prices differ more than normal; lists big differences in hourly lows
 * (often real short crashes on one exchange) for a human to look at.
 */
export function crossCheck(primary, secondary, {
  minCoverage = 0.8, maxMedian = 0.005, maxP99 = 0.02, maxSingle = 0.05, lowFlag = 0.1,
} = {}) {
  const other = new Map(secondary.map((c) => [c.time, c]));
  const closeDiffs = []; const lowFlags = []; const bigCloses = [];
  let comparable = 0;
  for (const c of primary) {
    const o = other.get(c.time);
    if (!o) continue;
    comparable++;
    const d = Math.abs(Math.log(c.close / o.close));
    closeDiffs.push(d);
    if (d > maxSingle) bigCloses.push(new Date(c.time * 1000).toISOString());
    const dl = Math.abs(Math.log(c.low / o.low));
    if (dl > lowFlag) lowFlags.push({ time: new Date(c.time * 1000).toISOString(), primaryLow: c.low, secondaryLow: o.low });
  }
  closeDiffs.sort((a, b) => a - b);
  // the second source only reaches back a limited time, so coverage counts the hours it could have
  const oldestOther = secondary.length ? Math.min(...secondary.map((c) => c.time)) : Infinity;
  const coverable = primary.filter((c) => c.time >= oldestOther).length;
  const coverage = coverable ? comparable / coverable : 0;
  const stats = { comparable, coverage, median: q(closeDiffs, 0.5), p99: q(closeDiffs, 0.99), max: closeDiffs.at(-1) ?? NaN };
  const problems = [];
  if (primary.length && coverage < minCoverage) problems.push(`the second exchange covers only ${(coverage * 100).toFixed(0)}% of the comparable hours`);
  if (stats.median > maxMedian) problems.push(`closing prices differ by ${(stats.median * 100).toFixed(2)}% in a typical hour (limit ${(maxMedian * 100).toFixed(1)}%)`);
  if (stats.p99 > maxP99) problems.push(`closing prices differ by more than ${(maxP99 * 100).toFixed(0)}% in more than 1 hour in 100`);
  for (const at of bigCloses) problems.push(`closing prices differ by more than ${(maxSingle * 100).toFixed(0)}% at ${at}`);
  return { ok: problems.length === 0, problems, stats, lowFlags };
}

/** Days since the embedded history ends, and whether the page should warn (older than 45 days). */
export function dataAge(lastTime, now = Date.now() / 1000, limitDays = 45) {
  const days = (now - lastTime) / 86400;
  return { days, stale: days > limitDays };
}
