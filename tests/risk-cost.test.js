// The cost of the liquidation risk (ux/M-risk-cost-spec.md): answers known in advance, the textbook
// option formula, and the margin-call premiums of the paper the definition comes from
// (K. Bell, "The Economics of Bitcoin Loan Margin Calls", March 2026, Table 2).
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { lenderRules, partialSaleBtc } from '../src/engine/lender.js';
import { downInCallAtBarrier, downInAsset, riskCostTextbook } from '../src/engine/barrier.js';

const flat = (n, debt = 5000) => new Float64Array(n + 1).fill(debt);
const loanOf = (btc, over = {}, debt = flat(60)) => ({ debtByDay: debt, collateralBtc: btc, rules: lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationFee: { value: 0, basis: 'debt' }, ...over }) });
const fixed = (steps, loan) => runMonteCarlo({ model: 'fixed', params: { steps }, s0: 100, days: 60, nPaths: 4, seed: 1, loan, riskCost: true });

describe('answers known in advance', () => {
  it('no sale: the cost of the risk is 0, and every future is without a sale', () => {
    const r = fixed([[0, 0]], loanOf(100));
    expect(r.riskCost).toMatchObject({ value: 0, se: 0, noSale: 1 });
  });
  // a steady fall of 2% a day passes the liquidation price 62.5 on day 24, whose low is 100 × 0.98^24 = 61.58:
  // the sale happens there (issue #7). Every future is the same, so the scaled end price is today's price 100.
  const p24 = 100 * 0.98 ** 24;
  it('a sale where the price fell through the liquidation price: the BTC that repaid the loan misses the rise back to the (scaled) end price', () => {
    // 5,000 of debt is repaid with 5,000 / 61.58 BTC, which miss 100 − 61.58.
    const r = fixed([[Math.log(0.98), Math.log(0.98)]], loanOf(100));
    expect(r.riskCost.value).toBeCloseTo((5000 / p24) * (100 - p24), 9);
    expect(r.riskCost.noSale).toBe(0);
  });
  it('the fee: 5% on the amount owed takes 250 / 61.58 more BTC, lost whole (worth the end price)', () => {
    const r = fixed([[Math.log(0.98), Math.log(0.98)]], loanOf(100, { liquidationFee: { value: 0.05, basis: 'debt' } }));
    expect(r.riskCost.value).toBeCloseTo((5000 / p24) * (100 - p24) + (250 / p24) * 100, 9);
  });
  it('a partial sale with a fee on the BTC sold: the repaid part misses the rise, the fee part is lost whole', () => {
    const over = { liquidationSale: 'partial', liquidationFee: { value: 0.03, basis: 'collateralSold' } };
    const steps = [[0, 0], [Math.log(0.6), Math.log(0.6)], ...Array(60).fill([0, 0])]; // day 2: down 40% and stays
    const r = fixed(steps, loanOf(100, over));
    const rules = lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, ...over });
    const b = partialSaleBtc(rules, 5000, 100, 60); // sold at the day's low 60, below the liquidation price 62.5
    expect(r.pPartial).toBe(1);
    expect(r.riskCost.value).toBeCloseTo(0.97 * b * (100 - 60) + 0.03 * b * 100, 6);
  });
});

describe('textbook option formula (smooth prices, constant volatility, interest rate 0)', () => {
  // the paper's loan: 1 BTC at 100,000, 50,000 lent for a year, sold whole at an LTV of 85% (58,824)
  const s0 = 100000; const debt = 50000; const H = debt / 0.85;
  const simulated = (sigma, fee, nPaths = 20000) => runMonteCarlo({
    model: 'gbm', params: { mu: 0, sigma }, s0, days: 365, nPaths, seed: 7, riskCost: true,
    loan: loanOf(1, { initialLtv: 0.5, liquidationLtv: 0.85, liquidationFee: fee }, flat(365, debt)),
  }).riskCost;

  it('the simulation of smooth prices agrees with the formula within its precision, with and without a fee', () => {
    for (const [sigma, fee, k] of [[0.5, { value: 0, basis: 'debt' }, 1], [0.57, { value: 0.05, basis: 'debt' }, 1 / 1.05]]) {
      const sim = simulated(sigma, fee);
      const formula = riskCostTextbook({ s0, debt, liquidationPrice: H, repaidShare: k, sigma, years: 1 });
      expect(Math.abs(sim.value - formula)).toBeLessThan(3 * sim.se);
    }
  }, 60_000);

  it('the two option formulas: a call struck at the barrier is worth less than the end price if touched, minus the barrier', () => {
    const o = { s0, barrier: H, sigma: 0.5, years: 1 };
    const call = downInCallAtBarrier(o); const asset = downInAsset(o);
    expect(call).toBeGreaterThan(0);
    expect(asset).toBeGreaterThan(call);
    // with an interest rate of 0: asset − call = H × (chance of touching), and the chance lies in (0, 1)
    const touch = (asset - call) / H;
    expect(touch).toBeGreaterThan(0.3); expect(touch).toBeLessThan(0.45);
  });

  it('reproduces the paper\'s margin-call premiums (Table 2: 0.6 / 2.1 / 4.8% of the loan) within 0.15 points', () => {
    // The paper prices the margin-call loan as a down-and-in call on the 0.85 BTC sold, struck at the
    // sale price, with continuous checking and an interest rate of 0. The formula gives 0.60 / 2.22 /
    // 4.73%; the paper's 2.1% at 40% is 0.1 points lower, within its own simulation's precision.
    for (const [sigma, paper] of [[0.3, 0.006], [0.4, 0.021], [0.5, 0.048]]) {
      const premium = riskCostTextbook({ s0, debt, liquidationPrice: H, sigma, years: 1 }) / debt;
      expect(Math.abs(premium - paper)).toBeLessThan(0.0015);
    }
  });
});
