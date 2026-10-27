// The insights page (/insights/): every number is checked against a second, simpler calculation,
// and the same quantity must agree wherever it appears (src/insights/compute.js, real US-dollar history).
import { describe, it, expect, beforeAll } from 'vitest';
import { computeInsights, reference } from '../src/insights/compute.js';
import { replayAll } from '../src/engine/replay.js';
import { dailyFromHourly } from '../src/engine/history.js';
import { loanSummary } from '../src/engine/loan.js';
import { loadHourly, hasData } from './helpers/history.js';

describe('the Insights reference loan keeps the rule its story names (decision 022)', () => {
  it('margin call at 70% with 48 hours to top up, then everything is sold, even though the check page example has only a warning', () => {
    const t = reference();
    expect([t.marginCallLtv, t.marginCallConsequence, t.curePeriodHours, t.liquidationLtv]).toEqual([0.7, 'liquidateAfterCure', 48, 0.8]);
  });
});

describe.skipIf(!hasData('USD'))('insights on the real US-dollar history', () => {
  let h; let I; let d;
  beforeAll(() => { h = loadHourly('USD'); d = dailyFromHourly(h); I = computeInsights(h); }, 180000);

  it('the reference loan is the same everywhere: map (50%, 12 months) = lever base = price-measure row = cost row = replay run directly', () => {
    const direct = replayAll(h, reference()).liquidatedShare;
    expect(I.survival.cells.find((c) => c.ltv === 0.5 && c.months === 12).liquidated).toBe(direct);
    expect(I.levers.base).toBe(direct);
    expect(I.measure.find((m) => m.ltv === 0.5).lows).toBe(direct);
    expect(I.cost.rows.find((r) => r.ltv === 0.5).liquidated).toBeCloseTo(direct, 12);
    expect(I.partial.saleDays).toBe(Math.round(direct * I.partial.starts));
  });
  it('survival map: a higher starting LTV was never liquidated less often, and every duration has all six LTVs', () => {
    for (const months of [6, 12, 24, 36]) {
      const row = I.survival.cells.filter((c) => c.months === months).sort((a, b) => a.ltv - b.ltv);
      expect(row.map((c) => c.ltv)).toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
      for (let k = 1; k < row.length; k++) expect(row[k].liquidated).toBeGreaterThanOrEqual(row[k - 1].liquidated);
    }
    for (const n of I.survival.neverAbove) if (n.ltv !== null) expect(I.survival.cells.find((c) => c.ltv === n.ltv && c.months === n.months).liquidated).toBe(0);
  });
  it('worst falls equal a plain double loop over the days (30 days), and are ordered', () => {
    const w = 30; const falls = [];
    for (let i = 0; i + w <= d.time.length; i++) { let lo = Infinity; for (let j = i; j < i + w; j++) lo = Math.min(lo, d.low[j]); falls.push(1 - lo / d.open[i]); }
    const f = I.falls.find((x) => x.days === 30);
    expect(f.periods).toBe(falls.length);
    expect(f.worst).toBeCloseTo(Math.max(...falls), 12);
    const s = falls.slice().sort((a, b) => a - b);
    expect(f.q90).toBeCloseTo(s[Math.ceil(0.9 * s.length) - 1], 12);
    for (const x of I.falls) expect(x.q50 <= x.q90 && x.q90 <= x.q95 && x.q95 <= x.worst).toBe(true);
    for (let k = 1; k < I.falls.length; k++) expect(I.falls[k].q90).toBeGreaterThanOrEqual(I.falls[k - 1].q90); // a longer window, a larger fall
  });
  it('crash speed: shares grow with the hours and stay within all margin calls', () => {
    const s = I.speed;
    expect(s.marginCalls).toBe(Math.round(replayAll(h, reference({ marginCallConsequence: 'warningOnly' })).marginCallShare * s.starts));
    expect(s.within24 <= s.within48 && s.within48 <= s.within72 && s.within72 <= s.liquidatedLater && s.liquidatedLater <= 1).toBe(true);
    expect(s.outsideOfficeHours).toBeGreaterThan(0); expect(s.outsideOfficeHours).toBeLessThan(1);
  });
  it('levers: each equals its own replay; sorted from the lowest', () => {
    const over = { lowerLtv: { initialLtv: 0.4 }, shorter: { durationMonths: 6 }, reserve: { reserveAmount: 2000 } };
    for (const [id, o] of Object.entries(over)) expect(I.levers.levers.find((l) => l.id === id).liquidated).toBe(replayAll(h, reference(o)).liquidatedShare);
    const v = I.levers.levers.map((l) => l.liquidated);
    expect(v).toEqual(v.slice().sort((a, b) => a - b));
    expect(I.survival.cells.find((c) => c.ltv === 0.4 && c.months === 12).liquidated).toBe(I.levers.levers.find((l) => l.id === 'lowerLtv').liquidated);
  });
  it('reserve: ordered quantiles; a higher starting LTV needs more extra BTC', () => {
    for (const r of I.reserve) expect(r.q50 <= r.q90 && r.q90 <= r.q95 && r.q95 <= r.max).toBe(true);
    for (let k = 1; k < I.reserve.length; k++) expect(I.reserve[k].q90).toBeGreaterThan(I.reserve[k - 1].q90);
  });
  it('cost including the risk = interest and fees + liquidated share × average loss; interest and fees as in the payment plan', () => {
    for (const r of [...I.cost.rows, ...I.cost.offers]) {
      expect(r.expected).toBeCloseTo(r.cost + r.liquidated * r.avgLoss, 6);
      expect(r.cost).toBeCloseTo(loanSummary({ ...reference({ initialLtv: r.ltv, rate: { type: 'fixed', annual: r.rate } }), btcPrice: 1, startDate: '2020-01-01' }).totalCost, 6);
    }
  });
  it('a smoother price (hourly closes) never liquidates more often than the hourly lows', () => {
    for (const m of I.measure) expect(m.closes).toBeLessThanOrEqual(m.lows);
  });
  it('buying more BTC: "rose more than needed" equals a plain count over the days', () => {
    const n12 = I.buy.needed.find((x) => x.months === 12); const days = Math.round((12 * 365.25) / 12);
    let yes = 0; let all = 0;
    for (let i = 0; i + days < d.time.length; i++) { all++; if (d.close[i + days] / d.open[i] - 1 > n12.need) yes++; }
    expect(n12.rose).toBeCloseTo(yes / all, 12);
    const s = loanSummary({ ...reference(), btcPrice: 1, startDate: '2020-01-01' });
    expect(n12.need).toBeCloseTo(s.totalPayback / s.amountReceived - 1, 12);
    for (const c of I.buy.cells) expect(c.more).toBeGreaterThan(0);
  });
  it('borrowing vs selling: a tax on selling now makes borrowing win at least as often', () => {
    for (const ltv of [0.3, 0.5]) {
      const none = I.spend.find((x) => x.ltv === ltv && x.tax === 'none'); const taxed = I.spend.find((x) => x.ltv === ltv && x.tax === 'sellNowTaxed');
      expect(taxed.borrowWon).toBeGreaterThanOrEqual(none.borrowWon);
      expect(none.breakeven).toBeCloseTo(0.111, 2);
    }
  });
  it('today\'s swings: the last value equals the volatility of the last 30 daily moves, computed again here', () => {
    const r = []; for (let i = d.close.length - 30; i < d.close.length; i++) r.push(Math.log(d.close[i] / d.close[i - 1]));
    const m = r.reduce((a, b) => a + b, 0) / r.length;
    const vol = Math.sqrt((r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)) * 365);
    expect(I.swings.now).toBeCloseTo(vol, 12);
    expect(I.swings.q10 <= I.swings.q50 && I.swings.q50 <= I.swings.q90).toBe(true);
    expect(I.swings.calmerShare).toBeGreaterThanOrEqual(0); expect(I.swings.calmerShare).toBeLessThanOrEqual(1);
    expect(I.swings.weekly.at(-1)[0]).toBe(I.swings.asOf);
  });
});
