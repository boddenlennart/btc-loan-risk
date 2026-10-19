// Maths audit (ux/K-math-audit.md): cases with an answer known in advance, and the properties the page's
// claims rely on (precision, independent random streams, no built-in trend).
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { makeRng, mixSeed } from '../src/engine/random.js';
import { recencyWeights } from '../src/engine/history.js';
import { createLoanState, stepLoan, lenderRules } from '../src/engine/lender.js';

const flat = (n) => new Float64Array(n + 1).fill(5000); // debt 5,000 every day, no interest
const loanOf = (debt, btc, over = {}) => ({ debtByDay: debt, collateralBtc: btc, rules: lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationFee: { value: 0, basis: 'debt' }, ...over }) });
const run = (steps, loan, o = {}) => runMonteCarlo({ model: 'fixed', params: { steps }, s0: 100, days: 60, nPaths: 3, seed: 1, loan, samplePaths: 3, ...o });

describe('answers known in advance', () => {
  it('prices that never move: nothing is ever liquidated and no margin call happens', () => {
    const r = run([[0, 0]], loanOf(flat(60), 100, { marginCallLtv: 0.7, marginCallConsequence: 'liquidateAfterCure' }), { cureDays: 2 });
    expect([r.pLiquidation, r.pPartial, r.pMarginCall]).toEqual([0, 0, 0]);
  });
  it('a steady fall of 2% a day: liquidated exactly on the first day the low reaches the liquidation price', () => {
    // LTV 50% → 80% means a fall to 62.5% of the start price: 0.98^d ≤ 0.625 first at d = 24
    const r = run([[Math.log(0.98), Math.log(0.98)]], loanOf(flat(60), 100));
    expect(r.pLiquidation).toBe(1);
    expect(r.samplePaths.every((p) => p.event.day === Math.ceil(Math.log(0.625) / Math.log(0.98)))).toBe(true);
  });
  it('the day\'s low counts, not only the close: a dip to the liquidation price that recovers the same day still liquidates', () => {
    const steps = [[0, 0], [0, Math.log(0.62)], [0, 0]]; // day 2 dips 38% and closes unchanged
    expect(run(steps, loanOf(flat(60), 100)).samplePaths[0].event.day).toBe(2);
  });
  it('a margin call that is not fixed: the sale happens exactly when the deadline ends, at that day\'s close', () => {
    // price falls 30% on day 3 (below the margin-call price at LTV 70%: 71.4% of start) and stays there
    const steps = [[0, 0], [0, 0], [Math.log(0.7), Math.log(0.7)], [0, 0]];
    const r = runMonteCarlo({ model: 'fixed', params: { steps: [...steps, ...Array(60).fill([0, 0])] }, s0: 100, days: 30, nPaths: 1, seed: 1, samplePaths: 1,
      loan: loanOf(flat(30), 100, { marginCallLtv: 0.7, marginCallConsequence: 'liquidateAfterCure' }), cureDays: 2 });
    expect(r.samplePaths[0].event).toEqual({ day: 3 + 2, kind: 'cureExpired' });
  });
  it('a partial liquidation brings the LTV back exactly to the target, the fee included', () => {
    for (const fee of [{ value: 0.02, basis: 'debt' }, { value: 0.03, basis: 'collateralSold' }]) {
      const rules = lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationSale: 'partial', liquidationFee: fee });
      const s = createLoanState(100);
      stepLoan(s, rules, { time: 1, low: 60, close: 61, debt: 5000, cure: 0 }); // liquidation price 62.5
      expect(s.partialSales.length).toBe(1);
      expect((5000 * s.scale) / (s.c * 62.5)).toBeCloseTo(0.5, 10);
    }
  });
});

describe('borrowing extra cash to buy BTC, compared future by future with not borrowing it', () => {
  // 100 BTC pledged at 100; without the extra cash the loan repays 5,500 at the end; with 1,000 extra
  // (which buys 10 BTC today) it repays 6,600. At the end BTC is at 100 or at 120, the same in every future.
  const levRun = (endRel, lev) => runMonteCarlo({ model: 'fixed', params: { steps: [[Math.log(endRel), 0], [0, 0]] }, s0: 100, days: 30, nPaths: 3, seed: 1,
    loan: loanOf(new Float64Array(31).fill(5000), 100), leverage: lev });
  const base = (endRel) => levRun(endRel, { bought: 0, payback: 5500, repay: 'sell', keepPaths: true }).leverage.endBtcPerPath;
  it('BTC flat: the extra 1,000 costs 1,100 back, so less BTC than without it', () => {
    const r = levRun(1, { bought: 10, payback: 6600, repay: 'sell', base: base(1) });
    expect(r.leverage.lessKept).toBe(1);
    expect(r.leverage.middleDiff.lessKept).toBeCloseTo(10 - 1100 / 100, 9); // −1 BTC
  });
  it('BTC 20% higher: the 10 BTC bought are worth more than the 1,100 to repay, so more BTC', () => {
    const r = levRun(1.2, { bought: 10, payback: 6600, repay: 'sell', base: base(1.2) });
    expect(r.leverage.more).toBe(1);
    expect(r.leverage.middleDiff.more).toBeCloseTo(10 - 1100 / 120, 9);
  });
});

describe('random streams and precision', () => {
  it('one stream per path, all different; runs with neighbouring seeds share no path', () => {
    const run1 = new Set(Array.from({ length: 20000 }, (_, p) => mixSeed(1001, p)));
    expect(run1.size).toBe(20000);
    for (const s of [1002, 1003, 1031]) expect(Array.from({ length: 20000 }, (_, p) => mixSeed(s, p)).filter((x) => run1.has(x)).length).toBe(0);
  });
  it('the count varies between seeds as much as statistics says (independent paths), not less', () => {
    const returns = []; const lowRel = []; const rng = makeRng(7);
    for (let i = 0; i < 3000; i++) { const x = rng.normal() * 0.035; returns.push(x); lowRel.push(Math.min(0, x) - Math.abs(rng.normal()) * 0.01); }
    const ps = [];
    for (let s = 1; s <= 30; s++) ps.push(runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: 30 }, s0: 100, days: 180, nPaths: 2000, seed: s, liquidationBarrier: 70, logDriftPerDay: 0 }).pLiquidation);
    const m = ps.reduce((a, b) => a + b, 0) / ps.length;
    const sd = Math.sqrt(ps.reduce((a, b) => a + (b - m) ** 2, 0) / (ps.length - 1));
    const expected = Math.sqrt((m * (1 - m)) / 2000);
    expect(sd).toBeGreaterThan(0.6 * expected);
    expect(sd).toBeLessThan(1.6 * expected);
  });
});

describe('no built-in trend, also with recent days weighted more', () => {
  it('the simulated paths have no drift: their average log move is about 0, although the data rise', () => {
    const rng = makeRng(3); const returns = []; const lowRel = [];
    for (let i = 0; i < 4000; i++) { const x = 0.002 * (i / 4000) + rng.normal() * 0.03; returns.push(x); lowRel.push(Math.min(0, x)); } // rising, and faster lately
    const weights = recencyWeights(returns.length, 3 * 365);
    const r = runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, weights, blockDays: 30 }, s0: 100, days: 365, nPaths: 4000, seed: 9, liquidationBarrier: 0, logDriftPerDay: 0, collectMinRatios: true });
    // the middle price after a year: within 2% of today (without removing the trend: +40%)
    expect(Math.abs(r.fanByMonth.at(-1).q50 / 100 - 1)).toBeLessThan(0.02);
  });
});
