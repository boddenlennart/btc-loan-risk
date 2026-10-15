// Writes tests/fixtures/regression-golden.json: all main results of the reference loans
// on the frozen history (up to 2026-10-01). Run this ONLY when a change in the numbers is
// intended (for example a corrected formula), and say why in the commit message.
// Usage: node tools/update-golden.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeHourly } from '../src/data/codec.js';
import * as job from '../src/app/riskjob.js';
import { FROZEN_END, REFERENCE_LOANS, sliceHourly, toBase64, fitGarch, resultsFor } from '../tests/helpers/regression.js';

const root = new URL('../', import.meta.url);
const garch = {};
for (const cur of ['USD', 'EUR']) {
  const h = sliceHourly(decodeHourly(gunzipSync(readFileSync(new URL(`data/btc-${cur.toLowerCase()}-1h.bin.gz`, root)))), FROZEN_END);
  job.setData(cur, toBase64(h));
  garch[cur] = fitGarch(h);
}
const out = { frozenEnd: new Date(FROZEN_END * 1000).toISOString(), garch, loans: [] };
for (const ref of REFERENCE_LOANS) out.loans.push(await resultsFor(ref, job, garch[ref.currency]));
writeFileSync(new URL('tests/fixtures/regression-golden.json', root), JSON.stringify(out, null, 1));
console.log(`wrote ${out.loans.length} reference loans`);
for (const l of out.loans) console.log(`${l.id.padEnd(24)} sim ${Math.round((l.risk.pLiquidation + l.risk.pPartial) * 100)}  garch ${Math.round((l.risk.garch.pLiquidation + l.risk.garch.pPartial) * 100)}  replay ${Math.round((l.risk.replay.liquidatedShare + l.risk.replay.partialShare) * 100)}  liq ${Math.round(l.loan.liquidation[0])}  payback ${l.loan.totalPayback}`);
