// GARCH(1,1) with Student-t errors on daily log returns.
import { notImplemented } from './notImplemented.js';

/** Maximum-likelihood fit. Returns { mu, omega, alpha, beta, nu }. */
export const fitGarchT = (returns) => notImplemented('fitGarchT');

/** Simulate `n` daily log returns from fitted params (used in tests). */
export const simulateGarchT = (params, n, seed) => notImplemented('simulateGarchT');
