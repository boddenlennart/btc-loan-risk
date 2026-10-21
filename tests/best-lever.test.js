// The one change suggested under the answer: the smallest step that clearly lowers the number
// (owner, 21 Oct 2026: "Starting LTV 5% → 0 of 100" for a loan at 25% asked for five times the BTC).
import { describe, it, expect } from 'vitest';
import { bestLever } from '../src/app/best-lever.js';

const of100 = (p) => Math.round(p * 100);
const L = (id, value, p) => ({ id, value, p });

describe('the suggested change', () => {
  it('a loan at 25% (8 of 100): starting LTV 20% (4 of 100), not 5% (0 of 100)', () => {
    const levers = [L('lowerLtv', 0.05, 0), L('lowerLtv', 0.15, 0.01), L('lowerLtv', 0.2, 0.04), L('higherLiq', 0.9, 0.05), L('shorter', 6, 0.03)];
    expect(bestLever(levers, 8, of100)).toEqual(L('lowerLtv', 0.2, 0.04)); // the LTV step first, even if halving the term gives 3
  });
  it('without an LTV step that clearly helps: the other change that lowers the number most', () => {
    const levers = [L('lowerLtv', 0.45, 0.52), L('higherLiq', 0.9, 0.36), L('shorter', 6, 0.37), L('reserve', 2000, 0.42)];
    expect(bestLever(levers, 54, of100)).toEqual(L('higherLiq', 0.9, 0.36));
  });
  it('takes a bigger LTV step only when the smaller one does not clearly help', () => {
    const levers = [L('lowerLtv', 0.45, 0.50), L('lowerLtv', 0.40, 0.38), L('lowerLtv', 0.30, 0.15)];
    expect(bestLever(levers, 54, of100).value).toBe(0.4); // 45%: 50, not clearly lower than 54; 40%: 38 is
  });
  it('clearly lower = at least a quarter and at least 1 point below the answer', () => {
    expect(bestLever([L('lowerLtv', 0.45, 0.07)], 8, of100)).toEqual(L('lowerLtv', 0.45, 0.07)); // nothing clearly lower: the best there is
    expect(bestLever([L('lowerLtv', 0.45, 0.06), L('lowerLtv', 0.4, 0.02)], 8, of100).value).toBe(0.45); // 6 ≤ 8 − 2
    expect(bestLever([L('lowerLtv', 0.45, 0), L('lowerLtv', 0.4, 0)], 1, of100).value).toBe(0.45);
  });
  it('suggests nothing when no change lowers the number', () => {
    expect(bestLever([L('lowerLtv', 0.45, 0.08), L('shorter', 6, 0.09)], 8, of100)).toBeNull();
    expect(bestLever([], 8, of100)).toBeNull();
    expect(bestLever(null, 8, of100)).toBeNull();
  });
});
