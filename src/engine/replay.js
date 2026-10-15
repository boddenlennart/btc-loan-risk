// Historical replay: start the same loan at every past day and see what happened.
// Liquidation is triggered by the hourly candle LOW (rules in reference/reference_replay.py).
import { notImplemented } from './notImplemented.js';

/** Replays one loan starting at a given hour. Returns { startPrice, collateralBtc, marginCall, liquidation } (each null or { time, low }). */
export const replayOne = (hourly, terms, startTime) => notImplemented('replayOne');

/**
 * Replays the loan from every UTC day start where the full duration fits in the history.
 * Returns { starts, liquidatedShare, marginCallShare, worst: { startTime, liquidationTime, maxDrawdown },
 *           reserveBtcNeeded: { q50, q90, q95, max } } — extra BTC (per BTC pledged) that would have avoided liquidation.
 */
export const replayAll = (hourly, terms) => notImplemented('replayAll');
