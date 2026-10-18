// Live price: tries the sources in order, gives up on slow ones, and falls back
// to the price embedded in the page with a "stale" flag. Uses fake network
// answers so it runs offline. Whether each real source allows browser requests
// (CORS) is checked by hand in a real browser in phase 3 and written in the README.
import { describe, it, expect } from 'vitest';
import { getSpotPrice, SOURCES } from '../src/live/price.js';

const embedded = { EUR: { price: 50000, time: 1760000000 }, USD: { price: 58000, time: 1760000000 } };
const answers = {
  bitstamp: { data: { pair: 'BTC/EUR', ohlc: [{ timestamp: '1760000000', open: '61000.00', high: '61010.00', low: '60990.00', close: '61000.12', volume: '0.5' }] } },
  coinbase: { data: { amount: '61001.50' } },
};
const sourceOf = (url) => SOURCES.find((s) => url.includes(s));

function fakeFetch({ fail = [], slow = [] } = {}) {
  const calls = [];
  const f = async (url, { signal } = {}) => {
    const s = sourceOf(url);
    calls.push(s);
    if (slow.includes(s)) {
      await new Promise((res, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted'))));
    }
    if (fail.includes(s)) throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => answers[s] };
  };
  f.calls = calls;
  return f;
}

describe('live price fallback chain', () => {
  it('order is Bitstamp (EU; already used for the recent hours) -> Coinbase (EU-US Data Privacy Framework); no other service', () => {
    expect(SOURCES).toEqual(['bitstamp', 'coinbase']);
  });
  it('uses the first source that answers', async () => {
    const r = await getSpotPrice('EUR', { fetchImpl: fakeFetch(), timeoutMs: 200, embedded });
    expect(r).toMatchObject({ price: 61000.12, source: 'bitstamp', stale: false });
    expect(r.time).toEqual(expect.any(Number));
  });
  it('skips failing sources', async () => {
    const f = fakeFetch({ fail: ['bitstamp'] });
    const r = await getSpotPrice('EUR', { fetchImpl: f, timeoutMs: 200, embedded });
    expect(r).toMatchObject({ price: 61001.5, source: 'coinbase', stale: false });
    expect(f.calls).toEqual(['bitstamp', 'coinbase']);
  });
  it('gives up on a source that is too slow', async () => {
    const r = await getSpotPrice('EUR', { fetchImpl: fakeFetch({ slow: ['bitstamp'] }), timeoutMs: 50, embedded });
    expect(r.source).toBe('coinbase');
  });
  it('rejects nonsense answers (zero, negative, not a number) and moves on', async () => {
    for (const bad of ['0', '-5', 'abc']) {
      const f = async (url) => ({ ok: true, json: async () => (sourceOf(url) === 'bitstamp' ? { data: { ohlc: [{ close: bad }] } } : answers[sourceOf(url)]) });
      const r = await getSpotPrice('EUR', { fetchImpl: f, timeoutMs: 200, embedded });
      expect(r.source).toBe('coinbase');
    }
    const empty = async (url) => ({ ok: true, json: async () => (sourceOf(url) === 'bitstamp' ? { data: { ohlc: [] } } : answers[sourceOf(url)]) });
    expect((await getSpotPrice('EUR', { fetchImpl: empty, timeoutMs: 200, embedded })).source).toBe('coinbase');
  });
  it('all sources down -> embedded last-known price, marked stale', async () => {
    const r = await getSpotPrice('USD', { fetchImpl: fakeFetch({ fail: SOURCES }), timeoutMs: 50, embedded });
    expect(r).toEqual({ price: 58000, source: 'embedded', time: 1760000000, stale: true });
  });
  it('sends no user data: only fixed public price URLs are requested', async () => {
    const urls = [];
    const f = async (url) => { urls.push(url); throw new TypeError('offline'); };
    await getSpotPrice('EUR', { fetchImpl: f, timeoutMs: 50, embedded });
    for (const u of urls) expect(u).toMatch(/^https:\/\/[a-z.]+\/[\w/.\-?=&,]*$/);
    for (const u of urls) expect(u).not.toMatch(/loan|ltv|amount=/i);
  });
});
