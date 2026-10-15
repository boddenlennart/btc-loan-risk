// Data quality — the embedded history is complete and has no obvious bad prints.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadHourly, loadRaw, hasData, hasRaw } from './helpers/history.js';
import { toCents } from '../src/data/codec.js';

// Known gaps (exchange outages) and known extreme hourly wicks are listed here
// after being checked by hand; anything new fails the test until reviewed.
const known = JSON.parse(readFileSync(new URL('./fixtures/data-known-issues.json', import.meta.url)));
const START = Date.parse('2014-01-01T00:00Z') / 1000;

for (const currency of ['USD', 'EUR']) {
  describe.skipIf(!hasData(currency))(`${currency} hourly history`, () => {
    it.skipIf(!hasRaw(currency))('embedded data equals the raw exchange download, to the cent (later hours come from the weekly update)', () => {
      const h = loadHourly(currency);
      const raw = loadRaw(currency);
      expect(h.time.length).toBeGreaterThanOrEqual(raw.length);
      raw.forEach((r, i) => {
        if (h.time[i] !== r.time || toCents(h.open[i]) !== toCents(r.open) || toCents(h.high[i]) !== toCents(r.high)
          || toCents(h.low[i]) !== toCents(r.low) || toCents(h.close[i]) !== toCents(r.close) || h.noTrade[i] !== (r.volume === 0 ? 1 : 0)) {
          throw new Error(`difference at ${new Date(r.time * 1000).toISOString()}`);
        }
      });
    });
    it('starts on 2014-01-01 and is not older than 45 days (the page warns after that; run the data update)', () => {
      const h = loadHourly(currency);
      expect(h.time[0]).toBe(START);
      expect(Date.now() / 1000 - h.time.at(-1)).toBeLessThan(45 * 86400);
    });
    it('hours are in order and on the full hour', () => {
      const h = loadHourly(currency);
      for (let i = 1; i < h.time.length; i++) {
        expect(h.time[i] % 3600).toBe(0);
        if (h.time[i] <= h.time[i - 1]) throw new Error(`out of order at ${h.time[i]}`);
      }
    });
    it('every candle is consistent: low <= open, close <= high, all prices > 0', () => {
      const h = loadHourly(currency);
      for (let i = 0; i < h.time.length; i++) {
        const ok = h.low[i] > 0 && h.low[i] <= Math.min(h.open[i], h.close[i]) && h.high[i] >= Math.max(h.open[i], h.close[i]);
        if (!ok) throw new Error(`bad candle at ${new Date(h.time[i] * 1000).toISOString()}`);
      }
    });
    it('no unreviewed gaps longer than 6 hours', () => {
      const h = loadHourly(currency);
      const gaps = [];
      for (let i = 1; i < h.time.length; i++) {
        if (h.time[i] - h.time[i - 1] > 6 * 3600) gaps.push(new Date(h.time[i - 1] * 1000).toISOString());
      }
      expect(gaps).toEqual(known[currency].gaps);
    });
    it('no unreviewed hourly wicks deeper than 25% below the previous close', () => {
      const h = loadHourly(currency);
      const wicks = [];
      for (let i = 1; i < h.time.length; i++) {
        if (h.low[i] < 0.75 * h.close[i - 1]) wicks.push(new Date(h.time[i] * 1000).toISOString());
      }
      expect(wicks).toEqual(known[currency].wicks);
    });
    it('no unreviewed stretches of more than 24 hours without any trade (exchange offline)', () => {
      const h = loadHourly(currency);
      const quiet = [];
      let run = 0;
      for (let i = 0; i <= h.time.length; i++) {
        if (i < h.time.length && h.noTrade[i]) { run++; continue; }
        if (run > 24) quiet.push(new Date(h.time[i - run] * 1000).toISOString());
        run = 0;
      }
      expect(quiet).toEqual(known[currency].offline);
    });
  });
}
