// Turns hourly candles into the daily series the simulations use.

/** hourly: { time, open, high, low, close } arrays. Returns daily { time, open, low, close } (UTC days). */
export function dailyFromHourly(hourly) {
  const time = []; const open = []; const low = []; const close = [];
  let day = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    const d = Math.floor(hourly.time[i] / 86400);
    if (d !== day) {
      day = d;
      time.push(d * 86400); open.push(hourly.open[i]); low.push(hourly.low[i]); close.push(hourly.close[i]);
    } else {
      const k = low.length - 1;
      if (hourly.low[i] < low[k]) low[k] = hourly.low[i];
      close[k] = hourly.close[i];
    }
  }
  return { time, open, low, close };
}

/** Daily log returns close-to-close, and each day's low relative to the previous close (both as logs). */
export function dailyReturns(daily) {
  const returns = []; const lowRel = [];
  for (let i = 1; i < daily.close.length; i++) {
    returns.push(Math.log(daily.close[i] / daily.close[i - 1]));
    lowRel.push(Math.log(Math.min(daily.low[i], daily.close[i]) / daily.close[i - 1]));
  }
  return { returns, lowRel };
}

/** The largest fall in the whole history: from the highest hourly close so far to a later hourly low (0.84 = −84%). */
export function largestFall(hourly) {
  let peak = 0; let worst = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    if (peak > 0) worst = Math.max(worst, 1 - hourly.low[i] / peak);
    peak = Math.max(peak, hourly.close[i]);
  }
  return worst;
}

/**
 * How fast BTC fell by `drop` (0.38 = −38%) at its fastest: the fewest hours from an hourly close
 * to a later hourly low at least `drop` below it. null if it never fell that far.
 * Binary search on the window length; each check slides a window maximum over the closes.
 */
export function fastestFall(hourly, drop) {
  const { time, close, low } = hourly; const n = close.length;
  const k = 1 - drop;
  const hitWithin = (w) => { // is there an hour j whose low is ≤ k × a close at most w hours before it? (clock hours: gaps count)
    const q = new Int32Array(n); let h = 0; let tl = 0; // indices of closes, decreasing
    for (let j = 1; j < n; j++) {
      const i = j - 1;
      while (tl > h && close[q[tl - 1]] <= close[i]) tl--;
      q[tl++] = i;
      while (h < tl && time[q[h]] < time[j] - w * 3600) h++; // after a data gap the window can be empty
      if (h < tl && low[j] <= k * close[q[h]]) return true;
    }
    return false;
  };
  const all = Math.ceil((time[n - 1] - time[0]) / 3600) + 1;
  if (!hitWithin(all)) return null;
  let lo = 1; let hi = all;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (hitWithin(mid)) hi = mid; else lo = mid + 1; }
  return lo;
}
