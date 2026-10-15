// Test 3 — Interest, payback and APR match the reference spreadsheet to the cent.
// Plus the simple loan outputs (collateral, trigger prices, top-up, breakeven...).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildSchedule, loanSummary, collateralBtc, debtByDay, liquidationPrices, marginCallPrices,
  dropToLiquidation, topUpToCure, costIfLiquidated, breakevenReturn, earlyRepaymentCost,
} from '../src/engine/loan.js';

const cases = JSON.parse(readFileSync(new URL('./fixtures/loan-cases.json', import.meta.url)));
const cents = (x) => Math.round(x * 100);

describe('interest and repayment match reference/loan-reference.xlsx', () => {
  for (const c of cases) {
    describe(c.name, () => {
      it('every monthly row matches to the cent', () => {
        const rows = buildSchedule(c.terms);
        expect(rows).toHaveLength(c.expected.schedule.length);
        rows.forEach((row, i) => {
          const exp = c.expected.schedule[i];
          expect(row.date).toBe(exp.date);
          expect(cents(row.interest)).toBe(cents(exp.interest));
          expect(cents(row.principal)).toBe(cents(exp.principal));
          expect(cents(row.payment)).toBe(cents(exp.payment));
          expect(cents(row.balanceAfter)).toBe(cents(exp.balanceAfter));
        });
      });
      it('totals match to the cent and APR to 0.0001 percentage points', () => {
        const s = loanSummary(c.terms);
        for (const k of ['originationFee', 'amountReceived', 'totalInterest', 'totalPayback', 'totalCost']) {
          expect(cents(s[k]), k).toBe(cents(c.expected[k]));
        }
        expect(s.interestShareOfPayback).toBeCloseTo(c.expected.interestShareOfPayback, 8);
        expect(s.effectiveApr).toBeCloseTo(c.expected.effectiveApr, 6);
      });
    });
  }
});

// A simple loan used for the hand-checkable examples below:
// borrow 10,000 at BTC = 50,000, initial LTV 50% -> pledge 0.4 BTC.
const simple = {
  currency: 'EUR', btcPrice: 50000, loanAmount: 10000, initialLtv: 0.5, marginCallLtv: 0.7,
  liquidationLtv: 0.8, durationMonths: 12, startDate: '2026-01-01', rate: { type: 'fixed', annual: 0 },
  repayment: 'interestOnly', compounding: 'none', dayCount: '30/360',
  originationFee: { type: 'percent', value: 0 }, liquidationFee: { value: 0.05, basis: 'debt' },
  earlyRepaymentFee: 0.01,
};

describe('collateral and trigger prices (hand-checked)', () => {
  it('collateral = 10,000 / (50% x 50,000) = 0.4 BTC', () => {
    expect(collateralBtc(simple)).toBeCloseTo(0.4, 12);
  });
  it('liquidation price = 10,000 / (0.4 x 80%) = 31,250', () => {
    const p = liquidationPrices(simple);
    expect(p.atStart).toBeCloseTo(31250, 6);
    expect(p.atMaturity).toBeCloseTo(31250, 6); // 0% interest: debt never grows
  });
  it('margin-call price = 10,000 / (0.4 x 70%) = 35,714.29', () => {
    expect(marginCallPrices(simple).atStart).toBeCloseTo(35714.2857, 3);
  });
  it('no margin-call LTV in the offer -> no margin-call price', () => {
    expect(marginCallPrices({ ...simple, marginCallLtv: null })).toBeNull();
  });
  it('drop to liquidation = 1 - 31,250 / 50,000 = 37.5%', () => {
    expect(dropToLiquidation(simple)).toBeCloseTo(0.375, 12);
  });
});

describe('debt grows when interest is added to the loan', () => {
  const bullet = { ...simple, rate: { type: 'fixed', annual: 0.10 }, repayment: 'bullet', compounding: 'none' };
  it('starts at the loan amount', () => {
    expect(debtByDay(bullet)[0]).toBeCloseTo(10000, 6);
  });
  it('never falls during a bullet loan, and ends at loan + all interest', () => {
    const d = debtByDay(bullet);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1] - 1e-9);
    expect(d[d.length - 1]).toBeCloseTo(10000 + loanSummary(bullet).totalInterest, 2);
  });
  it('liquidation price at maturity = (10,000 + 999.96) / (0.4 x 80%) = 34,374.88', () => {
    expect(liquidationPrices(bullet).atMaturity).toBeCloseTo(34374.875, 2);
  });
  it('with an amortizing loan the debt and the liquidation price fall over time', () => {
    const am = { ...simple, rate: { type: 'fixed', annual: 0.10 }, repayment: 'amortizing' };
    const p = liquidationPrices(am);
    expect(p.atMaturity).toBeLessThan(p.atStart);
  });
});

describe('curing a margin call (hand-checked)', () => {
  // Price at margin call 35,714.29: 0.4 BTC worth 14,285.71, debt 10,000 (LTV 70%).
  // Back to 50% needs collateral worth 20,000 -> 0.56 BTC -> add 0.16 BTC (= 5,714.29).
  // Or repay cash: 10,000 - 50% x 14,285.71 = 2,857.14.
  const price = 10000 / (0.4 * 0.7);
  it('top-up BTC and value', () => {
    const t = topUpToCure(simple, { price, debt: 10000, targetLtv: 0.5 });
    expect(t.btc).toBeCloseTo(0.16, 10);
    expect(t.value).toBeCloseTo(5714.2857, 3);
    expect(t.repayInstead).toBeCloseTo(2857.1429, 3);
  });
});

describe('cost if liquidated (hand-checked)', () => {
  // Liquidated at 31,250 with debt 10,000 and a 5% fee on the debt:
  // lender takes 10,500 worth = 0.336 BTC, returns 0.064 BTC (= 2,000).
  it('fee charged on the debt', () => {
    const r = costIfLiquidated(simple, { price: 31250, debt: 10000 });
    expect(r.feeAmount).toBeCloseTo(500, 6);
    expect(r.btcSold).toBeCloseTo(0.336, 10);
    expect(r.btcReturned).toBeCloseTo(0.064, 10);
    expect(r.valueReturned).toBeCloseTo(2000, 6);
  });
  // Fee as 5% of the BTC sold: sold value S with S - 5% S = 10,000 -> S = 10,526.32.
  it('fee charged on the collateral sold', () => {
    const t = { ...simple, liquidationFee: { value: 0.05, basis: 'collateralSold' } };
    const r = costIfLiquidated(t, { price: 31250, debt: 10000 });
    expect(r.btcSold).toBeCloseTo(10000 / 0.95 / 31250, 10);
    expect(r.feeAmount).toBeCloseTo(10000 / 0.95 - 10000, 6);
  });
});

describe('breakeven BTC return versus selling now', () => {
  // You receive 9,800 (2% fee) and pay back 10,999.96 in total (10% interest-only).
  // Repaying by selling BTC at maturity, same tax rate both times:
  // BTC must rise by 10,999.96 / 9,800 - 1 = 12.245% for borrowing to come out ahead.
  const t = { ...simple, rate: { type: 'fixed', annual: 0.10 }, originationFee: { type: 'percent', value: 0.02 } };
  it('same tax rate now and later', () => {
    expect(breakevenReturn(t, { taxRateNow: 0.25, taxRateAtMaturity: 0.25 })).toBeCloseTo(10999.96 / 9800 - 1, 8);
  });
  it('a sale now is taxed, a sale at maturity is not -> borrowing needs less growth', () => {
    // (1 + R) = 10,999.96 x (1 - 0.25) / (9,800 x (1 - 0))
    expect(breakevenReturn(t, { taxRateNow: 0.25, taxRateAtMaturity: 0 })).toBeCloseTo((10999.96 * 0.75) / 9800 - 1, 8);
  });
});

describe('early repayment', () => {
  it('after month 6 of a 0% interest-only loan: 10,000 + 1% fee = 10,100', () => {
    expect(earlyRepaymentCost(simple, 6)).toBeCloseTo(10100, 6);
  });
});
