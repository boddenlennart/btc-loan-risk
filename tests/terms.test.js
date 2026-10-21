// The form-to-terms conversion and the key that decides whether the example answer
// computed by the build can be shown at once.
import { describe, it, expect } from 'vitest';
import { toTerms, exampleKey } from '../src/app/terms.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';

const ex = { ...EXAMPLE_FORM, btcPrice: 60000 };

describe('example key', () => {
  it('does not depend on the BTC price or the start date (the chance does not either)', () => {
    expect(exampleKey({ ...ex, btcPrice: 95000 })).toBe(exampleKey(ex));
    expect(exampleKey({ ...ex, startDate: '2027-03-01' })).toBe(exampleKey(ex));
  });
  it('changes with every term that changes the answer', () => {
    for (const change of [{ initialLtv: 40 }, { liquidationLtv: 85 }, { durationMonths: 6 }, { marginCallLtv: 75 }, { curePeriodHours: 24 },
      { currency: 'USD' }, { simPaths: '2000' }, { bootstrapBlockDays: 20 }, { mode: 'existing', collateralBtc: '0.3' }]) {
      expect(exampleKey({ ...ex, ...change }), JSON.stringify(change)).not.toBe(exampleKey(ex));
    }
  });
  it('the example form gives valid terms in fractions', () => {
    const { terms, settings } = toTerms(ex);
    expect(terms.initialLtv).toBe(0.5);
    expect(terms.liquidationLtv).toBe(0.8);
    expect(settings).toEqual({ nPaths: 10000, blockDays: 30, trend: 0 });
  });
});
