// The 11 insights on /insights/: what happened to BTC-backed loans since 2014.
// Computed by the build (tools/build.mjs) on the real hourly history, never on the simulation,
// so every number is "what happened", not a forecast. Refreshed by the weekly data update.
// One reference loan (the page's example rules) unless a table varies a term on purpose.
import { replayAll } from '../engine/replay.js';
import { loanSummary, breakevenReturn } from '../engine/loan.js';
import { dailyFromHourly, recencyWeights } from '../engine/history.js';
import { toTerms } from '../app/terms.js';
import { EXAMPLE_FORM } from '../content/examples.js';

const DAY = 86400;
export const LTVS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
export const MONTHS = [6, 12, 24, 36];
export const WINDOWS = [30, 90, 180, 365];

/** The reference loan in engine terms (fractions), with `over` changed. The start price and date are set per start day. */
export function reference(over = {}) {
  const t = { ...toTerms({ ...EXAMPLE_FORM, currency: 'USD', btcPrice: 1 }).terms, ...over };
  // a margin call at or below the starting LTV would be hit at once: such a loan has none
  if (t.marginCallLtv && t.marginCallLtv <= t.initialLtv) t.marginCallLtv = null;
  return t;
}

const quantile = (sorted, q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
function closeAt(hourly, t) { // close of the last hour at or before t
  let lo = 0; let hi = hourly.time.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (hourly.time[mid] <= t) lo = mid; else hi = mid - 1; }
  return hourly.close[lo];
}
const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);

/** 1. Survival map: liquidated share of start days, starting LTV × duration. */
export function survivalMap(hourly) {
  const cells = [];
  for (const months of MONTHS) {
    for (const ltv of LTVS) {
      const r = replayAll(hourly, reference({ initialLtv: ltv, durationMonths: months }));
      cells.push({ ltv, months, liquidated: r.liquidatedShare, starts: r.starts });
    }
  }
  // per duration: the highest starting LTV never liquidated on any start day
  const neverAbove = MONTHS.map((months) => {
    const ok = cells.filter((c) => c.months === months && c.liquidated === 0).map((c) => c.ltv);
    return { months, ltv: ok.length ? Math.max(...ok) : null };
  });
  return { cells, neverAbove };
}

/** 2. Worst falls by time window: from each day's opening price to the lowest hourly price within the window. */
export function worstFalls(hourly) {
  const d = dailyFromHourly(hourly);
  return WINDOWS.map((w) => {
    const falls = []; let worst = { fall: -1, start: null };
    const q = []; // indices of daily lows, increasing (sliding minimum over the next w days)
    let h = 0;
    for (let j = 0; j < d.time.length; j++) {
      while (q.length > h && d.low[q[q.length - 1]] >= d.low[j]) q.pop();
      q.push(j);
      const i = j - w + 1; // the window [i, j] is complete
      if (i < 0) continue;
      while (q[h] < i) h++;
      const fall = 1 - d.low[q[h]] / d.open[i];
      falls.push(fall);
      if (fall > worst.fall) worst = { fall, start: d.time[i] };
    }
    const s = falls.slice().sort((a, b) => a - b);
    return { days: w, periods: s.length, q50: quantile(s, 0.5), q90: quantile(s, 0.9), q95: quantile(s, 0.95), worst: worst.fall, worstStart: worst.start };
  });
}

/** 3. Speed of crashes: hours from the first margin call to the liquidation price (reference loan, margin call only a warning). */
export function crashSpeed(hourly) {
  const r = replayAll(hourly, reference({ marginCallConsequence: 'warningOnly' }));
  const p = r.perStart; const hours = []; let calls = 0; let outside = 0;
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
  for (let k = 0; k < p.time.length; k++) {
    const mc = p.marginCallTime[k]; if (mc === null) continue;
    calls++;
    const parts = Object.fromEntries(fmt.formatToParts(new Date(mc * 1000)).map((x) => [x.type, x.value]));
    const hr = Number(parts.hour);
    if (parts.weekday === 'Sat' || parts.weekday === 'Sun' || hr < 8 || hr >= 20) outside++;
    if (p.liquidationTime[k] !== null) hours.push((p.liquidationTime[k] - mc) / 3600);
  }
  const within = (h) => (calls ? hours.filter((x) => x <= h).length / calls : null);
  return { starts: r.starts, marginCalls: calls, within24: within(24), within48: within(48), within72: within(72), liquidatedLater: calls ? hours.length / calls : null, outsideOfficeHours: calls ? outside / calls : null };
}

/** 4. Lever ranking: the reference loan with one term changed at a time (liquidated share of start days). */
export function leverRanking(hourly) {
  const base = replayAll(hourly, reference()).liquidatedShare;
  const levers = [
    ['lowerLtv', { initialLtv: 0.4 }],
    ['higherLiq', { liquidationLtv: 0.9 }], // +10 points, as in "Make it safer" on the check
    ['longerCure', { curePeriodHours: 72 }],
    ['warningOnly', { marginCallConsequence: 'warningOnly' }],
    ['reserve', { reserveAmount: 2000 }],
    ['shorter', { durationMonths: 6 }],
  ].map(([id, over]) => ({ id, liquidated: replayAll(hourly, reference(over)).liquidatedShare }));
  levers.sort((a, b) => a.liquidated - b.liquidated);
  return { base, levers };
}

/** 5. Reserve sizing: extra BTC (share of the BTC pledged) that would have kept the LTV below the liquidation LTV. */
export function reserveSizing(hourly) {
  return [0.4, 0.5, 0.6].map((ltv) => {
    const r = replayAll(hourly, reference({ initialLtv: ltv }));
    const s = r.perStart.reserveNeeded.slice().sort((a, b) => a - b);
    return { ltv, q50: quantile(s, 0.5), q90: quantile(s, 0.9), q95: quantile(s, 0.95), max: s[s.length - 1] };
  });
}

// BTC still owned at the end, after repaying what is left of the loan at the end price, per BTC pledged
const keptAtEnd = (hourly, p, k) => (p.collateralAtEnd[k] - p.debtAtEnd[k] / closeAt(hourly, p.endTime[k])) / p.collateral[k];

/** 6. Partial vs. full sale: BTC kept at the end on the start days that ran into a sale. */
export function partialVsFull(hourly) {
  const full = replayAll(hourly, reference()).perStart;
  const part = replayAll(hourly, reference({ marginCallConsequence: 'partialAfterCure', liquidationSale: 'partial' })).perStart;
  const keptFull = []; const keptPart = [];
  for (let k = 0; k < full.time.length; k++) {
    if (!full.liquidated[k]) continue; // the start days on which the full-sale loan was liquidated
    keptFull.push(keptAtEnd(hourly, full, k)); keptPart.push(keptAtEnd(hourly, part, k));
  }
  const med = (xs) => quantile(xs.slice().sort((a, b) => a - b), 0.5);
  return { starts: full.time.length, saleDays: keptFull.length, fullMedian: med(keptFull), partialMedian: med(keptPart), partialBetter: share(keptPart.map((x, i) => x > keptFull[i])) };
}

/** 7. Expected cost including the risk: interest and fees + liquidated share × average loss (USD 10,000 loan, 12 months). */
export function expectedCost(hourly) {
  const row = (ltv, rate) => {
    const t = reference({ initialLtv: ltv, rate: { type: 'fixed', annual: rate } });
    const p = replayAll(hourly, t).perStart;
    const losses = [];
    for (let k = 0; k < p.time.length; k++) {
      if (!p.liquidated[k]) continue;
      // what the sale cost, valued at the end of the loan: the BTC sold, minus the loan it repaid
      losses.push((p.collateral[k] - p.collateralAtEnd[k]) * closeAt(hourly, p.endTime[k]) - t.loanAmount);
    }
    const liquidated = losses.length / p.time.length;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const cost = loanSummary({ ...t, btcPrice: 1, startDate: '2020-01-01' }).totalCost;
    return { ltv, rate, cost, liquidated, avgLoss, expected: cost + liquidated * avgLoss };
  };
  return { loan: reference().loanAmount, rows: LTVS.slice(1).map((ltv) => row(ltv, 0.1)), offers: [row(0.6, 0.08), row(0.4, 0.12)] };
}

/** 8. Hourly lows vs. a smoother price (hourly closes, as a stand-in for a lender's averaged price index). */
export function priceMeasure(hourly) {
  const closes = { ...hourly, low: hourly.close };
  return [0.4, 0.5, 0.6].map((ltv) => ({ ltv, lows: replayAll(hourly, reference({ initialLtv: ltv })).liquidatedShare, closes: replayAll(closes, reference({ initialLtv: ltv })).liquidatedShare }));
}

/** 9. Buying more BTC: start days that ended with more BTC than pledged (loan used to buy BTC, repaid by selling BTC at the end). */
export function buyMore(hourly) {
  const d = dailyFromHourly(hourly);
  const cells = []; const needed = [];
  for (const months of MONTHS) {
    for (const ltv of [0.2, 0.3, 0.4, 0.5]) {
      const t = reference({ initialLtv: ltv, durationMonths: months, purpose: 'buy', repayWith: 'sell' });
      const p = replayAll(hourly, t).perStart; const s = loanSummary({ ...t, btcPrice: 1, startDate: '2020-01-01' });
      const more = [];
      for (let k = 0; k < p.time.length; k++) {
        const bought = s.amountReceived / p.startPrice[k] / p.collateral[k]; // per BTC pledged
        const end = p.liquidated[k] ? p.collateralAtEnd[k] / p.collateral[k] + bought : 1 + bought - s.totalPayback / closeAt(hourly, p.endTime[k]) / p.collateral[k];
        more.push(end > 1);
      }
      cells.push({ ltv, months, more: share(more), starts: p.time.length });
    }
    // the rise the loan needs to pay off, and how often BTC rose that much over the same time (no loan rules involved)
    const s = loanSummary({ ...reference({ durationMonths: months }), btcPrice: 1, startDate: '2020-01-01' });
    const need = s.totalPayback / s.amountReceived - 1;
    const days = Math.round((months * 365.25) / 12); const rose = [];
    for (let i = 0; i + days < d.time.length; i++) rose.push(d.close[i + days] / d.open[i] - 1 > need);
    needed.push({ months, need, rose: share(rose) });
  }
  return { cells, needed };
}

/** 10. Spending without selling: start days on which borrowing left more BTC than selling the same amount at the start. */
export function borrowOrSell(hourly) {
  const out = [];
  for (const ltv of [0.3, 0.5]) {
    for (const [tax, taxNow, taxLater] of [['none', 0, 0], ['sellNowTaxed', 0.25, 0]]) {
      const t = reference({ initialLtv: ltv });
      const p = replayAll(hourly, t).perStart; const s = loanSummary({ ...t, btcPrice: 1, startDate: '2020-01-01' });
      const wins = [];
      for (let k = 0; k < p.time.length; k++) {
        const sell = p.collateral[k] - s.amountReceived / (p.startPrice[k] * (1 - taxNow));
        const borrow = p.liquidated[k] ? p.collateralAtEnd[k] : p.collateral[k] - s.totalPayback / (closeAt(hourly, p.endTime[k]) * (1 - taxLater));
        wins.push(borrow > sell);
      }
      out.push({ ltv, tax, taxNow, taxLater, breakeven: breakevenReturn({ ...t, btcPrice: 1, startDate: '2020-01-01' }, { taxRateNow: taxNow, taxRateAtMaturity: taxLater }), borrowWon: share(wins), starts: p.time.length });
    }
  }
  return out;
}

/** 11. Today's price swings: the last 30 days' volatility (yearly terms) compared with every 30-day period since 2014. */
export function swingsToday(hourly, halfLifeYears = 3) {
  const d = dailyFromHourly(hourly);
  const r = []; for (let i = 1; i < d.close.length; i++) r.push(Math.log(d.close[i] / d.close[i - 1]));
  const vol = (a, b) => { const x = r.slice(a, b); const m = x.reduce((s, v) => s + v, 0) / x.length; return Math.sqrt((x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)) * 365); };
  const series = []; for (let j = 30; j <= r.length; j++) series.push({ time: d.time[j], vol: vol(j - 30, j) });
  const now = series[series.length - 1];
  const sorted = series.map((x) => x.vol).sort((a, b) => a - b);
  // the volatility the check's simulation effectively uses (recent days weighted more), for comparison
  const w = recencyWeights(r.length, halfLifeYears * 365); const W = w.reduce((a, b) => a + b, 0);
  const wm = r.reduce((a, x, i) => a + x * w[i], 0) / W;
  const simVol = Math.sqrt((r.reduce((a, x, i) => a + w[i] * (x - wm) ** 2, 0) / W) * 365);
  return { now: now.vol, asOf: now.time, simVol, calmerShare: series.filter((x) => x.vol < now.vol).length / series.length, q10: quantile(sorted, 0.1), q50: quantile(sorted, 0.5), q90: quantile(sorted, 0.9), weekly: series.filter((_, k) => (series.length - 1 - k) % 7 === 0).map((x) => [x.time, Math.round(x.vol * 1000) / 1000]) };
}

/** All 11, plus what they were measured on. */
export function computeInsights(hourly, { currency = 'USD', halfLifeYears = 3 } = {}) {
  return {
    currency, from: hourly.time[0], to: hourly.time[hourly.time.length - 1],
    survival: survivalMap(hourly), falls: worstFalls(hourly), speed: crashSpeed(hourly), levers: leverRanking(hourly), reserve: reserveSizing(hourly),
    partial: partialVsFull(hourly), cost: expectedCost(hourly), measure: priceMeasure(hourly), buy: buyMore(hourly), spend: borrowOrSell(hourly), swings: swingsToday(hourly, halfLifeYears),
  };
}
