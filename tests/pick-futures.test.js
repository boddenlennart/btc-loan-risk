// The futures chart: the 100 futures shown have exactly the answer's number of forced sales,
// spread evenly over the five sets (owner's question, 21 Oct 2026: 13 counted in the chart, 15 in the answer).
import { describe, it, expect } from 'vitest';
import { pickFutures } from '../src/app/pick-futures.js';
import { runMonteCarlo } from '../src/engine/montecarlo.js';

const pool = (nSold, nSafe) => ({ sold: Array.from({ length: nSold }, (_, i) => ({ id: `s${i}`, event: { day: 1 } })), safe: Array.from({ length: nSafe }, (_, i) => ({ id: `f${i}`, event: null })) });
const perSet = (paths) => [0, 1, 2, 3, 4].map((k) => paths.slice(k * 20, k * 20 + 20).filter((p) => p.event).length);

describe('picking the 100 futures for the chart', () => {
  it('has exactly the answer\'s number of sales, spread evenly over five sets of 20', () => {
    for (const n of [0, 1, 4, 13, 15, 17, 50, 99, 100]) {
      const paths = pickFutures(pool(100, 100), n);
      expect(paths).toHaveLength(100);
      expect(paths.filter((p) => p.event).length).toBe(n);
      const sets = perSet(paths);
      expect(Math.max(...sets) - Math.min(...sets)).toBeLessThanOrEqual(1);
      expect(new Set(paths.map((p) => p.id)).size).toBe(100); // no future twice
    }
    expect(perSet(pickFutures(pool(100, 100), 15))).toEqual([3, 3, 3, 3, 3]);
    expect(perSet(pickFutures(pool(100, 100), 17))).toEqual([4, 4, 3, 3, 3]);
  });
  it('takes the futures in the order the simulation made them (a random choice, not the worst or the best)', () => {
    const paths = pickFutures(pool(100, 100), 15);
    expect(paths.filter((p) => p.event).map((p) => p.id)).toEqual(Array.from({ length: 15 }, (_, i) => `s${i}`));
  });
  it('works when one group is small (almost no or almost only sales)', () => {
    expect(pickFutures(pool(3, 100), 3).filter((p) => p.event)).toHaveLength(3);
    const all = pickFutures(pool(100, 2), 98);
    expect(all).toHaveLength(100); expect(all.filter((p) => p.event)).toHaveLength(98);
  });
  it('the calculation keeps up to n futures with and n without a sale, each group in the order they came', () => {
    const loan = { debtByDay: Array(60).fill(80), collateralBtc: 1, rules: { liquidationLtv: 0.8, marginCallLtv: null, marginCallConsequence: 'warningOnly', liquidationSale: 'all', liquidationFee: { value: 0, basis: 'debt' }, curePeriodHours: 0 } };
    const r = runMonteCarlo({ model: 'gbm', params: { mu: 0, sigma: 0.04 }, s0: 100, days: 60, nPaths: 400, seed: 3, loan, samplePool: 50, samplePaths: 400 });
    const sold = r.samplePaths.filter((p) => p.event); const safe = r.samplePaths.filter((p) => !p.event);
    expect(r.samplePool.sold).toEqual(sold.slice(0, 50));
    expect(r.samplePool.safe).toEqual(safe.slice(0, 50));
    expect(sold.length).toBe(Math.round((r.pLiquidation + r.pPartial) * 400));
  });
});
