// GARCH(1,1) with Student-t errors on daily log returns.
//   r_t = mu + e_t,  e_t = sqrt(h_t) z_t,  z_t ~ Student-t(nu) scaled to variance 1
//   h_t = omega + alpha e_{t-1}^2 + beta h_{t-1}
// In plain words: big moves make the next days more likely to be wild too,
// and very large single moves are more common than in the textbook model.
import { makeRng } from './random.js';

function lgamma(x) { // Lanczos approximation
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const logistic = (x) => 1 / (1 + Math.exp(-x));

function unpack(v, scale) {
  const persistence = 0.9995 * logistic(v[2]);
  const alpha = persistence * logistic(v[3]);
  return { mu: v[0] * scale, omega: Math.exp(v[1]) * scale * scale, alpha, beta: persistence - alpha, nu: 2.05 + Math.exp(v[4]) };
}

/** Negative log-likelihood; also returns the variance forecast for the day after the data. */
function negLogLik(p, r, h0) {
  const { mu, omega, alpha, beta, nu } = p;
  const k = lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(Math.PI * (nu - 2));
  let h = h0;
  let ll = 0;
  for (let t = 0; t < r.length; t++) {
    const e = r[t] - mu;
    ll += k - 0.5 * Math.log(h) - ((nu + 1) / 2) * Math.log(1 + (e * e) / (h * (nu - 2)));
    h = omega + alpha * e * e + beta * h;
  }
  return { nll: Number.isFinite(ll) ? -ll : Infinity, hNext: h };
}

function nelderMead(f, x0, { iters = 3000, step = 0.5, tol = 1e-9 } = {}) {
  const n = x0.length;
  let pts = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step; pts.push(p); }
  let vals = pts.map(f);
  for (let it = 0; it < iters; it++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = order.map((i) => pts[i]); vals = order.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol * (1 + Math.abs(vals[0]))) break;
    const cen = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += pts[i][j] / n;
    const mv = (a, b, t) => a.map((x, j) => x + t * (b[j] - x));
    const xr = mv(cen, pts[n], -1); const fr = f(xr);
    if (fr < vals[0]) {
      const xe = mv(cen, pts[n], -2); const fe = f(xe);
      if (fe < fr) { pts[n] = xe; vals[n] = fe; } else { pts[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { pts[n] = xr; vals[n] = fr; } else {
      const xc = mv(cen, pts[n], 0.5); const fc = f(xc);
      if (fc < vals[n]) { pts[n] = xc; vals[n] = fc; } else {
        for (let i = 1; i <= n; i++) { pts[i] = mv(pts[0], pts[i], 0.5); vals[i] = f(pts[i]); }
      }
    }
  }
  return pts[0];
}

/** Maximum-likelihood fit. Returns { mu, omega, alpha, beta, nu, hLast } (hLast = variance forecast for the next day). */
export function fitGarchT(returns) {
  const r = Float64Array.from(returns);
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const variance = r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length;
  const scale = Math.sqrt(variance);
  const f = (v) => negLogLik(unpack(v, scale), r, variance).nll;
  // start: persistence 0.95, alpha share ~0.1, nu ~5; then restart once from the result
  let v = nelderMead(f, [mean / scale, Math.log(0.05), 3, -2.2, Math.log(3)]);
  v = nelderMead(f, v, { step: 0.1 });
  const p = unpack(v, scale);
  return { ...p, hLast: negLogLik(p, r, variance).hNext };
}

/** Simulate `n` daily log returns from fitted params (used in tests). */
export function simulateGarchT(params, n, seed) {
  const rng = makeRng(seed);
  const { mu, omega, alpha, beta, nu } = params;
  let h = omega / (1 - alpha - beta);
  const out = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    const e = Math.sqrt(h) * rng.studentT(nu);
    out[t] = mu + e;
    h = omega + alpha * e * e + beta * h;
  }
  return Array.from(out);
}
