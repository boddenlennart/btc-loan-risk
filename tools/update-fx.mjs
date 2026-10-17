// Downloads the European Central Bank's daily reference rates and keeps the currencies the page
// needs in data/fx-ecb.csv (from Dec 2013 on). Used by the weekly data update and by hand:
//   node tools/update-fx.mjs
// Source: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/
// (free to use with the source named; the page names it under "Data").
import { writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { parseEcbCsv, checkFx, FX_CURRENCIES } from '../src/data/fx.js';

export const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip';
const OUT = new URL('../data/fx-ecb.csv', import.meta.url);

/** Table → CSV text (one row per ECB business day, oldest first). */
export function toCsv(table) {
  const iso = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  return [`Date,${FX_CURRENCIES.join(',')}`, ...table.days.map((d, i) => `${iso(d)},${FX_CURRENCIES.map((c) => table.rates[c][i]).join(',')}`)].join('\n') + '\n';
}

/** Download, check and return { table, csv, problems }. Writes nothing. */
export async function fetchFx(fetchImpl = fetch) {
  const res = await fetchImpl(ECB_URL);
  if (!res.ok) throw new Error(`ECB download failed: HTTP ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const name = Object.keys(files).find((n) => n.endsWith('.csv'));
  const table = parseEcbCsv(strFromU8(files[name]));
  return { table, csv: toCsv(table), problems: checkFx(table) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { table, csv, problems } = await fetchFx();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  writeFileSync(OUT, csv);
  console.log(`data/fx-ecb.csv: ${table.days.length} days, last ${csv.trim().split('\n').at(-1)}`);
}
