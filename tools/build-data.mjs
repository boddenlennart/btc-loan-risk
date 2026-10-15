// Turns the raw exchange downloads (data/raw/*.csv) into the compressed files
// embedded in the page (data/btc-*-1h.bin.gz) plus data/meta.json.
// Usage: node tools/build-data.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { encodeHourly } from '../src/data/codec.js';

const meta = {};
for (const cur of ['USD', 'EUR']) {
  const src = new URL(`../data/raw/btc-${cur.toLowerCase()}-1h.csv`, import.meta.url);
  if (!existsSync(src)) { console.warn(`skipping ${cur}: no raw file`); continue; }
  const rows = readFileSync(src, 'utf8').trim().split('\n').slice(1).map((line) => {
    const [time, open, high, low, close, volume, source] = line.split(',');
    return { time: +time, open: +open, high: +high, low: +low, close: +close, volume: +volume, source };
  });
  const gz = gzipSync(encodeHourly(rows), { level: 9 });
  writeFileSync(new URL(`../data/btc-${cur.toLowerCase()}-1h.bin.gz`, import.meta.url), gz);
  const last = rows.at(-1);
  const sources = [...new Set(rows.map((r) => r.source))];
  meta[cur] = { hours: rows.length, from: rows[0].time, to: last.time, lastClose: last.close, sources, bytes: gz.length };
  console.log(cur, rows.length, 'hours ->', (gz.length / 1024).toFixed(0), 'KB compressed');
}
const metaPath = new URL('../data/meta.json', import.meta.url);
const old = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
writeFileSync(metaPath, JSON.stringify({ ...old, ...meta }, null, 1));
