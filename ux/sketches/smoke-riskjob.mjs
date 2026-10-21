// Smoke test: runs the page's risk job once in Node for the test offer and prints timing and key results.
import { readFileSync } from 'node:fs';
import { setData, run } from '../../src/app/riskjob.js';
setData('EUR', readFileSync(new URL('../../data/btc-eur-1h.bin.gz', import.meta.url)).toString('base64'));
const terms = { currency: 'EUR', btcPrice: 72066, loanAmount: 15000, startDate: '2026-11-01', durationMonths: 12, initialLtv: 0.5, marginCallLtv: 0.7, liquidationLtv: 0.83,
  rate: { type: 'fixed', annual: 0.115 }, repayment: 'bullet', compounding: 'monthly', dayCount: '30/360', originationFee: { type: 'percent', value: 0.015 },
  liquidationFee: { value: 0.04, basis: 'debt' }, curePeriodHours: 48, marginCallConsequence: process.argv[2] || 'liquidateAfterCure', reserveAmount: 0, purpose: 'buy', repayWith: 'sell' };
const t0 = performance.now(); let partialAt = null;
const r = await run(1, terms, { nPaths: 10000, blockDays: 30, trend: 0.5 }, null, (m) => { if (m.type === 'partial') partialAt = performance.now() - t0; });
console.log({ partialMs: Math.round(partialAt), totalMs: Math.round(performance.now() - t0) });
console.log('main', { p: r.main.pLiquidation, partial: r.main.pPartial, margin: r.main.pMarginCall }, 'outlook+50%', r.outlook.pLiquidation, 'garch', r.garchMc.pLiquidation);
console.log('replay', { liq: r.replay.liquidatedShare, partial: r.replay.partialShare }, 'leverage', r.main.leverage);
console.log('levers', r.levers.map((l) => `${l.id}${l.value ? '(' + l.value + ')' : ''}:${Math.round(l.p * 100)}`).join(' '), 'base', Math.round(r.leverBase * 100));
console.log('slider', r.slider.map((x) => `${x.ltv}:${Math.round(x.p * 100)}`).join(' '));
console.log('stories', r.stories.map((x) => `${x.start} sale ${JSON.stringify(x.sale)} left ${x.btcLeft.toFixed(2)}`).join(' | '));
console.log('facts', JSON.stringify(r.facts).slice(0, 400));
