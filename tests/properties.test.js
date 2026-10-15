// Test 5 — Common-sense rules, checked on hundreds of random loans:
//   - a higher LTV never gives a lower liquidation price;
//   - a longer loan never gives a lower chance of liquidation.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { liquidationPrices } from '../src/engine/loan.js';
import { gbmBarrierHitProbability } from '../src/engine/barrier.js';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { replayOne } from '../src/engine/replay.js';

const base = {
  currency: 'EUR', btcPrice: 50000, loanAmount: 10000, marginCallLtv: null, startDate: '2026-01-01',
  compounding: 'none', dayCount: '30/360', originationFee: { type: 'percent', value: 0 },
};
const termsArb = fc.record({
  loanAmount: fc.double({ min: 100, max: 1e7, noNaN: true }),
  btcPrice: fc.double({ min: 1000, max: 1e6, noNaN: true }),
  ltvA: fc.double({ min: 0.05, max: 0.85, noNaN: true }),
  ltvB: fc.double({ min: 0.05, max: 0.85, noNaN: true }),
  liquidationLtv: fc.double({ min: 0.86, max: 0.99, noNaN: true }),
  durationMonths: fc.integer({ min: 1, max: 60 }),
  annual: fc.double({ min: 0, max: 0.3, noNaN: true }),
  repayment: fc.constantFrom('interestOnly', 'bullet', 'amortizing'),
});

describe('higher LTV -> liquidation price never lower', () => {
  it('holds at the start and at maturity for random loans', () => {
    fc.assert(fc.property(termsArb, (t) => {
      const [lo, hi] = [Math.min(t.ltvA, t.ltvB), Math.max(t.ltvA, t.ltvB)];
      const mk = (ltv) => ({ ...base, ...t, initialLtv: ltv, rate: { type: 'fixed', annual: t.annual } });
      const a = liquidationPrices(mk(lo));
      const b = liquidationPrices(mk(hi));
      return b.atStart >= a.atStart - 1e-9 && b.atMaturity >= a.atMaturity - 1e-9;
    }), { numRuns: 300 });
  });
});

describe('longer loan -> chance of liquidation never lower', () => {
  it('closed-form formula', () => {
    fc.assert(fc.property(
      fc.double({ min: 0.1, max: 0.95, noNaN: true }), fc.double({ min: 0.05, max: 1.5, noNaN: true }),
      fc.double({ min: -0.5, max: 0.5, noNaN: true }), fc.double({ min: 0.01, max: 3, noNaN: true }), fc.double({ min: 0.01, max: 3, noNaN: true }),
      (barrier, sigma, mu, y1, y2) => {
        const p = (years) => gbmBarrierHitProbability({ s0: 1, barrier, mu, sigma, years });
        return p(Math.max(y1, y2)) >= p(Math.min(y1, y2)) - 1e-12;
      },
    ), { numRuns: 300 });
  });
  for (const model of ['gbm', 'bootstrap', 'garch']) {
    it(`Monte Carlo (${model}), same random paths`, () => {
      const params = {
        gbm: { mu: 0, sigma: 0.7 },
        // tiny made-up history so this test does not depend on the real data
        bootstrap: { returns: [0.03, -0.05, 0.01, -0.02, 0.04, -0.06, 0.02], lowRel: [-0.01, -0.07, -0.01, -0.03, -0.005, -0.08, -0.01], blockDays: 3 },
        garch: { mu: 0, omega: 0.00002, alpha: 0.1, beta: 0.85, nu: 5 },
      }[model];
      let prev = 0;
      for (const days of [30, 90, 180, 365, 730]) {
        const r = runMonteCarlo({ model, params, s0: 1, days, nPaths: 3000, seed: 99, liquidationBarrier: 0.6 });
        expect(r.pLiquidation).toBeGreaterThanOrEqual(prev);
        prev = r.pLiquidation;
      }
    });
  }
  it('historical replay of one start date: a longer loan is liquidated if the shorter one is', () => {
    // made-up hourly prices: 100, falls to 70 in hour 500, recovers
    const n = 24 * 400;
    const time = Array.from({ length: n }, (_, i) => 1704067200 + i * 3600);
    const close = time.map((_, i) => (i < 400 ? 100 : i < 600 ? 70 : 100));
    const hourly = { time, open: close, high: close, low: close, close };
    const t = { ...base, btcPrice: 100, loanAmount: 50, initialLtv: 0.5, liquidationLtv: 0.7, rate: { type: 'fixed', annual: 0 }, repayment: 'interestOnly' };
    expect(replayOne(hourly, { ...t, durationMonths: 1 }, time[0]).liquidation).not.toBeNull();
    expect(replayOne(hourly, { ...t, durationMonths: 6 }, time[0]).liquidation).not.toBeNull();
  });
});
