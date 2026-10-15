// The simulation follows the same lender rules as the replay, and the new
// "result counted in BTC" (profile: borrow to buy more BTC) is right.
// Every path here follows the same fixed, made-up price path, so each number
// can be checked by hand.
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { lenderRules } from '../src/engine/lender.js';

// 1 BTC pledged at 100, loan 50 (LTV 50%), 0% interest → debt stays 50.
// Margin call 70% → 71.43; liquidation 80% → 62.50; target after a sale 50%.
const terms = {
  loanAmount: 50, initialLtv: 0.5, marginCallLtv: 0.7, liquidationLtv: 0.8, liquidationFee: { value: 0, basis: 'debt' },
};
const days = 30;
const loan = (extra = {}) => ({ debtByDay: new Float64Array(days + 1).fill(50), collateralBtc: 1, rules: lenderRules({ ...terms, ...extra }) });
// daily steps [logReturn, logLowRelativeToPreviousClose]; the price stays at 100 except the given lows
function steps(lows) {
  return Array.from({ length: days }, (_, d) => [0, lows[d + 1] ? Math.log(lows[d + 1] / 100) : 0]);
}
const run = (lows, extra, more = {}) => runMonteCarlo({
  model: 'fixed', params: { steps: steps(lows) }, s0: 100, days, nPaths: 3, seed: 1, loan: loan(extra), ...more,
});

describe('simulation uses the same lender rules as the replay', () => {
  it('warning only, dip to 70: margin call, nothing sold', () => {
    const r = run({ 5: 70 }, { marginCallConsequence: 'warningOnly' });
    expect(r).toMatchObject({ pLiquidation: 0, pPartial: 0, pMarginCall: 1 });
  });
  it('automatic partial sale at the margin call, then a dip to 55 survives', () => {
    const r = run({ 5: 70, 10: 55 }, { marginCallConsequence: 'autoPartial' });
    expect(r).toMatchObject({ pLiquidation: 0, pPartial: 1, pMarginCall: 1 });
  });
  it('without the partial sale, the dip to 55 liquidates', () => {
    const r = run({ 5: 70, 10: 55 }, { marginCallConsequence: 'warningOnly' });
    expect(r.pLiquidation).toBe(1);
    expect(r.cumulativeByMonth.at(-1)).toBe(1);
  });
  it('sample paths report the day and kind of the first sale', () => {
    const r = run({ 5: 70 }, { marginCallConsequence: 'autoPartial' }, { samplePaths: 2 });
    expect(r.samplePaths).toHaveLength(2);
    expect(r.samplePaths[0].event).toEqual({ day: 5, kind: 'partial' });
    expect(r.samplePaths[0].weekly[0]).toBe(100);
  });
});

describe('result counted in BTC (borrow to buy more BTC)', () => {
  // Bought 0.3 BTC with the loan. Not borrowing = keeping 1 BTC.
  it('nothing happens, repay by selling at 100: 1 + 0.3 − 50/100 = 0.8 BTC → less than without the loan', () => {
    const r = run({}, { marginCallConsequence: 'warningOnly' }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.endBtc.q50).toBeCloseTo(0.8, 12);
    expect(r.leverage).toMatchObject({ more: 0, lessKept: 1, liquidated: 0 });
  });
  it('repay with new money instead: 1 + 0.3 = 1.3 BTC → more', () => {
    const r = run({}, {}, { leverage: { bought: 0.3, payback: 50, repay: 'cash' } });
    expect(r.leverage.endBtc.q50).toBeCloseTo(1.3, 12);
    expect(r.leverage.more).toBe(1);
  });
  it('after an automatic partial sale (0.4 BTC sold, debt 50 → 21.43), repay by selling: 0.6 + 0.3 − 21.43/100 = 0.6857 BTC', () => {
    const r = run({ 5: 70 }, { marginCallConsequence: 'autoPartial' }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.endBtc.q50).toBeCloseTo(0.6 + 0.3 - (50 * (21.4285714 / 50)) / 100, 6);
  });
  it('liquidated at 62.50 (no fee): 0.8 BTC sold, 0.2 returned + 0.3 bought = 0.5 BTC', () => {
    const r = run({ 10: 55 }, { marginCallConsequence: 'warningOnly' }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.liquidated).toBe(1);
    expect(r.leverage.endBtc.q50).toBeCloseTo(0.5, 12);
  });
  it('liquidated with a 4% fee on the debt: 52/62.5 = 0.832 BTC sold → 0.168 + 0.3 = 0.468 BTC', () => {
    const r = run({ 10: 55 }, { marginCallConsequence: 'warningOnly', liquidationFee: { value: 0.04, basis: 'debt' } }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.endBtc.q50).toBeCloseTo(0.468, 12);
  });
});

describe('how much BTC you keep after forced sales', () => {
  it('automatic partial sale of 0.4 BTC → 60% kept; full liquidation at 62.50 (no fee) → 20% kept', () => {
    expect(run({ 5: 70 }, { marginCallConsequence: 'autoPartial' }).keptAfterSale.q50).toBeCloseTo(0.6, 12);
    expect(run({ 10: 55 }, { marginCallConsequence: 'warningOnly' }).keptAfterSale.q50).toBeCloseTo(0.2, 12);
  });
  it('no forced sale → nothing reported', () => {
    expect(run({}, {}).keptAfterSale).toBeUndefined();
  });
});
