// Test 2 — Replaying real crashes gives the expected liquidation hour.
// Expected hours come from reference/reference_replay.py, a separate program
// that reads the same raw exchange candles. Both must agree to the hour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { replayOne, replayAll, entryTiming, replaySince } from '../src/engine/replay.js';
import { loadHourly, hasData } from './helpers/history.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/replay-crashes.json', import.meta.url)));
const toUnix = (iso) => Date.parse(iso) / 1000;

describe('real crashes: same liquidation hour as the reference program', () => {
  for (const f of fixtures) {
    it.skipIf(!hasData(f.currency))(`${f.currency}: ${f.name}`, () => {
      const start = toUnix(f.start);
      const r = replayOne(loadHourly(f.currency), { ...f.terms, currency: f.currency, startDate: f.start.slice(0, 10) }, start);
      expect(r.startPrice).toBeCloseTo(f.expected.startPrice, 6);
      expect(r.collateralBtc).toBeCloseTo(f.expected.collateralBtc, 10);
      expect(r.liquidation?.time ?? null).toBe(f.expected.liquidation?.time ?? null);
      expect(r.marginCall?.time ?? null).toBe(f.expected.marginCall?.time ?? null);
    });
  }
});

// Made-up hourly history, so the counting can be checked by hand:
// 200 days from 2024-01-01, price 100 everywhere, except listed hours.
function madeUp(dips) {
  const n = 200 * 24;
  const t0 = Date.parse('2024-01-01T00:00Z') / 1000;
  const time = Array.from({ length: n }, (_, i) => t0 + i * 3600);
  const low = time.map((t) => dips[t] ?? 100);
  const close = time.map(() => 100);
  return { time, open: close, high: close, low, close };
}
const loan = {
  currency: 'EUR', loanAmount: 50, initialLtv: 0.5, marginCallLtv: 0.7, liquidationLtv: 0.8, durationMonths: 1,
  rate: { type: 'fixed', annual: 0 }, repayment: 'interestOnly', compounding: 'none', dayCount: '30/360',
  originationFee: { type: 'percent', value: 0 }, liquidationFee: { value: 0, basis: 'debt' }, reserveAmount: 0,
};

describe('replay over all start dates (made-up history, counted by hand)', () => {
  // One dip to 50 at 2024-04-10 12:00. Liquidation price = 62.5 (start price 100, 50% -> 80%).
  // One-month loans starting Mar 11 ... Apr 10 contain the dip: 31 starts.
  // Loans must end inside the data (last full start: Jun 19): Jan 1 ... Jun 19 = 171 starts.
  const crash = toUnix('2024-04-10T12:00Z');
  const h = madeUp({ [crash]: 50 });
  it('counts starts and liquidations', () => {
    const r = replayAll(h, loan);
    expect(r.starts).toBe(171);
    expect(r.liquidatedShare).toBeCloseTo(31 / 171, 12);
    expect(r.marginCallShare).toBeCloseTo(31 / 171, 12);
  });
  it('reports the worst case', () => {
    const r = replayAll(h, loan);
    expect(r.worst.liquidationTime).toBe(crash);
    expect(r.worst.maxDrawdown).toBeCloseTo(0.5, 12);
  });
  it('reserve needed: 0.25 extra BTC per BTC pledged would have avoided liquidation', () => {
    // (1 + r) x 50 x 80% = 50 (debt)  ->  r = 0.25. 31 of 171 starts need it (18%).
    const r = replayAll(h, loan).reserveBtcNeeded;
    expect(r.q50).toBeCloseTo(0, 12);
    expect(r.q90).toBeCloseTo(0.25, 12);
    expect(r.max).toBeCloseTo(0.25, 12);
  });
  it('a price that never moves never liquidates', () => {
    const r = replayAll(madeUp({}), loan);
    expect(r.liquidatedShare).toBe(0);
    expect(r.worst.liquidationTime).toBeNull();
  });
});

describe('reserve: topping up at the margin call', () => {
  // Price falls to 70 for one hour (margin call at 71.43, no liquidation at 62.5),
  // later to 55 (would liquidate). With a reserve of 20 added at the margin-call
  // price: +0.28 BTC -> 1.28 BTC -> liquidation price 50 / (1.28 x 0.8) = 48.83 -> survives.
  const start = toUnix('2024-01-01T00:00Z');
  const h = madeUp({ [start + 5 * 24 * 3600]: 70, [start + 10 * 24 * 3600]: 55 });
  it('without a reserve: liquidated at the second dip', () => {
    const r = replayOne(h, { ...loan, startDate: '2024-01-01' }, start);
    expect(r.marginCall.time).toBe(start + 5 * 24 * 3600);
    expect(r.liquidation.time).toBe(start + 10 * 24 * 3600);
  });
  it('with a reserve of 20: survives', () => {
    const r = replayOne(h, { ...loan, startDate: '2024-01-01', reserveAmount: 20 }, start);
    expect(r.liquidation).toBeNull();
    expect(r.topUp.btc).toBeCloseTo(20 / (50 / 0.7), 10);
  });
});

describe('lender liquidates when a margin call is not fixed within the cure period', () => {
  // Margin call at 71.43, liquidation at 62.5. Price dips to 70 at day 5.
  const start = toUnix('2024-01-01T00:00Z');
  const call = start + 5 * 24 * 3600;
  const t = { ...loan, startDate: '2024-01-01', marginCallConsequence: 'liquidateAfterCure', curePeriodHours: 24 };
  function stays(hours) { // price stays at 70 (low and close) for `hours` hours
    const h = madeUp({});
    const i = h.time.indexOf(call);
    for (let k = 0; k < hours; k++) { h.low[i + k] = 70; h.close[i + k] = 70; }
    return h;
  }
  it('price recovers within 24 hours -> no liquidation', () => {
    const r = replayOne(stays(10), t, start);
    expect(r.marginCall.time).toBe(call);
    expect(r.liquidation).toBeNull();
  });
  it('price still at 70 when the 24 hours are over -> liquidated at the deadline', () => {
    const r = replayOne(stays(48), t, start);
    expect(r.liquidation.time).toBe(call + 24 * 3600);
    expect(r.liquidation.reason).toBe('cureExpired');
  });
  it('with "warning only" the same dip does not liquidate', () => {
    const r = replayOne(stays(48), { ...t, marginCallConsequence: 'warningOnly' }, start);
    expect(r.liquidation).toBeNull();
  });
});

describe('speed-up (skipping quiet days) gives exactly the same answers', () => {
  it.skipIf(!hasData('USD'))('300 random loans and start dates on real USD data', () => {
    const h = loadHourly('USD');
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const days = Math.floor(h.time.length / 24) - 2000;
    for (let k = 0; k < 300; k++) {
      const start = Math.floor(h.time[0] / 86400 + rnd() * days) * 86400;
      const initialLtv = 0.2 + rnd() * 0.5;
      const t = {
        ...loan, loanAmount: 10000, initialLtv, liquidationLtv: Math.min(0.95, initialLtv + 0.05 + rnd() * 0.3),
        marginCallLtv: rnd() < 0.3 ? null : initialLtv + 0.03, durationMonths: 1 + Math.floor(rnd() * 24),
        rate: { type: 'fixed', annual: rnd() * 0.15 }, repayment: ['interestOnly', 'bullet', 'amortizing'][Math.floor(rnd() * 3)],
        reserveAmount: rnd() < 0.5 ? 0 : 3000, curePeriodHours: 24,
        marginCallConsequence: ['warningOnly', 'liquidateAfterCure', 'partialAfterCure', 'autoPartial'][Math.floor(rnd() * 4)],
        liquidationSale: rnd() < 0.3 ? 'partial' : 'all', liquidationFee: { value: rnd() * 0.05, basis: rnd() < 0.5 ? 'debt' : 'collateralSold' },
      };
      if (t.marginCallLtv !== null && t.marginCallLtv >= t.liquidationLtv) t.marginCallLtv = null;
      expect(replayOne(h, t, start), `case ${k}`).toEqual(replayOne(h, t, start, { skipDays: false }));
    }
  });
});

describe('partial sales (hand-calculated, made-up history)', () => {
  // 1 BTC pledged at 100, loan 50 (LTV 50%). Margin call 70% → trigger 71.43; liquidation 80% → 62.50.
  // Target after a sale = starting LTV 50%. A partial sale of value S at price P repays k·S,
  // where k = 1 without fee; S = (debt − 0.5 × BTC × P) / (k − 0.5).
  const start = toUnix('2024-01-01T00:00Z');
  const day = (n) => start + n * 24 * 3600;
  const t = { ...loan, startDate: '2024-01-01', curePeriodHours: 24 };
  const dip = (spec) => { // spec: { dayIndex: [price, hours] }
    const h = madeUp({});
    for (const [d, [p, hours]] of Object.entries(spec)) {
      const i = h.time.indexOf(day(+d));
      for (let k = 0; k < hours; k++) { h.low[i + k] = p; h.close[i + k] = p; }
    }
    return h;
  };

  it('lender sells part automatically at the margin call: the hour\'s low 70 is below 71.43, so 0.4286 BTC at 70, debt 50 → 20; later dip to 55 survives', () => {
    // Sold at the hour's low (issue #7): S = (50 − 0.5 × 70) / 0.5 = 30 → 30/70 BTC. New margin trigger 20 / (0.5714 × 0.7) = 50 < 55.
    const r = replayOne(dip({ 5: [70, 1], 10: [55, 1] }), { ...t, marginCallConsequence: 'autoPartial' }, start);
    expect(r.partialSales).toHaveLength(1);
    expect(r.partialSales[0].price).toBe(70);
    expect(r.partialSales[0].btc).toBeCloseTo(30 / 70, 10);
    expect(r.partialSales[0].time).toBe(day(5));
    expect(r.collateralAtEnd).toBeCloseTo(1 - 30 / 70, 10);
    expect(r.debtScaleAtEnd).toBeCloseTo(20 / 50, 10);
    expect(r.liquidation).toBeNull();
  });
  it('with a 5% fee on the amount repaid: sells 0.4737 BTC at 70, debt → 18.42', () => {
    // k = 1/1.05; S = 15 / (0.952381 − 0.5) = 33.158 → 0.473684 BTC; repaid 31.579.
    const r = replayOne(dip({ 5: [70, 1] }), { ...t, marginCallConsequence: 'autoPartial', liquidationFee: { value: 0.05, basis: 'debt' } }, start);
    expect(r.partialSales[0].btc).toBeCloseTo(0.473684, 5);
    expect(r.debtScaleAtEnd * 50).toBeCloseTo(18.42105, 4);
  });
  it('margin call not fixed within 24 h, lender sells only enough: 0.4286 BTC at 70, debt → 20', () => {
    // At the deadline the price is still 70: S = (50 − 0.5 × 70) / 0.5 = 30 → 30/70 BTC.
    const r = replayOne(dip({ 5: [70, 48] }), { ...t, marginCallConsequence: 'partialAfterCure' }, start);
    expect(r.partialSales).toHaveLength(1);
    expect(r.partialSales[0].time).toBe(day(5) + 24 * 3600);
    expect(r.partialSales[0].reason).toBe('cureExpired');
    expect(r.partialSales[0].btc).toBeCloseTo(30 / 70, 10);
    expect(r.debtScaleAtEnd * 50).toBeCloseTo(20, 8);
    expect(r.liquidation).toBeNull();
  });
  it('same, but the lender sells everything: loan closed at the deadline', () => {
    const r = replayOne(dip({ 5: [70, 48] }), { ...t, marginCallConsequence: 'liquidateAfterCure' }, start);
    expect(r.liquidation.reason).toBe('cureExpired');
    expect(r.liquidation.btcSold).toBeCloseTo(50 / 70, 10);
    expect(r.liquidation.btcReturned).toBeCloseTo(1 - 50 / 70, 10);
  });
  it('at the liquidation LTV the lender sells only enough: the price falls through 62.50 to 55, so 0.8182 BTC at 55, debt → 5', () => {
    // Warning only at the margin call; the hour's low 55 is below 62.5, sold at 55 (issue #7): S = (50 − 0.5 × 55) / 0.5 = 45 → 45/55 BTC.
    const r = replayOne(dip({ 10: [55, 1] }), { ...t, marginCallConsequence: 'warningOnly', liquidationSale: 'partial' }, start);
    expect(r.partialSales).toHaveLength(1);
    expect(r.partialSales[0].reason).toBe('liquidationLtv');
    expect(r.partialSales[0].price).toBe(55);
    expect(r.partialSales[0].btc).toBeCloseTo(45 / 55, 10);
    expect(r.debtScaleAtEnd * 50).toBeCloseTo(5, 8);
    expect(r.liquidation).toBeNull();
  });
  it('the price falls through the liquidation price within an hour: everything sold at the hour\'s low 55, not at 62.50', () => {
    const r = replayOne(dip({ 10: [55, 1] }), { ...t, marginCallConsequence: 'warningOnly' }, start);
    expect(r.liquidation.reason).toBe('liquidationLtv');
    expect(r.liquidation.price).toBe(55);
    expect(r.liquidation.level).toBeCloseTo(62.5, 10);
    expect(r.liquidation.btcSold).toBeCloseTo(50 / 55, 10);
    expect(r.collateralAtEnd).toBeCloseTo(1 - 50 / 55, 10);
  });
  it('replay over all starts reports the share with partial sales separately', () => {
    const r = replayAll(dip({ 100: [70, 1] }), { ...loan, marginCallConsequence: 'autoPartial' });
    expect(r.liquidatedShare).toBe(0);
    // Dip at day 100, 00:00 (10 Apr). One-month loans starting 11 Mar … 9 Apr contain it: 30 starts.
    // (The loan starting 10 Apr 00:00 does not: checks begin with the hour after the start.)
    expect(r.partialShare).toBeCloseTo(30 / 171, 12);
  });
});

const ruleFixtures = JSON.parse(readFileSync(new URL('./fixtures/replay-rules.json', import.meta.url)));
describe('real crashes with margin-call rules: same result as the independent reference program', () => {
  for (const f of ruleFixtures) {
    it.skipIf(!hasData(f.currency))(`${f.currency}: ${f.name}`, () => {
      const start = toUnix(f.start);
      const e = f.expected;
      const r = replayOne(loadHourly(f.currency), { ...f.terms, currency: f.currency, startDate: f.start.slice(0, 10) }, start);
      expect(r.marginCall?.time ?? null).toBe(e.marginCall);
      expect(r.liquidation?.time ?? null).toBe(e.liquidation?.time ?? null);
      expect(r.liquidation?.reason ?? null).toBe(e.liquidation?.reason ?? null);
      expect(r.partialSales.map((p) => [p.time, p.reason])).toEqual(e.partialSales.map((p) => [p.time, p.reason]));
      r.partialSales.forEach((p, i) => expect(p.btc).toBeCloseTo(e.partialSales[i].btc, 9));
      expect(r.collateralAtEnd).toBeCloseTo(e.collateralAtEnd, 9);
    });
  }
});

describe('entry timing (issue #12, decision 015): start days grouped by BTC\'s move in the 90 days before', () => {
  // made-up daily prices, held for every hour of the day: 100 until day 119, 85 from day 120, 210 from day 170
  const t0 = Date.parse('2024-01-01T00:00Z') / 1000; const days = 200;
  const price = (d) => (d < 120 ? 100 : d < 170 ? 85 : 210);
  const time = []; const close = [];
  for (let d = 0; d < days; d++) for (let h = 0; h < 24; h++) { time.push(t0 + d * 86400 + h * 3600); close.push(price(d)); }
  const hourly = { time, open: close, high: close, low: close, close };
  // one start per day at 00:00; liquidated on even days, partly on days divisible by 3 (not even)
  const starts = Array.from({ length: days }, (_, d) => d);
  const perStart = { time: starts.map((d) => t0 + d * 86400), liquidated: starts.map((d) => d % 2 === 0), partial: starts.map((d) => d % 2 !== 0 && d % 3 === 0) };
  const count = (from, to) => { const ds = starts.filter((d) => d >= from && d <= to); return { starts: ds.length, liquidated: ds.filter((d) => d % 2 === 0).length, partial: ds.filter((d) => d % 2 !== 0 && d % 3 === 0).length }; };
  it('the move is the last close before the start against the close 90 days earlier; each start day in exactly one group', () => {
    const e = entryTiming(hourly, perStart);
    const row = (id) => { const r = e.rows.find((x) => x.id === id); return { starts: r.starts, liquidated: r.liquidated, partial: r.partial }; };
    expect(row('early')).toEqual(count(0, 90)); // no close 90 days before the start
    expect(row('flat')).toEqual(count(91, 120)); // 100 → 100 (day 120 starts after day 119's close)
    expect(row('fell')).toEqual(count(121, 170)); // 100 → 85: −15%
    expect(row('doubled')).toEqual(count(171, 199)); // 100 → 210: +110%
    expect(row('rose')).toEqual({ starts: 0, liquidated: 0, partial: 0 });
    expect(row('roseStrongly')).toEqual({ starts: 0, liquidated: 0, partial: 0 });
    expect(e.total).toEqual(count(0, 199));
    expect(e.rows.map((r) => r.id)).toEqual(['fell', 'flat', 'rose', 'roseStrongly', 'doubled', 'early']);
  });
  it('the limits: −10% counts as roughly flat, +10% as rose, +50% as rose strongly, +100% as more than doubled', () => {
    for (const [p, id] of [[89.99, 'fell'], [90, 'flat'], [109.99, 'flat'], [110, 'rose'], [149.99, 'rose'], [150, 'roseStrongly'], [199.99, 'roseStrongly'], [200, 'doubled']]) {
      const c = [...close]; for (let k = 99 * 24; k < 100 * 24; k++) c[k] = p; // the day before a start on day 100
      const e = entryTiming({ ...hourly, close: c }, { time: [t0 + 100 * 86400], liquidated: [true], partial: [false] });
      expect(e.rows.find((r) => r.starts === 1).id, `${p}`).toBe(id);
    }
  });
  it('real history: the table adds up to what the replay reports', () => {
    if (!hasData('EUR')) return;
    const h = loadHourly('EUR'); const t = { ...loan, loanAmount: 10000, durationMonths: 12, liquidationLtv: 0.8, marginCallConsequence: 'warningOnly', curePeriodHours: 48 };
    const r = replayAll(h, t); const e = entryTiming(h, r.perStart);
    expect(e.total.starts).toBe(r.starts);
    expect(e.total.liquidated / e.total.starts).toBeCloseTo(r.liquidatedShare, 12);
    expect(e.total.partial / e.total.starts).toBeCloseTo(r.partialShare, 12);
    expect(e.rows.reduce((a, x) => a + x.starts, 0)).toBe(r.starts);
  });
});

describe('real history from a given start date only (Reddit suggestion, 27 Oct 2026)', () => {
  it('counts only start days from that date on: full and partial sales as shares of those start days', () => {
    const t0 = Date.parse('2019-12-29T00:00Z') / 1000;
    const perStart = { time: [0, 1, 2, 3, 4, 5].map((d) => t0 + d * 86400), liquidated: [true, true, true, false, false, true], partial: [false, false, false, true, false, false] };
    // 29, 30, 31 Dec 2019 left out; 1, 2, 3 Jan 2020 counted: one full, one partial, one nothing
    expect(replaySince(perStart, Date.UTC(2020, 0, 1) / 1000)).toEqual({ starts: 3, liquidatedShare: 1 / 3, partialShare: 1 / 3 });
    expect(replaySince(perStart, Date.UTC(2021, 0, 1) / 1000)).toEqual({ starts: 0, liquidatedShare: null, partialShare: null });
  });
});
