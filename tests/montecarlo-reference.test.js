// Maths audit (ux/K-math-audit.md): the page's simulation against an independent Python version
// (reference/reference_montecarlo.py) that reads the raw exchange downloads, builds its own daily
// series, takes the debt from the independent loan reference and applies the lender's rules from
// their written description. Both use the same random-number generator, so they draw the same
// 30-day pieces: every count must agree exactly, for 12 loans covering every rule, in EUR and USD.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { dailyFromHourly, dailyReturns, recencyWeights } from '../src/engine/history.js';
import { debtByDay, collateralBtc } from '../src/engine/loan.js';
import { lenderRules } from '../src/engine/lender.js';
import { loadHourly, hasData } from './helpers/history.js';
import { sliceHourly } from './helpers/regression.js';

const file = new URL('./fixtures/montecarlo-reference.json', import.meta.url);
const ref = existsSync(file) ? JSON.parse(readFileSync(file)) : null;

describe.skipIf(!ref)('simulation = independent Python reference (same random draws)', () => {
  for (const cur of ['EUR', 'USD']) {
    describe.skipIf(!hasData(cur))(cur, () => {
      const R = ref && ref.currencies[cur];
      let s = null;
      const data = () => {
        if (s) return s;
        const daily = dailyFromHourly(sliceHourly(loadHourly(cur), ref.until + 1));
        const { returns, lowRel } = dailyReturns(daily);
        s = { daily, returns, lowRel, weights: recencyWeights(returns.length, ref.halfLifeDays) };
        return s;
      };
      it('the same daily series: number of days, first day, last close, sum of all moves and lows', () => {
        const { daily, returns, lowRel } = data();
        expect(daily.time.length).toBe(R.days);
        expect(daily.time[0]).toBe(R.firstDay);
        expect(daily.close.at(-1)).toBeCloseTo(R.lastClose, 9);
        expect(returns.reduce((a, b) => a + b, 0)).toBeCloseTo(R.sumR, 9);
        expect(lowRel.reduce((a, b) => a + b, 0)).toBeCloseTo(R.sumL, 9);
      });
      for (const [name, c] of Object.entries(R ? R.cases : {})) {
        it(`${name}: liquidated, partly liquidated, margin calls and the cost of the risk agree exactly`, () => {
          const { returns, lowRel, weights } = data();
          const t = { ...c.terms, btcPrice: c.s0 };
          const res = runMonteCarlo({
            model: 'bootstrap', params: { returns, lowRel, weights, blockDays: ref.block }, s0: c.s0,
            days: debtByDay(t).length - 1, nPaths: ref.nPaths, seed: ref.seed, logDriftPerDay: 0,
            loan: { debtByDay: debtByDay(t), collateralBtc: collateralBtc(t), rules: lenderRules(t) },
            cureDays: Math.max(1, Math.ceil((t.curePeriodHours ?? 0) / 24)), samplePaths: 5, riskCost: true,
          });
          expect(Math.round(res.pLiquidation * ref.nPaths)).toBe(c.liquidated);
          expect(Math.round(res.pPartial * ref.nPaths)).toBe(c.partial);
          if (t.marginCallLtv) expect(Math.round(res.pMarginCall * ref.nPaths)).toBe(c.marginCall);
          // first five paths: for liquidated ones, the day of the first sale of any kind (as in the chart)
          expect(res.samplePaths.map((p) => (p.liquidated ? p.event.day : null))).toEqual(c.firstPathsLiquidationDay);
          // the cost of the risk (ux/M-risk-cost-spec.md), from each side's own sale records
          expect(Math.abs(res.riskCost.value - c.riskCost)).toBeLessThanOrEqual(1e-9 * Math.max(1, c.riskCost));
        }, 120_000);
      }
    });
  }
});
