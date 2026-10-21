// Compares the computed hourly BTC prices (BTC/EUR × ECB rate) with real exchange prices where an
// exchange has the pair: Kraken (last 30 days: CHF, GBP, CAD, AUD) and Bitstamp (GBP, a few
// windows since 2021). Used by the weekly data update; also runnable by hand:
//   node tools/check-fx.mjs
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeHourly } from '../src/data/codec.js';
import { parseEcbCsv, convertHourly } from '../src/data/fx.js';

const root = new URL('../', import.meta.url);
const q = (s, f) => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))];

/** Typical and large differences of closing prices, in percent, over the hours both have. */
export function compare(computed, real) {
  const byTime = new Map(); computed.time.forEach((t, i) => byTime.set(t, computed.close[i]));
  const d = real.filter((c) => byTime.has(c.time)).map((c) => Math.abs(Math.log(byTime.get(c.time) / c.close))).sort((a, b) => a - b);
  return { hours: d.length, median: d.length ? q(d, 0.5) * 100 : NaN, p95: d.length ? q(d, 0.95) * 100 : NaN };
}

async function kraken(cur) {
  const j = await (await fetch(`https://api.kraken.com/0/public/OHLC?pair=XBT${cur}&interval=60`)).json();
  return (Object.values(j.result).find(Array.isArray) || []).map((r) => ({ time: r[0], close: Number(r[4]) }));
}
async function bitstamp(cur, startIso) {
  const start = Date.parse(`${startIso}T00:00Z`) / 1000;
  const j = await (await fetch(`https://www.bitstamp.net/api/v2/ohlc/btc${cur.toLowerCase()}/?step=3600&limit=1000&start=${start}`)).json();
  return ((j.data || {}).ohlc || []).map((r) => ({ time: Number(r.timestamp), close: Number(r.close) }));
}

/** Returns rows { pair, source, hours, median, p95 }. */
export async function crossCheckFx(eurHourly, fx) {
  const rows = [];
  for (const cur of ['CHF', 'GBP', 'CAD', 'AUD']) {
    try { rows.push({ pair: `BTC/${cur}`, source: 'Kraken, last 30 days', ...compare(convertHourly(eurHourly, fx, cur), await kraken(cur)) }); } catch (e) { rows.push({ pair: `BTC/${cur}`, source: 'Kraken', error: String(e.message || e) }); }
  }
  for (const start of ['2021-03-01', '2022-11-01', '2024-08-01']) {
    try { rows.push({ pair: 'BTC/GBP', source: `Bitstamp, 6 weeks from ${start}`, ...compare(convertHourly(eurHourly, fx, 'GBP'), await bitstamp('GBP', start)) }); } catch (e) { rows.push({ pair: 'BTC/GBP', source: `Bitstamp ${start}`, error: String(e.message || e) }); }
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const eur = decodeHourly(gunzipSync(readFileSync(new URL('data/btc-eur-1h.bin.gz', root))));
  const fx = parseEcbCsv(readFileSync(new URL('data/fx-ecb.csv', root), 'utf8'), { fromIso: '1999-01-01' });
  for (const r of await crossCheckFx(eur, fx)) {
    console.log(r.error ? `${r.pair} (${r.source}): ${r.error}` : `${r.pair.padEnd(8)} ${r.source.padEnd(34)} ${String(r.hours).padStart(4)} h  typical difference ${r.median.toFixed(2)}%  95% of hours within ${r.p95.toFixed(2)}%`);
  }
}
