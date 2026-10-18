// Health check on the newest data (runs after every weekly update): the same 12
// reference loans run through the whole risk calculation on the full current history,
// and every result must be valid. This catches new data that would break the page.
import { describe, it, expect, beforeAll } from 'vitest';
import * as job from '../src/app/riskjob.js';
import { loadHourly, hasData } from './helpers/history.js';
import { REFERENCE_LOANS, loanTerms, toBase64, fitGarch, resultsFor } from './helpers/regression.js';
import { loanDays } from '../src/engine/loan.js';

function noBadNumbers(o, path = '') {
  if (typeof o === 'number') { if (!Number.isFinite(o)) throw new Error(`${path} is ${o}`); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) noBadNumbers(v, `${path}.${k}`);
}
const share = (x) => expect(x).toBeGreaterThanOrEqual(0) || expect(x).toBeLessThanOrEqual(1);

describe.skipIf(!hasData('USD') || !hasData('EUR'))('reference loans on the newest data', () => {
  const garch = {};
  beforeAll(() => {
    for (const cur of ['USD', 'EUR']) { const h = loadHourly(cur); job.setData(cur, toBase64(h)); garch[cur] = fitGarch(h); }
  }, 120_000);
  for (const ref of REFERENCE_LOANS) {
    it(`${ref.id}: all results valid`, async () => {
      const r = await resultsFor(ref, job, garch[ref.currency]);
      noBadNumbers(r, ref.id);
      const k = r.risk;
      for (const p of [k.pLiquidation, k.pPartial, k.garch.pLiquidation, k.replay.liquidatedShare, k.replay.partialShare, k.barrier.p]) {
        expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1);
      }
      expect(k.pLiquidation + k.pPartial).toBeLessThanOrEqual(1);
      if (k.pMarginCall !== null) expect(k.pMarginCall).toBeLessThanOrEqual(1);
      // liquidation chance only grows month by month and ends at the total
      for (let i = 1; i < k.cumulativeByMonth.length; i++) expect(k.cumulativeByMonth[i]).toBeGreaterThanOrEqual(k.cumulativeByMonth[i - 1]);
      expect(k.cumulativeByMonth.at(-1)).toBeCloseTo(k.pLiquidation, 9);
      expect(k.cumulativeByMonth).toHaveLength(loanTerms(ref).durationMonths);
      const f = k.fanLastMonth; expect(f.q05 <= f.q25 && f.q25 <= f.q50 && f.q50 <= f.q75 && f.q75 <= f.q95).toBe(true);
      expect(k.samplePaths.count).toBe(100); // five sets of 20 for "show 20 other futures"
      expect(k.replay.starts).toBeGreaterThan(1000);
      expect(k.stories.length).toBeGreaterThanOrEqual(3);
      // a lower starting LTV never helps less than 3 points of random noise allow
      for (const l of k.levers.filter((x) => x.id === 'lowerLtv')) expect(l.p).toBeLessThanOrEqual(k.leverBase + 0.03);
      // "Make it safer" uses the answer's own paths: "your terms" and the slider at the visitor's LTV equal the headline exactly
      expect(k.leverBase).toBe(k.pLiquidation);
      const own = k.slider.find((x) => Math.abs(x.ltv - loanTerms(ref).initialLtv) < 1e-9);
      if (own) expect(own.p).toBe(k.pLiquidation);
      // the slider: higher LTV, never clearly lower risk
      for (let i = 1; i < k.slider.length; i++) expect(k.slider[i].p).toBeGreaterThanOrEqual(k.slider[i - 1].p - 0.03);
      if (loanTerms(ref).purpose === 'buy') {
        expect(k.leverage.more + k.leverage.lessKept + k.leverage.liquidated).toBeCloseTo(1, 9);
      }
      // a stronger trend never makes a sale more likely (tolerance for simulation noise)
      for (let i = 1; i < k.trends.length; i++) expect(k.trends[i].p).toBeLessThanOrEqual(k.trends[i - 1].p + 0.03);
      // loan arithmetic
      expect(r.loan.payments).toHaveLength(loanTerms(ref).durationMonths);
      expect(r.loan.totalPayback).toBeGreaterThanOrEqual(loanTerms(ref).loanAmount);
      expect(r.loan.liquidation[0]).toBeGreaterThan(0);
      expect(loanDays(loanTerms(ref))).toBeGreaterThan(27);
      share(r.facts.higherAfter1y);
    }, 60_000);
  }
});

// The six currencies computed from the euro history: every one gives valid results, and the
// liquidation chance stays close to the euro answer (the currencies move little against the
// euro compared with BTC). Measured on 17 Oct 2026: at most 1 of 100 apart for the example loan.
import { readFileSync } from 'node:fs';
import { parseEcbCsv, FX_CURRENCIES } from '../src/data/fx.js';
import { toTerms } from '../src/app/terms.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';

describe.skipIf(!hasData('EUR'))('currencies computed from the euro history', () => {
  const fx = parseEcbCsv(readFileSync(new URL('../data/fx-ecb.csv', import.meta.url), 'utf8'), { fromIso: '1999-01-01' });
  const run = async (cur) => {
    const { terms, settings } = toTerms({ ...EXAMPLE_FORM, currency: cur, btcPrice: 70000 });
    return (await job.run(0, terms, settings, null, () => {})).main.pLiquidation;
  };
  let eur;
  beforeAll(async () => {
    const b64 = toBase64(loadHourly('EUR'));
    job.setData('EUR', b64);
    for (const c of FX_CURRENCIES) job.setData(c, b64, null, { days: fx.days, rates: { [c]: fx.rates[c] } });
    eur = await run('EUR');
  }, 120_000);
  for (const c of FX_CURRENCIES) {
    it(`${c}: the example's liquidation chance is within 3 of 100 of the euro answer`, async () => {
      const p = await run(c);
      expect(Number.isFinite(p)).toBe(true);
      expect(Math.abs(p - eur)).toBeLessThanOrEqual(0.03);
    }, 60_000);
  }
});
