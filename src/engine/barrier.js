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

// The cost of the liquidation risk as a textbook option price (ux/M-risk-cost-spec.md), for a
// price following geometric Brownian motion with yearly drift r (the interest rate; the page
// uses 0) and a constant debt. A sale at the liquidation price H repays the debt with debt / H
// BTC, which miss any rise above H by the end: a down-and-in call with strike H. The BTC paid as
// the fee is lost whole: a down-and-in "asset" option paying the end price. Formulas: Reiner &
// Rubinstein (1991), as in Hull, "Options, Futures, and Other Derivatives", chapter on exotic options.

/** Down-and-in call with the strike at the barrier (K = H <= s0). */
export function downInCallAtBarrier({ s0, barrier: H, r = 0, sigma, years: T }) {
  if (H >= s0) return Math.max(0, s0 - H); // already touched: an ordinary call, here at the money
  const sT = sigma * Math.sqrt(T);
  const lambda = (r + (sigma * sigma) / 2) / (sigma * sigma);
  const y = Math.log(H / s0) / sT + lambda * sT;
  return s0 * (H / s0) ** (2 * lambda) * normCdf(y) - H * Math.exp(-r * T) * (H / s0) ** (2 * lambda - 2) * normCdf(y - sT);
}

/** Today's value of receiving the end price if the barrier H was touched (a down-and-in asset option). */
export function downInAsset({ s0, barrier: H, r = 0, sigma, years: T }) {
  if (H >= s0) return s0;
  const sT = sigma * Math.sqrt(T);
  const lambda = (r + (sigma * sigma) / 2) / (sigma * sigma);
  const x1 = Math.log(s0 / H) / sT + lambda * sT;
  const y1 = Math.log(H / s0) / sT + lambda * sT;
  return s0 - s0 * normCdf(x1) + s0 * (H / s0) ** (2 * lambda) * normCdf(y1);
}

/**
 * The cost of the risk of a loan with a constant debt, sold whole at the liquidation price H:
 * debt / H BTC miss the rise above H, debt × (1 / k − 1) / H BTC are the fee (k = repaid share).
 */
export function riskCostTextbook({ s0, debt, liquidationPrice: H, repaidShare: k = 1, r = 0, sigma, years }) {
  const o = { s0, barrier: H, r, sigma, years };
  return (debt / H) * downInCallAtBarrier(o) + ((debt * (1 / k - 1)) / H) * downInAsset(o);
}
