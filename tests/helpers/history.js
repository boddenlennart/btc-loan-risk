// Loads the hourly price history for tests.
// Phase 1: reads the raw exchange downloads (data/raw, made by tools/fetch_history.py).
// Phase 2 adds the compressed copy embedded in the page, and data.test.js checks
// that both are identical.
import { readFileSync, existsSync } from 'node:fs';

const cache = {};

export function rawPath(currency) {
  return new URL(`../../data/raw/btc-${currency.toLowerCase()}-1h.csv`, import.meta.url);
}

export function hasRaw(currency) {
  return existsSync(rawPath(currency));
}

export function loadHourly(currency) {
  if (cache[currency]) return cache[currency];
  const lines = readFileSync(rawPath(currency), 'utf8').trim().split('\n').slice(1);
  const n = lines.length;
  const h = { time: new Float64Array(n), open: new Float64Array(n), high: new Float64Array(n), low: new Float64Array(n), close: new Float64Array(n), volume: new Float64Array(n) };
  lines.forEach((line, i) => {
    const [t, o, hi, lo, c, v] = line.split(',');
    h.time[i] = +t; h.open[i] = +o; h.high[i] = +hi; h.low[i] = +lo; h.close[i] = +c; h.volume[i] = +v;
  });
  return (cache[currency] = h);
}
