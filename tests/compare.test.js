// Comparing offers (ux/C-design-spec.md, section 9): all offers on the same simulated futures,
// so differences come only from the terms; refinancing starts from the current loan.
import { describe, it, expect, beforeAll } from 'vitest';
import * as job from '../src/app/riskjob.js';
import { loadHourly, hasData } from './helpers/history.js';
import { toBase64, fitGarch } from './helpers/regression.js';
import { toTerms, refiForm, switchCosts, withSwitching } from '../src/app/terms.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';
import { loanSummary, liquidationPrices } from '../src/engine/loan.js';

const A = { ...EXAMPLE_FORM, btcPrice: 70000, simPaths: '2000' };
const run = (form, others = [], base) => {
  const { terms, settings } = toTerms(form, { base });
  return job.run(0, terms, { ...settings, compareTerms: others.map((o) => (o ? toTerms(o.form, { base: o.base }).terms : null)) }, garch, () => {});
};
let garch;

describe('refinancing terms (no data needed)', () => {
  const current = { ...EXAMPLE_FORM, mode: 'existing', loanAmount: 10000, collateralBtc: '0.28', durationMonths: 8, btcPrice: 70000 };
  it('same amount: the new loan repays today\'s debt against the same BTC', () => {
    const r = refiForm({ ...EXAMPLE_FORM, refi: { change: 'same' } }, current);
    expect([r.loanAmount, r.collateralBtc, r.mode, r.ltvInput]).toEqual([10000, '0.28', 'new', 'btc']);
  });
  it('borrow more: the debt grows by the extra cash, the BTC stays; the LTV rises', () => {
    const { terms } = toTerms({ ...EXAMPLE_FORM, refi: { change: 'more', extra: 5000 } }, { base: current });
    expect(terms.loanAmount).toBe(15000);
    expect(terms.initialLtv).toBeCloseTo(15000 / (0.28 * 70000), 12);
  });
  it('take back BTC: the debt stays, the BTC shrinks', () => {
    const { terms } = toTerms({ ...EXAMPLE_FORM, refi: { change: 'back', back: '0.05' } }, { base: current });
    expect(terms.loanAmount).toBe(10000);
    expect(terms.initialLtv).toBeCloseTo(10000 / (0.23 * 70000), 12);
  });
  it('switching costs count like a fee in the cost figures: less received, the same payback, a higher cost', () => {
    const tm = { loanAmount: 10000, originationFee: { type: 'percent', value: 0.01 } };
    expect(withSwitching(tm, 0)).toBe(tm);
    expect(withSwitching(tm, 220).originationFee).toEqual({ type: 'fixed', value: 320 });
    expect(withSwitching({ loanAmount: 10000 }, 50).originationFee).toEqual({ type: 'fixed', value: 50 });
  });
  it('switching costs add up the early-repayment fee and other costs, and nothing else', () => {
    expect(switchCosts({ refi: { exitFee: '120', transferFee: 30 } })).toBe(150);
    expect(switchCosts({ refi: { exitFee: '' } })).toBe(0);
    expect(switchCosts(EXAMPLE_FORM)).toBe(0);
  });
});

describe.skipIf(!hasData('EUR'))('comparison on the real history', () => {
  beforeAll(() => { const h = loadHourly('EUR'); job.setData('EUR', toBase64(h)); garch = fitGarch(h); }, 120_000);

  it('two identical offers give identical numbers', async () => {
    const r = await run(A, [null, { form: A }]);
    expect(r.compare[1].pLiquidation).toBe(r.main.pLiquidation);
    expect(r.compare[1].cumulativeByMonth).toEqual(r.main.cumulativeByMonth);
  });
  it('an offer that differs only in fees differs only in cost, not in risk', async () => {
    const B = { ...A, originationFee: { value: 3, type: 'percent' } };
    const r = await run(A, [null, { form: B }]);
    expect(r.compare[1].pLiquidation).toBe(r.main.pLiquidation);
    expect(loanSummary(toTerms(B).terms).totalCost).toBeGreaterThan(loanSummary(toTerms(A).terms).totalCost);
  });
  it('each value in the table equals that offer\'s own full result when it is selected', async () => {
    const B = { ...A, initialLtv: 35, liquidationLtv: 85 };
    const C = { ...A, durationMonths: 24 };
    const r = await run(A, [null, { form: B }, { form: C }]);
    const own = (f) => run(f).then((x) => x.main.pLiquidation);
    expect(r.compare[1].pLiquidation).toBe(await own(B));
    expect(r.compare[2].pLiquidation).toBe(await own(C));
    expect(r.compare[1].pLiquidation).toBeLessThan(r.main.pLiquidation); // lower LTV, higher sale LTV
  }, 60_000);
  it('refinancing with the same amount, the same terms and no costs equals the current loan over the same months', async () => {
    const current = { ...A, mode: 'existing', loanAmount: 10000, collateralBtc: String(10000 / (0.5 * 70000)), durationMonths: 12 };
    const refi = { ...A, durationMonths: 24, originationFee: { value: 0, type: 'percent' }, refi: { change: 'same' } };
    const r = await run(current, [null, { form: refi, base: current }]);
    // the refinanced loan, followed for its first 12 months, behaves like the current loan
    expect(r.compare[1].cumulativeByMonth[11]).toBeCloseTo(r.main.pLiquidation, 2);
    expect(liquidationPrices(toTerms(refi, { base: current }).terms).atStart).toBeCloseTo(liquidationPrices(toTerms(current).terms).atStart, 6);
  }, 60_000);
});
