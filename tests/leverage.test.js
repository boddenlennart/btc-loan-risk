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
  it('after an automatic partial sale at the day\'s low 70 (30/70 BTC sold, debt 50 → 20), repay by selling: 0.5714 + 0.3 − 20/100 = 0.6714 BTC', () => {
    const r = run({ 5: 70 }, { marginCallConsequence: 'autoPartial' }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.endBtc.q50).toBeCloseTo(1 - 30 / 70 + 0.3 - 20 / 100, 10);
  });
  it('liquidation level 62.50, the day\'s low 55 (no fee): 50/55 BTC sold at 55, 0.0909 returned + 0.3 bought = 0.3909 BTC', () => {
    const r = run({ 10: 55 }, { marginCallConsequence: 'warningOnly' }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.liquidated).toBe(1);
    expect(r.leverage.endBtc.q50).toBeCloseTo(1 - 50 / 55 + 0.3, 12);
  });
  it('liquidated with a 4% fee on the debt: 52/55 = 0.9455 BTC sold at the day\'s low → 0.0545 + 0.3 = 0.3545 BTC', () => {
    const r = run({ 10: 55 }, { marginCallConsequence: 'warningOnly', liquidationFee: { value: 0.04, basis: 'debt' } }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } });
    expect(r.leverage.endBtc.q50).toBeCloseTo(1 - 52 / 55 + 0.3, 12);
  });
  it('how much: the middle value of each group, compared with keeping 1 BTC (by hand: −0.2, +0.3, −0.6455)', () => {
    const less = run({}, { marginCallConsequence: 'warningOnly' }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } }).leverage.middleDiff;
    expect(less.lessKept).toBeCloseTo(0.8 - 1, 12);
    expect([less.more, less.liquidated]).toEqual([null, null]); // empty groups have no middle value
    expect(run({}, {}, { leverage: { bought: 0.3, payback: 50, repay: 'cash' } }).leverage.middleDiff.more).toBeCloseTo(0.3, 12);
    const liq = run({ 10: 55 }, { marginCallConsequence: 'warningOnly', liquidationFee: { value: 0.04, basis: 'debt' } }, { leverage: { bought: 0.3, payback: 50, repay: 'sell' } }).leverage.middleDiff;
    expect(liq.liquidated).toBeCloseTo(0.3 - 52 / 55, 12);
  });
});

describe('how much BTC you keep after forced sales', () => {
  it('automatic partial sale at 70 → 57.1% kept; full liquidation at the day\'s low 55 (no fee) → 9.1% kept', () => {
    expect(run({ 5: 70 }, { marginCallConsequence: 'autoPartial' }).keptAfterSale.q50).toBeCloseTo(1 - 30 / 70, 12);
    expect(run({ 10: 55 }, { marginCallConsequence: 'warningOnly' }).keptAfterSale.q50).toBeCloseTo(1 - 50 / 55, 12);
  });
  it('no forced sale → nothing reported', () => {
    expect(run({}, {}).keptAfterSale).toBeUndefined();
  });
});
