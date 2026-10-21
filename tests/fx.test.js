// The six currencies computed from the euro history (src/data/fx.js): reading the ECB file,
// the rate for each hour, the conversion, the checks, and the stored rates file itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEcbCsv, checkFx, rateForHours, convertHourly, lastRate, FX_CURRENCIES } from '../src/data/fx.js';
import { toCsv } from '../tools/update-fx.mjs';
import { compare } from '../tools/check-fx.mjs';

const T = (iso) => Date.parse(`${iso}Z`) / 1000;
const CSV = `Date,USD,CHF,GBP,CAD,AUD,CZK,PLN,
2026-10-16,1.12,0.93,0.84,1.59,1.62,24.3,4.37,
2026-10-15,1.12,0.92,0.85,1.58,1.61,24.2,4.36,
2026-10-14,1.12,0.91,N/A,1.57,1.60,24.1,4.35,`;

describe('reading the ECB file', () => {
  it('keeps the six currencies, oldest day first, from the given date', () => {
    const t = parseEcbCsv(CSV, { fromIso: '2026-10-15' });
    expect(t.days.map((d) => new Date(d * 86400000).toISOString().slice(0, 10))).toEqual(['2026-10-15', '2026-10-16']);
    expect(t.rates.CHF).toEqual([0.92, 0.93]);
    expect(Object.keys(t.rates)).toEqual(FX_CURRENCIES);
  });
  it('a missing value ("N/A") is caught by the checks', () => {
    expect(checkFx(parseEcbCsv(CSV, { fromIso: '2026-10-01' })).join()).toMatch(/impossible GBP rate NaN on 2026-10-14/);
  });
  it('a gap of more than 7 days and a move of more than 10% are caught; the 2015 Swiss franc event is known', () => {
    const t = { days: [100, 101, 110], rates: { CHF: [1, 1.2, 1.2] } };
    const p = checkFx(t).join();
    expect(p).toMatch(/gap of 9 days/);
    expect(p).toMatch(/CHF moved more than 10%/);
    const snb = Date.parse('2015-01-15T00:00Z') / 86400000;
    expect(checkFx({ days: [snb - 1, snb], rates: { CHF: [1.20, 1.03] } })).toEqual([]);
  });
});

describe('rate for each hour and conversion', () => {
  const t = parseEcbCsv(CSV, { fromIso: '2026-10-01' });
  it('an hour uses its own day\'s rate; a weekend uses the last published rate', () => {
    const r = rateForHours(t, 'CHF', [T('2026-10-15T03:00'), T('2026-10-16T23:00'), T('2026-10-18T12:00')]);
    expect([...r]).toEqual([0.92, 0.93, 0.93]);
  });
  it('BTC/CHF = BTC/EUR × CHF per EUR, for every price of the hour', () => {
    const eur = { time: [T('2026-10-15T10:00')], open: [70000], high: [71000], low: [69000], close: [70500], noTrade: [0] };
    const chf = convertHourly(eur, t, 'CHF');
    expect([chf.open[0], chf.high[0], chf.low[0], chf.close[0]]).toEqual([70000 * 0.92, 71000 * 0.92, 69000 * 0.92, 70500 * 0.92]);
    expect(lastRate(t, 'PLN')).toBe(4.37);
  });
  it('the CSV written by the update reads back unchanged', () => {
    const t2 = parseEcbCsv(toCsv(t), { fromIso: '1999-01-01' });
    expect(t2).toEqual(t);
  });
  it('the comparison with a real exchange reports typical and large differences in percent', () => {
    const computed = { time: [1, 2, 3, 4], close: [100, 100, 100, 100] };
    const r = compare(computed, [{ time: 1, close: 100 }, { time: 2, close: 101 }, { time: 3, close: 99 }, { time: 9, close: 1 }]);
    expect(r.hours).toBe(3);
    expect(r.median).toBeCloseTo(Math.log(101 / 100) * 100, 6);
  });
});

describe('the stored rates file data/fx-ecb.csv', () => {
  const t = parseEcbCsv(readFileSync(new URL('../data/fx-ecb.csv', import.meta.url), 'utf8'), { fromIso: '1999-01-01' });
  it('passes all checks and covers the whole price history (from Dec 2013)', () => {
    expect(checkFx(t)).toEqual([]);
    expect(new Date(t.days[0] * 86400000).toISOString().slice(0, 10) <= '2014-01-01').toBe(true);
  });
});
