// Test 1 — The textbook formula and the Monte Carlo simulation agree.
// We simulate a price that follows the textbook model exactly (GBM). If the
// simulation machinery is right, the share of paths that touch the barrier must
// match the formula, up to random noise. The allowed noise is 4 standard errors
// (a correct simulation fails this by chance far less than 1 time in 10,000).
import { describe, it, expect } from 'vitest';
import { gbmBarrierHitProbability } from '../src/engine/barrier.js';
import { runMonteCarlo } from '../src/engine/montecarlo.js';

const cases = [
  { name: 'calm, no drift, barrier at 62.5%, 1 year', mu: 0, sigma: 0.6, barrier: 0.625, years: 1 },
  { name: 'wild, upward drift, barrier at 50%, 2 years', mu: 0.2, sigma: 0.8, barrier: 0.5, years: 2 },
  { name: 'downward drift, close barrier, 3 months', mu: -0.1, sigma: 0.4, barrier: 0.8, years: 0.25 },
  { name: 'far barrier, 1 year (rare event)', mu: 0, sigma: 0.5, barrier: 0.3, years: 1 },
];

describe('closed-form formula vs Monte Carlo (textbook model)', () => {
  for (const c of cases) {
    it(c.name, () => {
      const nPaths = 40000;
      const days = Math.round(c.years * 365);
      const exact = gbmBarrierHitProbability({ s0: 1, barrier: c.barrier, mu: c.mu, sigma: c.sigma, years: days / 365 });
      const mc = runMonteCarlo({
        model: 'gbm', params: { mu: c.mu, sigma: c.sigma }, s0: 1, days, nPaths, seed: 42,
        liquidationBarrier: c.barrier,
      });
      const se = Math.sqrt((exact * (1 - exact)) / nPaths);
      expect(Math.abs(mc.pLiquidation - exact)).toBeLessThanOrEqual(4 * se + 1e-4);
    });
  }
});

describe('closed-form formula: obvious cases', () => {
  it('barrier at or above today\'s price is hit immediately', () => {
    expect(gbmBarrierHitProbability({ s0: 100, barrier: 100, mu: 0, sigma: 0.5, years: 1 })).toBe(1);
  });
  it('almost no volatility and no drift -> almost never hit', () => {
    expect(gbmBarrierHitProbability({ s0: 100, barrier: 60, mu: 0, sigma: 0.01, years: 1 })).toBeLessThan(1e-6);
  });
  it('matches a value worked out by hand', () => {
    // B/S = 0.5, mu = 0, sigma = 1, T = 1, nu = mu - sigma^2/2 = -0.5:
    // N((ln 0.5 + 0.5) / 1) + 0.5^(2 nu / sigma^2) x N((ln 0.5 - 0.5) / 1)
    // = N(-0.1931) + 2 x N(-1.1931) = 0.42342 + 2 x 0.11641 = 0.65623
    expect(gbmBarrierHitProbability({ s0: 1, barrier: 0.5, mu: 0, sigma: 1, years: 1 })).toBeCloseTo(0.65623, 4);
  });
  it('more time -> higher chance', () => {
    const p = (years) => gbmBarrierHitProbability({ s0: 1, barrier: 0.6, mu: 0, sigma: 0.7, years });
    expect(p(2)).toBeGreaterThan(p(1));
  });
});

describe('Monte Carlo is repeatable', () => {
  it('same seed -> identical result', () => {
    const o = { model: 'gbm', params: { mu: 0, sigma: 0.6 }, s0: 1, days: 365, nPaths: 2000, liquidationBarrier: 0.6 };
    expect(runMonteCarlo({ ...o, seed: 7 })).toEqual(runMonteCarlo({ ...o, seed: 7 }));
  });
  it('fan chart quantiles are in order every month', () => {
    const r = runMonteCarlo({ model: 'gbm', params: { mu: 0, sigma: 0.6 }, s0: 1, days: 365, nPaths: 2000, seed: 1, liquidationBarrier: 0.6 });
    expect(r.fanByMonth).toHaveLength(12);
    for (const m of r.fanByMonth) {
      expect(m.q05).toBeLessThanOrEqual(m.q25);
      expect(m.q25).toBeLessThanOrEqual(m.q50);
      expect(m.q50).toBeLessThanOrEqual(m.q75);
      expect(m.q75).toBeLessThanOrEqual(m.q95);
    }
  });
  it('liquidation chance by month only goes up and ends at the total', () => {
    const r = runMonteCarlo({ model: 'gbm', params: { mu: 0, sigma: 0.6 }, s0: 1, days: 365, nPaths: 2000, seed: 1, liquidationBarrier: 0.6 });
    for (let i = 1; i < r.cumulativeByMonth.length; i++) expect(r.cumulativeByMonth[i]).toBeGreaterThanOrEqual(r.cumulativeByMonth[i - 1]);
    expect(r.cumulativeByMonth.at(-1)).toBeCloseTo(r.pLiquidation, 12);
  });
  it('margin call is at least as likely as liquidation', () => {
    const r = runMonteCarlo({ model: 'gbm', params: { mu: 0, sigma: 0.6 }, s0: 1, days: 365, nPaths: 2000, seed: 1, liquidationBarrier: 0.6, marginBarrier: 0.7 });
    expect(r.pMarginCall).toBeGreaterThanOrEqual(r.pLiquidation);
  });
});

describe('assumed price trend', () => {
  it('with an assumed trend, the textbook model still matches the formula', () => {
    // trend 0: log price has no drift -> formula with mu = sigma^2 / 2
    const sigma = 0.6;
    const exact = gbmBarrierHitProbability({ s0: 1, barrier: 0.6, mu: sigma ** 2 / 2, sigma, years: 1 });
    const mc = runMonteCarlo({ model: 'gbm', params: { mu: 0.5, sigma }, s0: 1, days: 365, nPaths: 40000, seed: 3, liquidationBarrier: 0.6, logDriftPerDay: 0 });
    expect(Math.abs(mc.pLiquidation - exact)).toBeLessThanOrEqual(4 * Math.sqrt(exact * (1 - exact) / 40000) + 1e-4);
  });
  it('bootstrap with trend 0: simulated median price after a year stays near today\'s price', () => {
    const returns = Array.from({ length: 400 }, (_, i) => 0.004 + 0.03 * Math.sin(i * 1.7)); // strongly rising made-up history
    const lowRel = returns.map((r) => Math.min(0, r) - 0.01);
    const r = runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: 10 }, s0: 1, days: 365, nPaths: 4000, seed: 2, liquidationBarrier: 0, logDriftPerDay: 0 });
    expect(r.fanByMonth.at(-1).q50).toBeGreaterThan(0.85);
    expect(r.fanByMonth.at(-1).q50).toBeLessThan(1.15);
  });
});
