// Loads the hourly price history for tests: the same compressed files the page
// embeds (data/btc-*-1h.bin.gz). data.test.js checks them against the raw
// exchange downloads (data/raw, made by tools/fetch_history.py) when present.
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'fflate';
import { decodeHourly } from '../../src/data/codec.js';

const cache = {};
const embeddedPath = (c) => new URL(`../../data/btc-${c.toLowerCase()}-1h.bin.gz`, import.meta.url);
export const rawPath = (c) => new URL(`../../data/raw/btc-${c.toLowerCase()}-1h.csv`, import.meta.url);

export const hasData = (currency) => existsSync(embeddedPath(currency));
export const hasRaw = (currency) => existsSync(rawPath(currency));

export function loadHourly(currency) {
  if (!cache[currency]) cache[currency] = decodeHourly(gunzipSync(readFileSync(embeddedPath(currency))));
  return cache[currency];
}

export function loadRaw(currency) {
  return readFileSync(rawPath(currency), 'utf8').trim().split('\n').slice(1).map((line) => {
    const [time, open, high, low, close, volume] = line.split(',').map(Number);
    return { time, open, high, low, close, volume };
  });
}
