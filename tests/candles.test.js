// The checks used by the scheduled data update (tools/update-data.mjs).
import { describe, it, expect } from 'vitest';
import { checkSeries, crossCheck, dataAge } from '../src/data/candles.js';

const H = 3600;
const T0 = Date.parse('2026-10-01T00:00Z') / 1000;
const candle = (i, close = 100, extra = {}) => ({ time: T0 + i * H, open: close, high: close * 1.01, low: close * 0.99, close, volume: 1, ...extra });
const series = (n, f = () => 100) => Array.from({ length: n }, (_, i) => candle(i, f(i)));

describe('checking one series', () => {
  it('a clean series passes', () => {
    expect(checkSeries(series(48), { previousTime: T0 - H, previousClose: 100 })).toEqual([]);
  });
  it('finds a missing hour', () => {
    const s = series(10); s.splice(4, 1);
    expect(checkSeries(s).join()).toMatch(/gap of 1 hours/);
  });
  it('finds a gap to the existing history', () => {
    expect(checkSeries(series(3), { previousTime: T0 - 3 * H }).join()).toMatch(/gap of 2 hours/);
  });
  it('finds duplicates', () => {
    const s = series(5); s.push(candle(4));
    expect(checkSeries(s).join()).toMatch(/duplicate hour/);
  });
  it('finds impossible values: zero, negative, not a number, low above close', () => {
    expect(checkSeries([candle(0, 100, { low: 0 })]).join()).toMatch(/impossible low/);
    expect(checkSeries([candle(0, 100, { high: -1 })]).join()).toMatch(/impossible high/);
    expect(checkSeries([candle(0, NaN)]).join()).toMatch(/impossible close/);
    expect(checkSeries([candle(0, 100, { low: 101 })]).join()).toMatch(/inconsistent candle/);
  });
  it('finds a price that more than doubles or halves within one hour', () => {
    expect(checkSeries(series(3, (i) => (i === 2 ? 30 : 100))).join()).toMatch(/price jump/);
  });
});

describe('comparing two exchanges', () => {
  const a = series(200, (i) => 100 + Math.sin(i));
  it('nearly equal prices pass', () => {
    const b = a.map((c) => ({ ...c, close: c.close * 1.001, low: c.low * 1.001 }));
    const r = crossCheck(a, b);
    expect(r.ok).toBe(true);
    expect(r.stats.comparable).toBe(200);
    expect(r.stats.median).toBeCloseTo(Math.log(1.001), 6);
  });
  it('prices 1% apart all the time fail (typical difference above 0.5%)', () => {
    expect(crossCheck(a, a.map((c) => ({ ...c, close: c.close * 1.01 }))).ok).toBe(false);
  });
  it('one hour 6% apart fails and is named', () => {
    const b = a.map((c, i) => (i === 50 ? { ...c, close: c.close * 1.06 } : c));
    const r = crossCheck(a, b);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/2026-10-03T02:00/);
  });
  it('a much deeper hourly low on one exchange is listed for review, but does not fail', () => {
    const b = a.map((c, i) => (i === 10 ? { ...c, low: c.low * 0.8 } : c));
    const r = crossCheck(a, b);
    expect(r.ok).toBe(true);
    expect(r.lowFlags).toHaveLength(1);
  });
  it('the second exchange missing most hours fails', () => {
    expect(crossCheck(a, a.filter((_, i) => i % 3 === 0)).ok).toBe(false);
  });
  it('coverage only counts the hours the second exchange can have', () => {
    expect(crossCheck(a, a.slice(150)).ok).toBe(true); // second source starts later: fine
  });
});

describe('age of the embedded data (page warning after 45 days)', () => {
  const now = Date.parse('2026-12-01T00:00Z') / 1000;
  it('45 days old: no warning yet; 46 days: warning', () => {
    expect(dataAge(now - 45 * 86400, now).stale).toBe(false);
    expect(dataAge(now - 46 * 86400, now).stale).toBe(true);
  });
});
