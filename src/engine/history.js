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

/** Daily log returns close-to-close, and each day's low relative to the previous close (both as logs).
 *  With the hourly candles the days were made from: hourLows, per day the lows of its hours in order,
 *  relative to the previous close (logs), so a sale can be priced in the hour the level is reached (decision 020). */
export function dailyReturns(daily, hourly = null) {
  const returns = []; const lowRel = [];
  for (let i = 1; i < daily.close.length; i++) {
    returns.push(Math.log(daily.close[i] / daily.close[i - 1]));
    lowRel.push(Math.log(Math.min(daily.low[i], daily.close[i]) / daily.close[i - 1]));
  }
  if (!hourly) return { returns, lowRel };
  const byDay = []; let day = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    const d = Math.floor(hourly.time[i] / 86400);
    if (d !== day) { day = d; byDay.push([]); }
    byDay[byDay.length - 1].push(hourly.low[i]);
  }
  const hourLows = returns.map((_, i) => Float64Array.from(byDay[i + 1], (low) => Math.log(low / daily.close[i])));
  return { returns, lowRel, hourLows };
}

/**
 * Two measured anchors for calmer and wilder swings (decision 021), in yearly terms (standard deviation of the
 * daily log moves × √365): calm, the calmest `window` consecutive days so far (vol, end = time of its last day);
 * wild, all days in 2017–2021. `returns` as from dailyReturns(daily).
 */
export function volatilityAnchors(daily, returns, { window = 365 } = {}) {
  const sd = (s, s2, n) => Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2) * 365);
  let s = 0; let s2 = 0; let calm = null;
  for (let i = 0; i < returns.length; i++) {
    s += returns[i]; s2 += returns[i] ** 2;
    if (i >= window) { s -= returns[i - window]; s2 -= returns[i - window] ** 2; }
    if (i >= window - 1) { const v = sd(s, s2, window); if (!calm || v < calm.vol) calm = { vol: v, end: daily.time[i + 1] }; }
  }
  let w = 0; let w2 = 0; let n = 0;
  returns.forEach((r, i) => { const y = new Date(daily.time[i + 1] * 1000).getUTCFullYear(); if (y >= 2017 && y <= 2021) { w += r; w2 += r * r; n++; } });
  return { calm, wild: { vol: n ? sd(w, w2, n) : null, from: 2017, to: 2021 } };
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

/**
 * One weight per day for drawing blocks of real days: 1 for the newest day, halving every `halfLifeDays`
 * back in time. BTC's swings have shrunk as the market grew (about 80–90% a year in 2017–2021,
 * 42–52% since 2023), so recent days count more; older crashes still count, with less weight.
 */
export function recencyWeights(n, halfLifeDays) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 2 ** (-(n - 1 - i) / halfLifeDays);
  return w;
}
