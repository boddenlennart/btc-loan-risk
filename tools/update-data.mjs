// Scheduled data update (run by .github/workflows/update-data.yml, or by hand).
//   1. fetches new complete hourly candles from Bitstamp (main source) and Kraken (cross-check)
//   2. checks them: no gaps, duplicates or impossible values; Kraken agrees with Bitstamp
//   3. appends them to data/btc-*-1h.bin.gz and updates data/meta.json
//   4. re-fits the model settings (GARCH) and compares a reference loan before and after
//   5. refreshes the ECB exchange rates (CHF, GBP, CAD, AUD, CZK, PLN), checks them, and compares
//      the computed BTC prices in those currencies with real exchange prices (Kraken, Bitstamp)
//   6. writes a plain-language summary for the pull request
// Exits with code 1 (and explains why) if a check fails; nothing is changed then.
// Drift guard: if the new hours move the result of any of the 12 reference loans by more
// than 5 of 100, the update also stops, so a person looks at it first.
// Usage: node tools/update-data.mjs [summary-file]
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeHourly, encodeHourly } from '../src/data/codec.js';
import { checkSeries, crossCheck } from '../src/data/candles.js';
import { dailyFromHourly, dailyReturns } from '../src/engine/history.js';
import { fitGarchT } from '../src/engine/garch.js';
import { setData, run } from '../src/app/riskjob.js';
import * as job from '../src/app/riskjob.js';
import { REFERENCE_LOANS, resultsFor } from '../tests/helpers/regression.js';

import { fetchFx } from './update-fx.mjs';
import { crossCheckFx } from './check-fx.mjs';
import { parseEcbCsv } from '../src/data/fx.js';

const root = new URL('../', import.meta.url);
const summaryFile = process.argv[2] || 'data-update-summary.md';
const NOW = Math.floor(Date.now() / 1000);
const LAST_COMPLETE = Math.floor(NOW / 3600) * 3600 - 3600; // start of the last finished hour

async function getJson(url, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'btc-loan-risk-data-update' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries - 1) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

async function bitstamp(cur, from) {
  const out = [];
  for (let start = from; start <= LAST_COMPLETE;) {
    const j = await getJson(`https://www.bitstamp.net/api/v2/ohlc/btc${cur.toLowerCase()}/?step=3600&limit=1000&start=${start}`);
    const rows = (j.data && j.data.ohlc) || [];
    if (!rows.length) break;
    for (const r of rows) {
      const c = { time: +r.timestamp, open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: +r.volume };
      if (c.time >= from && c.time <= LAST_COMPLETE) out.push(c);
    }
    const last = +rows[rows.length - 1].timestamp;
    if (last + 3600 <= start) break;
    start = last + 3600;
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}

async function kraken(cur) { // the public API returns the last 720 hours
  const j = await getJson(`https://api.kraken.com/0/public/OHLC?pair=XBT${cur}&interval=60`);
  if (j.error && j.error.length) throw new Error(`Kraken: ${j.error.join(', ')}`);
  const rows = Object.entries(j.result).find(([k]) => k !== 'last')[1];
  return rows.map((r) => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[6] })).filter((c) => c.time <= LAST_COMPLETE);
}

const file = (cur) => new URL(`data/btc-${cur.toLowerCase()}-1h.bin.gz`, root);
const iso = (t) => new Date(t * 1000).toISOString().replace(':00.000Z', ' UTC').replace('T', ' ');
const pct = (x, d = 2) => `${(x * 100).toFixed(d)}%`;

// The reference loan from the test kit (ux/A2): €/$15,000, 50% / 83%, 12 months, 11.5% added monthly,
// margin call at 70% with a sale after 48 h, 1.5% fee, 4% liquidation fee.
const REFERENCE = {
  loanAmount: 15000, startDate: new Date(LAST_COMPLETE * 1000).toISOString().slice(0, 10), durationMonths: 12, initialLtv: 0.5, marginCallLtv: 0.7,
  liquidationLtv: 0.83, rate: { type: 'fixed', annual: 0.115 }, repayment: 'bullet', compounding: 'monthly', dayCount: '30/360',
  originationFee: { type: 'percent', value: 0.015 }, liquidationFee: { value: 0.04, basis: 'debt' }, curePeriodHours: 48,
  marginCallConsequence: 'liquidateAfterCure', liquidationSale: 'all', reserveAmount: 0, purpose: 'spend',
};
async function referenceResult(cur, gz, price) {
  setData(cur, gz.toString('base64'));
  const r = await run(0, { ...REFERENCE, currency: cur, btcPrice: price }, { nPaths: 10000, blockDays: 30, trend: 0 }, null, () => {});
  return { sim: r.main.pLiquidation + r.main.pPartial, garch: r.garchMc.pLiquidation + r.garchMc.pPartial, replay: r.replay.liquidatedShare + r.replay.partialShare, garchParams: r.garch, sigma: r.barrier.sigma };
}

const meta = JSON.parse(readFileSync(new URL('data/meta.json', root), 'utf8'));
const lines = []; const failures = []; let changed = false;

const oldData = {}; const newData = {}; // files are written only after every check has passed
for (const cur of ['USD', 'EUR']) {
  const oldGz = readFileSync(file(cur));
  oldData[cur] = oldGz;
  const h = decodeHourly(gunzipSync(oldGz));
  const n = h.time.length;
  const lastTime = h.time[n - 1];
  const fresh = await bitstamp(cur, lastTime + 3600);
  const second = await kraken(cur);
  lines.push(`### ${cur}`);
  if (!fresh.length) { lines.push(`No new complete hours since ${iso(lastTime)}.`); continue; }
  const seriesProblems = checkSeries(fresh, { previousTime: lastTime, previousClose: h.close[n - 1] });
  if (fresh.at(-1).time < LAST_COMPLETE - 6 * 3600) seriesProblems.push(`Bitstamp data stops at ${iso(fresh.at(-1).time)}, more than 6 hours before now`);
  const cross = crossCheck(fresh, second);
  if (seriesProblems.length || !cross.ok) {
    failures.push(`**${cur}:** ${[...seriesProblems, ...cross.problems].join('; ')}`);
    continue;
  }
  // append and re-encode
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ time: h.time[i], open: h.open[i], high: h.high[i], low: h.low[i], close: h.close[i], volume: h.noTrade[i] ? 0 : 1 });
  for (const c of fresh) rows.push(c);
  const newGz = gzipSync(encodeHourly(rows), { level: 9 });
  const price = fresh.at(-1).close;
  const before = await referenceResult(cur, oldGz, price);
  const after = await referenceResult(cur, newGz, price);
  newData[cur] = newGz;
  meta[cur] = { ...meta[cur], hours: rows.length, to: fresh.at(-1).time, lastClose: price, bytes: newGz.length, sources: [...new Set([...(meta[cur].sources || []), 'bitstamp'])] };
  changed = true;
  const of100 = (x) => Math.round(x * 100);
  lines.push(
    `Data through: **${iso(lastTime)} → ${iso(fresh.at(-1).time)}** (${fresh.length} new hours).`,
    `Checks passed: no gaps, no duplicates, no impossible values. Kraken agrees on ${cross.stats.comparable} hours: typical difference ${pct(cross.stats.median, 3)}, largest ${pct(cross.stats.max, 2)}.`,
    cross.lowFlags.length
      ? `**Please look at these hours** (hourly low more than 10% apart between the exchanges; can be a real short crash on one exchange): ${cross.lowFlags.map((f) => `${f.time} Bitstamp ${f.primaryLow} / Kraken ${f.secondaryLow}`).join('; ')}`
      : 'Nothing unusual between the two exchanges.',
    '',
    `Reference loan (15,000 ${cur}, starting LTV 50%, liquidation 83%, 12 months, margin call 70% with sale after 48 h), liquidated or partly sold, of 100:`,
    '',
    '| Method | Before | After |', '|---|---|---|',
    `| Simulation (headline) | ${of100(before.sim)} | ${of100(after.sim)} |`,
    `| Volatility model (GARCH) | ${of100(before.garch)} | ${of100(after.garch)} |`,
    `| Real history since 2014 | ${of100(before.replay)} | ${of100(after.replay)} |`,
    '',
    `Model settings re-fitted: yearly volatility ${pct(before.sigma, 1)} → ${pct(after.sigma, 1)}; GARCH persistence ${(before.garchParams.alpha + before.garchParams.beta).toFixed(4)} → ${(after.garchParams.alpha + after.garchParams.beta).toFixed(4)}.`,
    Math.abs(of100(after.sim) - of100(before.sim)) > 3 ? '**The headline moved by more than 3 of 100.** Please read the new hours above before merging.' : 'The headline moved by 3 of 100 or less: as expected for a week of new data.',
    '',
  );
}

function stopIfFailed() {
  if (!failures.length) return;
  const text = ['## Data update stopped: a check failed', '', 'Nothing was changed. The new hours did not pass the checks:', '', ...failures.map((f) => `- ${f}`), '',
    'What to do: open the exchange websites and look at these hours. If it is a temporary API problem, run the workflow again later ("Actions" tab → "Update price data" → "Run workflow").'].join('\n');
  writeFileSync(summaryFile, text);
  console.error(text);
  process.exit(1);
}
stopIfFailed();

// Exchange rates (ECB) for the currencies computed from the euro history.
// Limits: the computed prices may differ from a real exchange by 0.5% in a typical hour, 2% in 95 of 100 hours.
let newFxCsv = null;
{
  const fxFile = new URL('data/fx-ecb.csv', root);
  const oldCsv = readFileSync(fxFile, 'utf8');
  lines.push('### Exchange rates (European Central Bank)');
  try {
    const { table, csv, problems } = await fetchFx();
    for (const p of problems) failures.push(`ECB rates: ${p}`);
    const old = parseEcbCsv(oldCsv, { fromIso: '1999-01-01' });
    const revised = old.days.filter((d, i) => { const j = table.days.indexOf(d); return j < 0 || Object.keys(old.rates).some((c) => Math.abs(table.rates[c][j] / old.rates[c][i] - 1) > 0.005); });
    if (revised.length) failures.push(`ECB rates: ${revised.length} earlier days changed or disappeared (first: ${new Date(revised[0] * 86400000).toISOString().slice(0, 10)}). A person should look at this.`);
    const added = table.days.length - old.days.length;
    lines.push(added > 0 ? `${added} new business days, up to ${csv.trim().split('\n').at(-1).slice(0, 10)}.` : 'No new rates.');
    if (added > 0) { newFxCsv = csv; changed = true; }
    const eurGz = newData.EUR || oldData.EUR;
    const rows = await crossCheckFx(decodeHourly(gunzipSync(eurGz)), table);
    lines.push('', '| Computed price | Compared with | Hours | Typical difference | 95% of hours within |', '|---|---|---|---|---|');
    for (const r of rows) {
      if (r.error || !r.hours) { lines.push(`| ${r.pair} | ${r.source} | – | not available | ${r.error || 'no data'} |`); continue; }
      lines.push(`| ${r.pair} | ${r.source} | ${r.hours} | ${r.median.toFixed(2)}% | ${r.p95.toFixed(2)}% |`);
      if (r.median > 0.5 || r.p95 > 2) failures.push(`Computed ${r.pair} differs from ${r.source} by ${r.median.toFixed(2)}% in a typical hour (limit 0.5%) or ${r.p95.toFixed(2)}% in 95 of 100 hours (limit 2%).`);
    }
    lines.push('');
  } catch (e) {
    failures.push(`ECB rates could not be downloaded: ${e.message || e}`);
  }
}
stopIfFailed();

// Drift guard over all 12 reference loans (tests/helpers/regression.js), old vs new data.
const DRIFT_LIMIT = 0.05;
async function allResults(gzByCur) {
  const out = {};
  for (const [cur, gz] of Object.entries(gzByCur)) job.setData(cur, gz.toString('base64'));
  for (const ref of REFERENCE_LOANS) {
    const r = await resultsFor(ref, job, null);
    out[ref.id] = { sim: r.risk.pLiquidation + r.risk.pPartial, replay: r.risk.replay.liquidatedShare + r.risk.replay.partialShare };
  }
  return out;
}
if (changed) {
  const after = await allResults(Object.fromEntries(['USD', 'EUR'].map((c) => [c, newData[c] || oldData[c]])));
  const before = await allResults(oldData);
  const moves = REFERENCE_LOANS.map((r) => ({ id: r.id, size: Math.max(Math.abs(after[r.id].sim - before[r.id].sim), Math.abs(after[r.id].replay - before[r.id].replay)) }));
  const worst = moves.reduce((a, m) => (m.size > a.size ? m : a));
  if (worst.size > DRIFT_LIMIT) {
    failures.push(`**Drift guard:** the new hours moved the result of the reference loan "${worst.id}" by ${Math.round(worst.size * 100)} of 100 (limit 5). That is far more than a week of normal data does. A person should look at the new hours before they are used.`);
  } else {
    lines.push(`Drift guard: across all 12 reference loans (tests/helpers/regression.js), the largest change is ${Math.round(worst.size * 1000) / 10} of 100 ("${worst.id}"); limit 5.`, '');
  }
}
stopIfFailed();

if (changed) {
  for (const [cur, gz] of Object.entries(newData)) writeFileSync(file(cur), gz);
  if (newFxCsv) writeFileSync(new URL('data/fx-ecb.csv', root), newFxCsv);
  meta.updated = NOW; // shown on the page as "last updated"
  writeFileSync(new URL('data/meta.json', root), JSON.stringify(meta, null, 1));
  const garch = Object.fromEntries(['USD', 'EUR'].map((c) => [c, fitGarchT(dailyReturns(dailyFromHourly(decodeHourly(gunzipSync(readFileSync(file(c)))))).returns)]));
  lines.push(`GARCH settings now: ${Object.entries(garch).map(([c, g]) => `${c} α ${g.alpha.toFixed(3)} β ${g.beta.toFixed(3)} ν ${g.nu.toFixed(2)}`).join(' · ')}`);
}
const text = ['## Weekly BTC price data update', '', ...lines, '',
  '**Before merging:** check that all tests passed (shown below in this pull request), read the reference-loan table, and look at any hours listed above. This pull request is never merged automatically.',
  '', '_Created by the scheduled workflow "Update price data". See README → "How to update and check the data"._'].join('\n');
writeFileSync(summaryFile, text);
console.log(text);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
