// Times each step of the risk job in Node (for comparing with the browser).
import { readFileSync } from 'node:fs';
import { setData, run } from '../../src/app/riskjob.js';
const t0 = performance.now();
setData('EUR', readFileSync(new URL('../../data/btc-eur-1h.bin.gz', import.meta.url)).toString('base64'));
console.log('setData', Math.round(performance.now() - t0), 'ms');
const meta = { garch: null };
const terms = { currency: 'EUR', btcPrice: 73309, loanAmount: 10000, startDate: '2026-10-15', durationMonths: 12, initialLtv: 0.5, marginCallLtv: 0.7, liquidationLtv: 0.8,
  rate: { type: 'fixed', annual: 0.1 }, repayment: 'interestOnly', compounding: 'none', dayCount: '30/360', originationFee: { type: 'percent', value: 0.01 },
  liquidationFee: { value: 0.05, basis: 'debt' }, curePeriodHours: 48, marginCallConsequence: 'liquidateAfterCure', reserveAmount: 0, purpose: 'spend' };
let last = performance.now(); const steps = [];
await run(1, terms, { nPaths: 10000, blockDays: 30, trend: 0 }, meta.garch, (m) => { const n = performance.now(); steps.push(`${m.type}${m.done ?? ''}:${Math.round(n - last)}`); last = n; });
console.log(steps.join(' '));
