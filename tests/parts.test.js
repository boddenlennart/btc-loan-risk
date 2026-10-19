// The page computes the answer, "Make it safer" and the slider/trends in three parallel workers on devices with
// several cores (UAT finding 7). Together they must give exactly what one run gives, number for number.
import { describe, it, expect, beforeAll } from 'vitest';
import * as job from '../src/app/riskjob.js';
import { loadHourly, hasData } from './helpers/history.js';
import { FROZEN_END, REFERENCE_LOANS, sliceHourly, toBase64, fitGarch, loanTerms, loanSettings } from './helpers/regression.js';

describe.skipIf(!hasData('USD') || !hasData('EUR'))('three parallel parts = one run', () => {
  const garch = {};
  beforeAll(() => {
    for (const cur of ['USD', 'EUR']) { const h = sliceHourly(loadHourly(cur), FROZEN_END); job.setData(cur, toBase64(h)); garch[cur] = fitGarch(h); }
  }, 120_000);
  // with partial sales, buying BTC (with and without repaying in cash), a margin call after a deadline
  for (const id of ['example-eur', 'auto-partial-eur', 'partial-everywhere-usd', 'buy-btc-sell-usd', 'buy-btc-cash-eur', 'test-offer-eur']) {
    it(id, async () => {
      const ref = REFERENCE_LOANS.find((r) => r.id === id);
      if (!ref) return;
      const t = loanTerms(ref); const st = loanSettings(ref); const g = garch[ref.currency];
      const all = await job.run(0, t, st, g, () => {});
      const [main, levers, extras] = await Promise.all(['main', 'levers', 'extras'].map((part) => job.run(0, t, { ...st, part }, g, () => {})));
      expect(main.main.pLiquidation).toBe(all.main.pLiquidation);
      expect(main.main.riskCost).toEqual(all.main.riskCost);
      expect(levers.levers).toEqual(all.levers);
      expect(levers.leverBase).toBe(all.leverBase);
      expect(extras.slider).toEqual(all.slider);
      expect(extras.trends).toEqual(all.trends);
    }, 120_000);
  }
});
