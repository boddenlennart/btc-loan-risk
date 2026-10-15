// Test 4 — Out-of-sample calibration: the models must not be too optimistic.
//
// For every month from 2016 on we pretend it is that day ("cut-off"):
//   1. the models only see prices BEFORE the cut-off,
//   2. they simulate the next 90 (or 365) days and give a "worst 5%" level for
//      the lowest price in that period,
//   3. we compare with the lowest price that really happened.
// If a model is honest, reality should fall below its "worst 5%" level about
// 5% of the time. We fail the model if this happens more than 10% of the time
// (twice as often as promised). Neighbouring months overlap, so the real
// number of independent checks is small; that is why the band is wide.
// The same is done for the "worst 10%" level (fail above 20%) and the median
// (reality should land below it between 20% and 80% of the time).
// The models run with the page's default assumption: no price trend (0% a year).
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { dailyFromHourly, dailyReturns } from '../src/engine/history.js';
import { fitGarchT } from '../src/engine/garch.js';
import { loadHourly, hasData } from './helpers/history.js';

const FIRST_CUTOFF = Date.parse('2016-01-01T00:00Z') / 1000;

function calibrate(currency, model, horizonDays) {
  const daily = dailyFromHourly(loadHourly(currency));
  const pits = [];
  for (let i = 0; i + horizonDays < daily.time.length; i += 30) {
    if (daily.time[i] < FIRST_CUTOFF) continue;
    const past = { time: daily.time.slice(0, i), open: daily.open.slice(0, i), low: daily.low.slice(0, i), close: daily.close.slice(0, i) };
    const { returns, lowRel } = dailyReturns(past);
    const params = model === 'bootstrap' ? { returns, lowRel, blockDays: 30 } : fitGarchT(returns);
    const s0 = daily.close[i - 1];
    const sim = runMonteCarlo({ model, params, s0, days: horizonDays, nPaths: 2000, seed: i, liquidationBarrier: 0, collectMinRatios: true, logDriftPerDay: 0 });
    let realMin = Infinity;
    for (let d = i; d < i + horizonDays; d++) realMin = Math.min(realMin, daily.low[d]);
    const realRatio = realMin / s0;
    // share of simulated paths whose lowest point was at or below what really happened
    pits.push(sim.minRatios.filter((m) => m <= realRatio).length / sim.minRatios.length);
  }
  const rate = (q) => pits.filter((p) => p < q).length / pits.length;
  return { n: pits.length, below05: rate(0.05), below10: rate(0.10), below50: rate(0.5) };
}

for (const currency of ['USD', 'EUR']) {
  for (const model of ['bootstrap', 'garch']) {
    for (const horizon of [90, 365]) {
      it.skipIf(!hasData(currency))(`${currency}, ${model}, ${horizon} days: "worst 5%" not badly breached`, () => {
        const r = calibrate(currency, model, horizon);
        process.stderr.write(`${currency} ${model} ${horizon}d: ${r.n} cut-offs, below q05 ${(r.below05 * 100).toFixed(1)}%, below q10 ${(r.below10 * 100).toFixed(1)}%, below median ${(r.below50 * 100).toFixed(1)}%\n`);
        expect(r.below05).toBeLessThanOrEqual(0.10);
        expect(r.below10).toBeLessThanOrEqual(0.20);
        expect(r.below50).toBeGreaterThanOrEqual(0.2);
        expect(r.below50).toBeLessThanOrEqual(0.8);
      }, 300_000);
    }
  }
}
