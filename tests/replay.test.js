// Test 2 — Replaying real crashes gives the expected liquidation hour.
// Expected hours come from reference/reference_replay.py, a separate program
// that reads the same raw exchange candles. Both must agree to the hour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { replayOne, replayAll } from '../src/engine/replay.js';
import { loadHourly, hasRaw } from './helpers/history.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/replay-crashes.json', import.meta.url)));
const toUnix = (iso) => Date.parse(iso) / 1000;

describe('real crashes: same liquidation hour as the reference program', () => {
  for (const f of fixtures) {
    it.skipIf(!hasRaw(f.currency))(`${f.currency}: ${f.name}`, () => {
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
