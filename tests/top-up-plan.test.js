// "Will you add BTC if the price falls?" (issue #22, decision 023): the borrower's plan, in the shared lender rules.
// Three ways: once at the margin call (the reserve), every month from the start, or whenever the LTV reaches a level
// (back to a lower one, from a budget, at once or after one or two days). The page's real history and simulation
// both step through lender.js; the independent Python programs check them (replay-rules.json, montecarlo-reference.json).
import { describe, it, expect } from 'vitest';
import { lenderRules, createLoanState, startPlan, stepLoan } from '../src/engine/lender.js';
import { toTerms } from '../src/app/terms.js';
import { validateTerms } from '../src/engine/validate.js';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';

// €10,000 at 50% LTV and a price of 20,000: 1 BTC pledged; no interest, so the debt stays 10,000
const base = {
  loanAmount: 10000, initialLtv: 0.5, btcPrice: 20000, marginCallLtv: 0.7, liquidationLtv: 0.8, durationMonths: 12,
  marginCallConsequence: 'warningOnly', liquidationSale: 'all', liquidationFee: { value: 0, basis: 'debt' }, startDate: '2026-01-15',
};
const step = (s, rules, o) => stepLoan(s, rules, { cure: 0, day: 1, debt: 10000, ...o });

describe('every month: an amount added as BTC, the first at the start', () => {
  const rules = lenderRules({ ...base, plan: { kind: 'monthly', amount: 300, months: 3 } });
  it('falls on the first day of each loan month (calendar months from the start date)', () => {
    expect(rules.plan.dueDays).toEqual([0, 31, 59]); // 15 Jan, 15 Feb, 15 Mar 2026
  });
  it('adds at the start price, then at the price when each month begins, and nothing after the last month', () => {
    const s = createLoanState(1);
    startPlan(s, rules, 20000);
    expect(s.c).toBeCloseTo(1 + 300 / 20000, 12);
    step(s, rules, { time: 1, dayIndex: 0, open: 21000, low: 20500, close: 21000 });
    step(s, rules, { time: 32, dayIndex: 31, open: 15000, low: 14900, close: 15000 });
    expect(s.c).toBeCloseTo(1 + 300 / 20000 + 300 / 15000, 12);
    step(s, rules, { time: 60, dayIndex: 59, open: 12000, low: 11900, close: 12000 });
    step(s, rules, { time: 91, dayIndex: 90, open: 12000, low: 11900, close: 12000 });
    expect(s.added).toBe(900);
    expect(s.addedBtc).toBeCloseTo(300 / 20000 + 300 / 15000 + 300 / 12000, 12);
  });
  it('stops when the loan is liquidated: a liquidated loan takes no more money', () => {
    const s = createLoanState(1); startPlan(s, rules, 20000);
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 10000, close: 10000 }); // far below the liquidation price
    expect(s.liquidation).not.toBeNull();
    step(s, rules, { time: 32, dayIndex: 31, open: 20000, low: 20000, close: 20000 });
    expect(s.added).toBe(300);
  });
});

describe('whenever the LTV gets too high: back to a lower LTV, from a budget', () => {
  const ltvRules = (budget, delayDays = 0) => lenderRules({ ...base, plan: { kind: 'ltv', at: 0.65, to: 0.5, budget, delayDays } });
  it('at once: at the price where the LTV reaches 65%, enough BTC to bring it back to 50%', () => {
    const rules = ltvRules(100000); const s = createLoanState(1);
    const trigger = 10000 / 0.65; // the price where 1 BTC carries 65%
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 15000, close: 15500 });
    expect(s.c * trigger * 0.5).toBeCloseTo(10000, 6); // LTV back to 50% at that price
    expect(s.added).toBeCloseTo(10000 / 0.5 - trigger, 6); // about 46% of the debt
    expect(s.liquidation).toBeNull();
  });
  it('again at the next fall, until the budget is used up', () => {
    const rules = ltvRules(6000); const s = createLoanState(1);
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 15000, close: 15000 }); // first top-up: about 4,615
    const first = s.added;
    expect(first).toBeLessThan(6000);
    step(s, rules, { time: 2, dayIndex: 1, open: 15000, low: 11000, close: 11000 }); // the LTV reaches 65% again (not yet 80%)
    expect(s.added).toBeCloseTo(6000, 9); // only what was left
    step(s, rules, { time: 3, dayIndex: 2, open: 11000, low: 10000, close: 10000 });
    expect(s.added).toBeCloseTo(6000, 9);
  });
  it('within one day: added at the close of the step one day later, if the LTV is still above 50% then', () => {
    const rules = ltvRules(100000, 1); const s = createLoanState(1);
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 15000, close: 15000 });
    expect(s.added).toBe(0);
    step(s, rules, { time: 2, dayIndex: 1, open: 15000, low: 14000, close: 14500 });
    expect(s.c * 14500 * 0.5).toBeCloseTo(10000, 6);
    expect(s.added).toBeCloseTo(20000 - 14500, 6);
  });
  it('within one day: nothing is added if the price has recovered by then', () => {
    const rules = ltvRules(100000, 1); const s = createLoanState(1);
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 15000, close: 15000 });
    step(s, rules, { time: 2, dayIndex: 1, open: 21000, low: 20500, close: 21000 });
    expect(s.added).toBe(0);
  });
  it('comes after the lender in the same step, like the reserve: a fall through 80% in one step is a liquidation', () => {
    const rules = ltvRules(100000); const s = createLoanState(1);
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 12000, close: 12500 }); // 12,000 is below 12,500 (80%)
    expect(s.liquidation).not.toBeNull();
    expect(s.added).toBe(0);
  });
});

describe('once at the margin call: the reserve, as before', () => {
  it('adds the amount at the margin-call price and counts it as money put in', () => {
    const rules = lenderRules({ ...base, reserveAmount: 2000 }); const s = createLoanState(1);
    step(s, rules, { time: 1, dayIndex: 0, open: 20000, low: 14000, close: 14500 });
    expect(s.topUp.btc).toBeCloseTo(2000 / (10000 / 0.7), 12);
    expect(s.added).toBe(2000);
    expect(s.addedBtc).toBeCloseTo(s.topUp.btc, 12);
  });
});

describe('the simulation reports the money put in', () => {
  it('every month, no sale possible: each future puts in the full amount; a liquidated one stops early', () => {
    // a market that never moves: every future adds all 3 instalments
    const t = { ...base, plan: { kind: 'monthly', amount: 300, months: 3 } };
    const flat = { returns: new Float64Array(400), lowRel: new Float64Array(400), weights: new Float64Array(400).fill(1), blockDays: 30 };
    const res = runMonteCarlo({ model: 'bootstrap', params: flat, s0: 20000, days: 365, nPaths: 50, seed: 1,
      loan: { debtByDay: new Float64Array(366).fill(10000), collateralBtc: 1, rules: lenderRules(t) }, countOnly: true });
    expect(res.added.mean).toBeCloseTo(900, 9);
    expect(res.added.meanLiquidated).toBe(null);
  });
});

describe('the form: one question, default "No"; nothing preset', () => {
  const ex = { ...EXAMPLE_FORM, btcPrice: 60000 };
  it('"No" (the default): no plan and no reserve, so the example is unchanged', () => {
    const { terms } = toTerms(ex);
    expect(terms.addPlan).toBe('none');
    expect(terms.plan).toBeNull();
    expect(terms.reserveAmount).toBe(0);
  });
  it('a way picked but not filled in: no plan yet (the answer changes once the fields are filled)', () => {
    expect(toTerms({ ...ex, addPlan: 'monthly' }).terms.plan).toBeNull();
    expect(toTerms({ ...ex, addPlan: 'monthly', monthlyAmount: 300 }).terms.plan).toBeNull();
    expect(toTerms({ ...ex, addPlan: 'ltv', topUpAt: 65, topUpTo: 50, topUpBudget: 5000 }).terms.plan).toBeNull(); // no speed chosen
  });
  it('filled in: the plan in fractions and days', () => {
    expect(toTerms({ ...ex, addPlan: 'monthly', monthlyAmount: 300, monthlyMonths: 12 }).terms.plan).toEqual({ kind: 'monthly', amount: 300, months: 12 });
    expect(toTerms({ ...ex, addPlan: 'ltv', topUpAt: 65, topUpTo: 50, topUpBudget: 5000, topUpDelay: '1' }).terms.plan)
      .toEqual({ kind: 'ltv', at: 0.65, to: 0.5, budget: 5000, delayDays: 1 });
    expect(toTerms({ ...ex, addPlan: 'once', reserveAmount: 2000 }).terms.reserveAmount).toBe(2000);
  });
  it('only the chosen way counts: a reserve left over from "once" does nothing under "every month"', () => {
    const { terms } = toTerms({ ...ex, addPlan: 'monthly', reserveAmount: 2000, monthlyAmount: 300, monthlyMonths: 12 });
    expect(terms.reserveAmount).toBe(0);
  });
  it('"No" is the stored default, so its button is the one pressed', () => {
    expect(EXAMPLE_FORM.addPlan).toBe('none');
    expect(toTerms({ ...ex, addPlan: 'something old' }).terms.addPlan).toBe('none'); // an unknown answer reads as "No"
  });
  it('a link shared before this change, with an amount kept ready, opens as "once at the margin call"; without one, as "No"', async () => {
    const { encodeState, decodeLink } = await import('../src/app/share.js');
    const { addPlan, ...old } = EXAMPLE_FORM; // no answer to the question in links made before it
    const kept = decodeLink(encodeState({ ...old, reserveAmount: 2000 })).form;
    expect(toTerms({ ...EXAMPLE_FORM, ...kept, btcPrice: 60000 }).terms).toMatchObject({ addPlan: 'once', reserveAmount: 2000 });
    const none = decodeLink(encodeState({ ...old, reserveAmount: 0 })).form;
    expect(toTerms({ ...EXAMPLE_FORM, ...none, btcPrice: 60000 }).terms.addPlan).toBe('none');
  });
  it('checks: months within the loan, the top-up level between the target and the liquidation LTV', () => {
    const codes = (form) => validateTerms(toTerms({ ...ex, ...form }).terms).errors.map((e) => e.code);
    expect(codes({ addPlan: 'monthly', monthlyAmount: 300, monthlyMonths: 13 })).toContain('MONTHS_TOO_MANY');
    expect(codes({ addPlan: 'monthly', monthlyAmount: -1, monthlyMonths: 3 })).toContain('ADD_NEGATIVE');
    expect(codes({ addPlan: 'ltv', topUpAt: 85, topUpTo: 50, topUpBudget: 5000, topUpDelay: '0' })).toContain('TOPUP_AT_INVALID');
    expect(codes({ addPlan: 'ltv', topUpAt: 65, topUpTo: 70, topUpBudget: 5000, topUpDelay: '0' })).toContain('TOPUP_TO_INVALID');
    expect(codes({ addPlan: 'monthly', monthlyAmount: 300, monthlyMonths: 12 })).toEqual([]);
  });
});

describe('a shared link keeps the plan', () => {
  it('the chosen way and its amounts travel in the link', async () => {
    const { encodeState, decodeLink } = await import('../src/app/share.js');
    const form = { ...EXAMPLE_FORM, addPlan: 'ltv', topUpAt: 65, topUpTo: 50, topUpBudget: 5000, topUpDelay: '1' };
    const back = decodeLink(encodeState(form)).form;
    expect(toTerms({ ...EXAMPLE_FORM, ...back, btcPrice: 60000 }).terms.plan).toEqual({ kind: 'ltv', at: 0.65, to: 0.5, budget: 5000, delayDays: 1 });
  });
});
