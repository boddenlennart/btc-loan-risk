// Fetches today's BTC price from a chain of public sources, falling back to the
// last known price embedded in the page. Requests are plain public price URLs:
// nothing about the visitor or their loan is ever sent.

export const SOURCES = ['coinbase', 'kraken', 'binance', 'coingecko'];

const URLS = {
  coinbase: (c) => `https://api.coinbase.com/v2/prices/BTC-${c}/spot`,
  kraken: (c) => `https://api.kraken.com/0/public/Ticker?pair=XBT${c}`,
  // Binance has no BTC/USD market; BTC/USDT (a dollar stablecoin) is used as the USD price.
  binance: (c) => `https://api.binance.com/api/v3/ticker/price?symbol=BTC${c === 'USD' ? 'USDT' : c}`,
  coingecko: (c) => `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${c.toLowerCase()}`,
};

const PARSE = {
  coinbase: (j) => j.data.amount,
  kraken: (j) => Object.values(j.result)[0].c[0],
  binance: (j) => j.price,
  coingecko: (j, c) => j.bitcoin[c.toLowerCase()],
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
