// Live price: tries the sources in order, gives up on slow ones, and falls back
// to the price embedded in the page with a "stale" flag. Uses fake network
// answers so it runs offline. Whether each real source allows browser requests
// (CORS) is checked by hand in a real browser in phase 3 and written in the README.
import { describe, it, expect } from 'vitest';
import { getSpotPrice, SOURCES } from '../src/live/price.js';

const embedded = { EUR: { price: 50000, time: 1760000000 }, USD: { price: 58000, time: 1760000000 } };
const answers = {
  coinbase: { data: { amount: '61000.12' } },
  kraken: { result: { XXBTZEUR: { c: ['61001.50', '0.1'] } } },
  binance: { price: '61002.00' },
  coingecko: { bitcoin: { eur: 61003 } },
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
  it('order is Coinbase -> Kraken -> Binance -> CoinGecko', () => {
    expect(SOURCES).toEqual(['coinbase', 'kraken', 'binance', 'coingecko']);
  });
  it('uses the first source that answers', async () => {
    const r = await getSpotPrice('EUR', { fetchImpl: fakeFetch(), timeoutMs: 200, embedded });
    expect(r).toMatchObject({ price: 61000.12, source: 'coinbase', stale: false });
    expect(r.time).toEqual(expect.any(Number));
  });
  it('skips failing sources', async () => {
    const f = fakeFetch({ fail: ['coinbase', 'kraken'] });
    const r = await getSpotPrice('EUR', { fetchImpl: f, timeoutMs: 200, embedded });
    expect(r).toMatchObject({ price: 61002, source: 'binance', stale: false });
    expect(f.calls).toEqual(['coinbase', 'kraken', 'binance']);
  });
  it('gives up on a source that is too slow', async () => {
    const r = await getSpotPrice('EUR', { fetchImpl: fakeFetch({ slow: ['coinbase'] }), timeoutMs: 50, embedded });
    expect(r.source).toBe('kraken');
  });
  it('rejects nonsense answers (zero, negative, not a number) and moves on', async () => {
    const f = async (url) => ({ ok: true, json: async () => (sourceOf(url) === 'coinbase' ? { data: { amount: '0' } } : answers[sourceOf(url)]) });
    const r = await getSpotPrice('EUR', { fetchImpl: f, timeoutMs: 200, embedded });
    expect(r.source).toBe('kraken');
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
