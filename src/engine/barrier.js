// Textbook (closed-form) chance that a price following geometric Brownian motion
// touches a lower barrier before `years` have passed. Sanity check only.
import { notImplemented } from './notImplemented.js';

/** mu = yearly drift of the price (GBM convention; the log price drifts by mu - sigma^2/2), sigma = yearly volatility. */
export const gbmBarrierHitProbability = ({ s0, barrier, mu, sigma, years }) => notImplemented('gbmBarrierHitProbability');
