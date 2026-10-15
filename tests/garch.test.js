// Extra check for the GARCH cross-check model: if we invent data from known
// GARCH settings, the fitting code must find those settings again.
import { describe, it, expect } from 'vitest';
import { fitGarchT, simulateGarchT } from '../src/engine/garch.js';

describe('GARCH(1,1) with Student-t errors recovers known settings', () => {
  const truth = { mu: 0.0005, omega: 0.00002, alpha: 0.1, beta: 0.85, nu: 5 };
  const data = () => simulateGarchT(truth, 20000, 123);

  it('fitted values are close to the true ones', () => {
    const fit = fitGarchT(data());
    expect(Math.abs(fit.alpha - truth.alpha)).toBeLessThan(0.03);
    expect(Math.abs(fit.beta - truth.beta)).toBeLessThan(0.05);
    expect(Math.abs(fit.nu - truth.nu)).toBeLessThan(1.5);
    // long-run daily variance omega / (1 - alpha - beta) within 25%
    const lr = (p) => p.omega / (1 - p.alpha - p.beta);
    expect(Math.abs(lr(fit) / lr(truth) - 1)).toBeLessThan(0.25);
  });
  it('fitted model is stable (alpha + beta < 1) and has fat tails (nu > 2)', () => {
    const fit = fitGarchT(data());
    expect(fit.alpha + fit.beta).toBeLessThan(1);
    expect(fit.nu).toBeGreaterThan(2);
  });
});

describe('Student-t random numbers', () => {
  it('have variance 1 and the right tail weight', async () => {
    const { makeRng } = await import('../src/engine/random.js');
    const rng = makeRng(11);
    const nu = 5; const n = 400000;
    let s2 = 0; let tail = 0;
    for (let i = 0; i < n; i++) { const x = rng.studentT(nu); s2 += x * x; if (Math.abs(x) > 3) tail++; }
    expect(s2 / n).toBeGreaterThan(0.97);
    expect(s2 / n).toBeLessThan(1.03);
    // P(|T| > 3 / sqrt(3/5)) for t(5) = P(|T| > 3.873) = 0.01172
    expect(tail / n).toBeGreaterThan(0.0105);
    expect(tail / n).toBeLessThan(0.0130);
  });
});
