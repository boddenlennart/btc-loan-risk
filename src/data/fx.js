// Exchange rates for the currencies without their own long BTC price history (CHF, GBP, CAD,
// AUD, CZK, PLN). Their hourly BTC prices are computed as hourly BTC/EUR × the European Central
// Bank's daily reference rate (units of the currency per 1 EUR). The ECB publishes on business
// days; weekends and holidays use the last published rate. Pure functions, no network.

export const FX_CURRENCIES = ['CHF', 'GBP', 'CAD', 'AUD', 'CZK', 'PLN'];
const DAY = 86400;
const dayOf = (unix) => Math.floor(unix / DAY);

/** ECB "eurofxref-hist.csv" → { days: [day numbers, ascending], rates: { CHF: [...], ... } } from `fromIso` on. */
export function parseEcbCsv(text, { currencies = FX_CURRENCIES, fromIso = '2013-12-01' } = {}) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim());
  const col = Object.fromEntries(currencies.map((c) => [c, head.indexOf(c)]));
  for (const c of currencies) if (col[c] < 0) throw new Error(`ECB file has no column ${c}`);
  const from = dayOf(Date.parse(`${fromIso}T00:00Z`) / 1000);
  const rows = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    const day = dayOf(Date.parse(`${f[0]}T00:00Z`) / 1000);
    if (!Number.isFinite(day) || day < from) continue;
    rows.push([day, ...currencies.map((c) => Number(f[col[c]]))]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return { days: rows.map((r) => r[0]), rates: Object.fromEntries(currencies.map((c, i) => [c, rows.map((r) => r[i + 1])])) };
}

// Real moves larger than the 10% check, confirmed, not data errors:
// 15 Jan 2015: the Swiss National Bank ended its minimum rate of 1.20 francs per euro.
export const KNOWN_FX_MOVES = ['CHF 2015-01-15'];

/** Problems in the table: missing or impossible rates, gaps, jumps. Returns a list of messages. */
export function checkFx(table, { maxGapDays = 7, maxDailyMove = 0.1, known = KNOWN_FX_MOVES } = {}) {
  const problems = [];
  const { days, rates } = table;
  for (let i = 1; i < days.length; i++) {
    if (days[i] <= days[i - 1]) problems.push(`dates out of order at ${iso(days[i])}`);
    else if (days[i] - days[i - 1] > maxGapDays) problems.push(`gap of ${days[i] - days[i - 1]} days before ${iso(days[i])}`);
  }
  for (const [c, r] of Object.entries(rates)) {
    r.forEach((x, i) => {
      if (!Number.isFinite(x) || x <= 0) problems.push(`impossible ${c} rate ${x} on ${iso(days[i])}`);
      else if (i > 0 && Number.isFinite(r[i - 1]) && Math.abs(Math.log(x / r[i - 1])) > maxDailyMove && !known.includes(`${c} ${iso(days[i])}`)) problems.push(`${c} moved more than ${maxDailyMove * 100}% on ${iso(days[i])}`);
    });
  }
  return problems;
}
const iso = (day) => new Date(day * DAY * 1000).toISOString().slice(0, 10);

/** Rate for each hour: the rate of that UTC day, or the last one published before it. */
export function rateForHours(table, currency, times) {
  const { days } = table; const r = table.rates[currency];
  const out = new Float64Array(times.length);
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    const d = dayOf(times[i]);
    while (j + 1 < days.length && days[j + 1] <= d) j++;
    out[i] = days[j] <= d ? r[j] : r[0]; // before the first rate: the first rate
  }
  return out;
}

/** Hourly BTC/EUR → hourly BTC/currency. */
export function convertHourly(eur, table, currency) {
  const rate = rateForHours(table, currency, eur.time);
  const times = (k) => Float64Array.from(eur[k], (v, i) => v * rate[i]);
  return { time: eur.time, open: times('open'), high: times('high'), low: times('low'), close: times('close'), noTrade: eur.noTrade };
}

/** The last published rate (for converting recent candles and the stored last price). */
export const lastRate = (table, currency) => table.rates[currency].at(-1);
