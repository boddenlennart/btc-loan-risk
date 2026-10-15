// Test 6 — Impossible terms are rejected with a code that maps to a plain-language
// message (the message texts themselves are checked in content.test.js).
import { describe, it, expect } from 'vitest';
import { validateTerms, ERROR_CODES } from '../src/engine/validate.js';

const ok = {
  currency: 'EUR', btcPrice: 50000, loanAmount: 10000, initialLtv: 0.5, marginCallLtv: 0.7,
  liquidationLtv: 0.8, durationMonths: 12, startDate: '2026-01-01', rate: { type: 'fixed', annual: 0.1 },
  repayment: 'interestOnly', compounding: 'none', dayCount: '30/360',
  originationFee: { type: 'percent', value: 0.01 }, liquidationFee: { value: 0.02, basis: 'debt' },
  earlyRepaymentFee: 0, curePeriodHours: 72, cureTargetLtv: 0.5, reserveAmount: 0,
  taxRateNow: 0, taxRateAtMaturity: 0,
};

const codes = (t) => validateTerms(t).errors.map((e) => e.code);

describe('valid terms pass', () => {
  it('the example loan is accepted', () => {
    expect(validateTerms(ok)).toEqual({ ok: true, errors: [] });
  });
  it('an existing loan whose LTV is already above the starting LTV of new offers is fine, as long as it is below the liquidation LTV', () => {
    expect(validateTerms({ ...ok, mode: 'existing', collateralInput: 0.3, initialLtv: 0.75 }).ok).toBe(true);
  });
  it('optional fields may be left empty', () => {
    expect(validateTerms({ ...ok, marginCallLtv: null, curePeriodHours: null }).ok).toBe(true);
  });
});

const bad = [
  ['liquidation LTV equal to initial LTV', { liquidationLtv: 0.5 }, 'LIQ_LTV_NOT_ABOVE_INITIAL', 'liquidationLtv'],
  ['liquidation LTV below initial LTV', { liquidationLtv: 0.4 }, 'LIQ_LTV_NOT_ABOVE_INITIAL', 'liquidationLtv'],
  ['liquidation LTV above 100%', { liquidationLtv: 1.1 }, 'LIQ_LTV_TOO_HIGH', 'liquidationLtv'],
  ['initial LTV zero', { initialLtv: 0 }, 'LTV_OUT_OF_RANGE', 'initialLtv'],
  ['initial LTV 100% or more', { initialLtv: 1 }, 'LTV_OUT_OF_RANGE', 'initialLtv'],
  ['margin call at or below initial LTV', { marginCallLtv: 0.5 }, 'MARGIN_LTV_OUT_OF_RANGE', 'marginCallLtv'],
  ['margin call at or above liquidation LTV', { marginCallLtv: 0.8 }, 'MARGIN_LTV_OUT_OF_RANGE', 'marginCallLtv'],
  ['negative interest rate', { rate: { type: 'fixed', annual: -0.01 } }, 'NEGATIVE_RATE', 'rate'],
  ['negative rate inside a variable path', { rate: { type: 'variable', path: [{ fromMonth: 0, annual: 0.05 }, { fromMonth: 3, annual: -0.02 }] } }, 'NEGATIVE_RATE', 'rate'],
  ['variable path not starting at month 0', { rate: { type: 'variable', path: [{ fromMonth: 2, annual: 0.05 }] } }, 'RATE_PATH_INVALID', 'rate'],
  ['variable path out of order', { rate: { type: 'variable', path: [{ fromMonth: 0, annual: 0.05 }, { fromMonth: 6, annual: 0.06 }, { fromMonth: 3, annual: 0.07 }] } }, 'RATE_PATH_INVALID', 'rate'],
  ['variable path beyond the loan end', { rate: { type: 'variable', path: [{ fromMonth: 0, annual: 0.05 }, { fromMonth: 12, annual: 0.06 }] } }, 'RATE_PATH_INVALID', 'rate'],
  ['zero duration', { durationMonths: 0 }, 'DURATION_INVALID', 'durationMonths'],
  ['fractional months', { durationMonths: 6.5 }, 'DURATION_INVALID', 'durationMonths'],
  ['zero loan amount', { loanAmount: 0 }, 'LOAN_AMOUNT_INVALID', 'loanAmount'],
  ['negative loan amount', { loanAmount: -5 }, 'LOAN_AMOUNT_INVALID', 'loanAmount'],
  ['BTC price zero', { btcPrice: 0 }, 'PRICE_INVALID', 'btcPrice'],
  ['negative origination fee', { originationFee: { type: 'percent', value: -0.01 } }, 'NEGATIVE_FEE', 'originationFee'],
  ['negative liquidation fee', { liquidationFee: { value: -0.01, basis: 'debt' } }, 'NEGATIVE_FEE', 'liquidationFee'],
  ['negative early-repayment fee', { earlyRepaymentFee: -0.01 }, 'NEGATIVE_FEE', 'earlyRepaymentFee'],
  ['fee as large as the loan', { originationFee: { type: 'fixed', value: 10000 } }, 'FEE_EXCEEDS_LOAN', 'originationFee'],
  ['negative cure period', { curePeriodHours: -1 }, 'CURE_NEGATIVE', 'curePeriodHours'],
  ['cure target above margin-call LTV', { cureTargetLtv: 0.75 }, 'CURE_TARGET_INVALID', 'cureTargetLtv'],
  ['negative reserve', { reserveAmount: -100 }, 'RESERVE_NEGATIVE', 'reserveAmount'],
  ['tax rate 100% or more', { taxRateNow: 1 }, 'TAX_RATE_INVALID', 'taxRateNow'],
  ['negative tax rate', { taxRateAtMaturity: -0.1 }, 'TAX_RATE_INVALID', 'taxRateAtMaturity'],
  ['BTC amount entered instead of LTV, but zero', { ltvInput: 'btc', collateralInput: 0 }, 'COLLATERAL_INVALID', 'collateralBtc'],
  ['existing loan already at the liquidation LTV', { mode: 'existing', collateralInput: 0.2, initialLtv: 0.85 }, 'EXISTING_LOAN_AT_LIQUIDATION', 'collateralBtc'],
  ['text where a number belongs', { loanAmount: 'abc' }, 'LOAN_AMOUNT_INVALID', 'loanAmount'],
];

describe('impossible terms are rejected', () => {
  for (const [name, change, code, field] of bad) {
    it(name, () => {
      const r = validateTerms({ ...ok, ...change });
      expect(r.ok).toBe(false);
      expect(r.errors).toContainEqual({ field, code });
    });
  }
  it('every error code used here is a known code', () => {
    for (const [, , code] of bad) expect(ERROR_CODES).toContain(code);
  });
  it('reports all problems at once, not just the first', () => {
    expect(codes({ ...ok, loanAmount: 0, durationMonths: 0 })).toEqual(
      expect.arrayContaining(['LOAN_AMOUNT_INVALID', 'DURATION_INVALID']),
    );
  });
});
