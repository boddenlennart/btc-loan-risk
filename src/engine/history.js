// Turns hourly candles into the daily series the simulations use.
import { notImplemented } from './notImplemented.js';

/** hourly: { time, open, high, low, close } arrays. Returns daily { time, open, low, close } (UTC days). */
export const dailyFromHourly = (hourly) => notImplemented('dailyFromHourly');

/** Daily log returns close-to-close, and each day's low relative to the previous close. */
export const dailyReturns = (daily) => notImplemented('dailyReturns');
