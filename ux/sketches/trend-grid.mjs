import { readFileSync } from 'node:fs';
import { gunzipSync } from 'fflate';
const R = new URL('../../', import.meta.url).pathname;
const { decodeHourly } = await import(R + 'src/data/codec.js');
const { dailyFromHourly, dailyReturns } = await import(R + 'src/engine/history.js');
const { runMonteCarlo } = await import(R + 'src/engine/montecarlo.js');
const L = await import(R + 'src/engine/loan.js');
const hourly = decodeHourly(gunzipSync(readFileSync(R + 'data/btc-eur-1h.bin.gz')));
const daily = dailyFromHourly(hourly); const { returns, lowRel } = dailyReturns(daily);
const base = { currency: 'EUR', btcPrice: 72066, loanAmount: 15000, startDate: '2026-11-01', initialLtv: 0.5, marginCallLtv: 0.7, liquidationLtv: 0.83, rate: { type: 'fixed', annual: 0.115 }, repayment: 'bullet', compounding: 'monthly', dayCount: '30/360', originationFee: { type: 'percent', value: 0.015 } };
const trends = [-0.3, 0, 0.2, 0.5, 1.0];
console.log('Liquidated of 100 (test offer, margin call = warning only, so only the trend and duration matter)');
console.log('trend/yr  ' + [6, 12, 24, 36, 60].map((m) => `${m}m`.padStart(5)).join(''));
for (const g of trends) {
  const row = [6, 12, 24, 36, 60].map((m) => {
    const t = { ...base, durationMonths: m };
    const p = runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: 30 }, s0: t.btcPrice, days: L.loanDays(t), nPaths: 4000, seed: 7, liquidationBarrier: L.liquidationPrices(t).byDay, logDriftPerDay: Math.log(1 + g) / 365 }).pLiquidation;
    return String(Math.round(p * 100)).padStart(5);
  });
  console.log(`${(g * 100 >= 0 ? '+' : '') + Math.round(g * 100)}%`.padEnd(10) + row.join(''));
}
// 4-year CAGR by start year (start on 1 Jan, EUR closes)
const byDay = new Map(daily.time.map((t, i) => [t, daily.close[i]]));
console.log('\n4-year average yearly growth, by start date (1 Jan):');
for (let y = 2014; y <= 2022; y++) {
  const a = byDay.get(Date.UTC(y, 0, 1) / 1000), b = byDay.get(Date.UTC(y + 4, 0, 1) / 1000);
  console.log(y, '->', y + 4, `${Math.round(((b / a) ** 0.25 - 1) * 100)}% a year`);
}
const cagr = []; for (let i = 0; i + 1461 < daily.close.length; i++) cagr.push((daily.close[i + 1461] / daily.close[i]) ** 0.25 - 1);
cagr.sort((a, b) => a - b); const q = (f) => Math.round(cagr[Math.floor(f * (cagr.length - 1))] * 100);
console.log(`all 4-year windows: worst ${q(0)}%, 10th pct ${q(0.1)}%, median ${q(0.5)}%, 90th pct ${q(0.9)}%, best ${q(1)}% a year`);
