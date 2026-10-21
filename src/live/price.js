// Fetches today's BTC price (EUR or USD), falling back to the last known price embedded in the page.
// Requests are plain public price URLs: nothing about the visitor or their loan is ever sent.
// Data minimisation: the page already loads recent hours from Bitstamp (EU), so Bitstamp also gives
// the current price (the close of the latest minute); only if it fails, Coinbase (certified under the
// EU-US Data Privacy Framework) is asked. Other currencies: the euro price × the ECB rate (src/app/main.js).

export const SOURCES = ['bitstamp', 'coinbase'];

const URLS = {
  // Bitstamp's ticker address does not allow requests from web pages; its candle address does
  bitstamp: (c) => `https://www.bitstamp.net/api/v2/ohlc/btc${c.toLowerCase()}/?step=60&limit=1`,
  coinbase: (c) => `https://api.coinbase.com/v2/prices/BTC-${c}/spot`,
};

const PARSE = {
  bitstamp: (j) => j.data.ohlc[j.data.ohlc.length - 1].close,
  coinbase: (j) => j.data.amount,
};

async function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Returns { price, source, time, stale }. fetchImpl and timeoutMs are injectable for tests. */
export async function getSpotPrice(currency, { fetchImpl = globalThis.fetch, timeoutMs = 4000, embedded } = {}) {
  for (const source of SOURCES) {
    try {
      const json = await fetchWithTimeout(fetchImpl, URLS[source](currency), timeoutMs);
      const price = Number(PARSE[source](json, currency));
      if (Number.isFinite(price) && price > 0) {
        return { price, source, time: Math.floor(Date.now() / 1000), stale: false };
      }
    } catch {
      // try the next source
    }
  }
  const e = embedded[currency];
  return { price: e.price, source: 'embedded', time: e.time, stale: true };
}
