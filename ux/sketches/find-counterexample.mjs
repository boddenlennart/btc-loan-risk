import fc from 'fast-check';
import { liquidationPrices } from '../../src/engine/loan.js';
const base = { currency: 'EUR', btcPrice: 50000, loanAmount: 10000, marginCallLtv: null, startDate: '2026-01-01', compounding: 'none', dayCount: '30/360', originationFee: { type: 'percent', value: 0 } };
const arb = fc.record({ loanAmount: fc.double({ min: 100, max: 1e7, noNaN: true }), btcPrice: fc.double({ min: 1000, max: 1e6, noNaN: true }),
  ltvA: fc.double({ min: 0.05, max: 0.85, noNaN: true }), ltvB: fc.double({ min: 0.05, max: 0.85, noNaN: true }), liquidationLtv: fc.double({ min: 0.86, max: 0.99, noNaN: true }),
  durationMonths: fc.integer({ min: 1, max: 60 }), annual: fc.double({ min: 0, max: 0.3, noNaN: true }), repayment: fc.constantFrom('interestOnly', 'bullet', 'amortizing') });
try {
  fc.assert(fc.property(arb, (t) => {
    const [lo, hi] = [Math.min(t.ltvA, t.ltvB), Math.max(t.ltvA, t.ltvB)];
    const mk = (ltv) => ({ ...base, ...t, initialLtv: ltv, rate: { type: 'fixed', annual: t.annual } });
    const a = liquidationPrices(mk(lo)); const b = liquidationPrices(mk(hi));
    return b.atStart >= a.atStart - 1e-9 && b.atMaturity >= a.atMaturity - 1e-9;
  }), { numRuns: 200000 });
  console.log('no counterexample in 200,000 runs');
} catch (e) { console.log(e.message.split('\n').slice(0, 6).join('\n')); }
