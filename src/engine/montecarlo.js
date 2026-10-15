// Monte Carlo price paths in daily steps, checked against a barrier that can
// change day by day (because unpaid interest makes the debt grow).
//   model 'gbm'       : textbook model, params { mu, sigma } (yearly, same convention as barrier.js)
//   model 'bootstrap' : glues together random blocks of real past days,
//                       params { returns, lowRel, blockDays } from history.dailyReturns
//   model 'garch'     : GARCH(1,1)-t, params from garch.fitGarchT
// Within a day, gbm and garch draw the day's low from a Brownian bridge;
// bootstrap uses the real day's low.
// The same seed always gives the same paths, and a longer horizon extends the
// same paths (so results for 6 and 12 months are directly comparable).
import { notImplemented } from './notImplemented.js';

/**
 * runMonteCarlo({ model, params, s0, days, nPaths, seed,
 *                 liquidationBarrier, marginBarrier?, collectMinRatios? })
 * Barriers are a number or an array with one price per day (0..days).
 * Returns { pLiquidation, pMarginCall, cumulativeByMonth: [...],
 *           fanByMonth: [{ month, q05, q25, q50, q75, q95 }], minRatios? }
 */
export const runMonteCarlo = (opts) => notImplemented('runMonteCarlo');
