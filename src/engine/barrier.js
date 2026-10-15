// Textbook (closed-form) chance that a price following geometric Brownian motion
// touches a lower barrier before `years` have passed. Sanity check only: real BTC
// has fatter tails than this model, so it tends to underestimate crash risk.

/** log of the standard normal CDF, accurate far into the left tail. */
export function logNormCdf(x) {
  if (x > -5) return Math.log(normCdf(x));
  // asymptotic series for the far left tail
  const x2 = x * x;
  return -0.5 * x2 - Math.log(-x) - 0.5 * Math.log(2 * Math.PI) + Math.log(1 - 1 / x2 + 3 / (x2 * x2) - 15 / (x2 * x2 * x2));
}

/** Standard normal CDF via a high-accuracy erfc (relative error < 1.2e-7). */
export function normCdf(x) {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const erfc = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/** mu = yearly drift of the price (GBM convention; the log price drifts by mu - sigma^2/2), sigma = yearly volatility. */
export function gbmBarrierHitProbability({ s0, barrier, mu, sigma, years }) {
  if (barrier >= s0) return 1;
  if (barrier <= 0 || years <= 0) return 0;
  const nu = mu - (sigma * sigma) / 2;
  const sT = sigma * Math.sqrt(years);
  const lb = Math.log(barrier / s0);
  const first = normCdf((lb - nu * years) / sT);
  const logSecond = ((2 * nu) / (sigma * sigma)) * lb + logNormCdf((lb + nu * years) / sT);
  return Math.min(1, first + Math.exp(logSecond));
}
