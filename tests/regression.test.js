// Regression (golden master): 12 reference loans that together use every main function
// (all repayment types, fees, variable rates, every margin-call rule, partial sales,
// reserve, existing loan, buy-more-BTC with both repayment ways, five price trends, taxes).
// On the frozen history (up to 2026-10-01, which new data never changes) every result
// must equal the stored golden file: payment plans, trigger prices, APR, simulation,
// GARCH, replay, stories, levers, slider, result counted in BTC, history facts.
// Any code change that moves a number fails here and names it.
// If a change is intended: run `node tools/update-golden.mjs` and explain it in the commit.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as job from '../src/app/riskjob.js';
import { loadHourly, hasData } from './helpers/history.js';
import { FROZEN_END, REFERENCE_LOANS, sliceHourly, toBase64, fitGarch, resultsFor } from './helpers/regression.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/regression-golden.json', import.meta.url)));

function firstDifference(a, b, path = '') {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) ? null : `${path}: now ${a}, golden ${b}`;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b ? null : `${path}: now ${JSON.stringify(a)}, golden ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const d = firstDifference(a[k], b[k], `${path}.${k}`); if (d) return d; }
  return null;
}

describe.skipIf(!hasData('USD') || !hasData('EUR'))('golden master on the frozen history', () => {
  const garch = {};
  beforeAll(() => {
    for (const cur of ['USD', 'EUR']) {
      const h = sliceHourly(loadHourly(cur), FROZEN_END);
      job.setData(cur, toBase64(h));
      garch[cur] = fitGarch(h);
    }
  }, 120_000);
  it('the GARCH fit is unchanged', () => {
    expect(firstDifference(JSON.parse(JSON.stringify(garch, (k, v) => (typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v))), golden.garch)).toBeNull();
  });
  it('covers 12 reference loans', () => expect(golden.loans.map((l) => l.id)).toEqual(REFERENCE_LOANS.map((r) => r.id)));
  for (const ref of REFERENCE_LOANS) {
    it(`${ref.id}: ${ref.uses}`, async () => {
      const now = await resultsFor(ref, job, golden.garch[ref.currency]);
      const g = golden.loans.find((l) => l.id === ref.id);
      expect(firstDifference(now, g, ref.id)).toBeNull();
    }, 60_000);
  }
});
