// What does "no trend" mean in the simulation, and how well can a trend be estimated from history?
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'fflate';
import { decodeHourly } from '../../src/data/codec.js';
import { dailyFromHourly, dailyReturns } from '../../src/engine/history.js';
import { runMonteCarlo } from '../../src/engine/montecarlo.js';
const h = decodeHourly(gunzipSync(readFileSync(new URL('../../data/btc-eur-1h.bin.gz', import.meta.url))));
const { returns, lowRel } = dailyReturns(dailyFromHourly(h));
const n = returns.length; const years = n / 365;
const mean = returns.reduce((a, b) => a + b, 0) / n;
const sd = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
console.log(`history: ${years.toFixed(1)} years; yearly log growth ${(mean * 365 * 100).toFixed(0)}% (= ${((Math.exp(mean * 365) - 1) * 100).toFixed(0)}% a year compound); yearly volatility ${(sd * Math.sqrt(365) * 100).toFixed(0)}%`);
const se = sd * Math.sqrt(365) / Math.sqrt(years);
console.log(`uncertainty of that growth estimate (1 standard error): ±${(se * 100).toFixed(0)} percentage points of log growth; 95% range of compound growth: ${((Math.exp(mean * 365 - 2 * se) - 1) * 100).toFixed(0)}% to ${((Math.exp(mean * 365 + 2 * se) - 1) * 100).toFixed(0)}% a year`);
for (const trend of [0, 0.5]) {
  const r = runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: 30 }, s0: 1, days: 365, nPaths: 20000, seed: 3, liquidationBarrier: 0, logDriftPerDay: Math.log(1 + trend) / 365, samplePaths: 20000 });
  const ends = r.samplePaths.map((p) => p.weekly.at(-1)).sort((a, b) => a - b);
  const avg = ends.reduce((a, b) => a + b, 0) / ends.length;
  console.log(`trend setting ${trend * 100}%: after 1 year, middle path ${((ends[ends.length >> 1] - 1) * 100).toFixed(0)}%, average of all paths ${((avg - 1) * 100).toFixed(0)}%, ${(ends.filter((e) => e > 1).length / ends.length * 100).toFixed(0)}% of paths end higher`);
}
