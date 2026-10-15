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
