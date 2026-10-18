// The three-page site: the "fastest fall" line under the answer, and the page addresses per language.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fastestFall, largestFall } from '../src/engine/history.js';
import { loadHourly, hasData } from './helpers/history.js';

const H = 3600;
const series = (closes, lows = closes, gapAt = -1) => {
  const time = []; let t = 0;
  for (let i = 0; i < closes.length; i++) { time.push(t); t += i === gapAt ? 100 * H : H; }
  return { time, close: closes, low: lows };
};
// the slow way: every start hour, every later hour
const slow = (h, drop) => {
  let best = null;
  for (let i = 0; i < h.close.length; i++) for (let j = i + 1; j < h.close.length; j++) {
    if (h.low[j] <= (1 - drop) * h.close[i]) { const hrs = (h.time[j] - h.time[i]) / H; if (best === null || hrs < best) best = hrs; break; }
  }
  return best;
};

describe('fastest fall (the line under the answer)', () => {
  it('counts clock hours from a close to a later low; never = null', () => {
    const h = series([100, 100, 90, 80, 70, 60], [100, 100, 90, 80, 70, 60]);
    expect(fastestFall(h, 0.1)).toBe(1);
    expect(fastestFall(h, 0.3)).toBe(3);
    expect(fastestFall(h, 0.5)).toBe(null);
    expect(largestFall(h)).toBeCloseTo(0.4, 12);
  });
  it('an hour with a deep low (a wick) counts, not only the close', () => {
    expect(fastestFall(series([100, 100, 100], [100, 55, 100]), 0.4)).toBe(1);
  });
  it('a gap in the data (exchange offline) counts as the hours that really passed', () => {
    const h = series([100, 100, 50], [100, 100, 50], 1); // 100 hours between the 2nd and 3rd price
    expect(fastestFall(h, 0.5)).toBe(100);
  });
  it('equals the slow way of checking every start hour on random prices', () => {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 30; k++) {
      const closes = []; const lows = []; let p = 100;
      for (let i = 0; i < 120; i++) { p *= Math.exp((rnd() - 0.5) * 0.2); closes.push(p); lows.push(p * (1 - rnd() * 0.15)); }
      const h = series(closes, lows, k % 3 === 0 ? 40 : -1);
      for (const d of [0.05, 0.2, 0.4, 0.6]) expect(fastestFall(h, d), `run ${k}, drop ${d}`).toBe(slow(h, d));
    }
  });
  it.skipIf(!hasData('EUR'))('on the real euro history: deeper falls never came faster than shallower ones', () => {
    const h = loadHourly('EUR');
    const hrs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((d) => fastestFall(h, d));
    for (let i = 1; i < hrs.length; i++) expect(hrs[i]).toBeGreaterThanOrEqual(hrs[i - 1]);
    expect(fastestFall(h, largestFall(h) + 0.01)).toBe(null);
  });
});

describe('page addresses per language', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  const at = async (pathname) => { vi.stubGlobal('location', { pathname }); return import('../src/app/i18n.js'); };
  it('each page has an English and a German address, also inside a test copy in a subfolder', async () => {
    let m = await at('/method/');
    expect(m.currentPage()).toBe('method/');
    expect(m.pageHref('', 'de')).toBe('/de/');
    expect(m.pageHref('insights/', 'de')).toBe('/de/insights/');
    vi.resetModules();
    m = await at('/de/insights/');
    expect(m.currentPage()).toBe('insights/');
    expect(m.pageHref('method/', 'en')).toBe('/method/');
    vi.resetModules();
    m = await at('/copy/de/');
    expect(m.currentPage()).toBe('');
    expect(m.pageHref('method/', 'en')).toBe('/copy/method/');
  });
});
