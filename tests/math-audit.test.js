// Maths audit (ux/K-math-audit.md): cases with an answer known in advance, and the properties the page's
// claims rely on (precision, independent random streams, no built-in trend).
import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../src/engine/montecarlo.js';
import { makeRng, mixSeed } from '../src/engine/random.js';
import { recencyWeights, dailyFromHourly, dailyReturns, volatilityAnchors } from '../src/engine/history.js';
import { createLoanState, stepLoan, lenderRules } from '../src/engine/lender.js';

const flat = (n) => new Float64Array(n + 1).fill(5000); // debt 5,000 every day, no interest
const loanOf = (debt, btc, over = {}) => ({ debtByDay: debt, collateralBtc: btc, rules: lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationFee: { value: 0, basis: 'debt' }, ...over }) });
const run = (steps, loan, o = {}) => runMonteCarlo({ model: 'fixed', params: { steps }, s0: 100, days: 60, nPaths: 3, seed: 1, loan, samplePaths: 3, ...o });

describe('answers known in advance', () => {
  it('prices that never move: nothing is ever liquidated and no margin call happens', () => {
    const r = run([[0, 0]], loanOf(flat(60), 100, { marginCallLtv: 0.7, marginCallConsequence: 'liquidateAfterCure' }), { cureDays: 2 });
    expect([r.pLiquidation, r.pPartial, r.pMarginCall]).toEqual([0, 0, 0]);
  });
  it('a steady fall of 2% a day: liquidated exactly on the first day the low reaches the liquidation price', () => {
    // LTV 50% → 80% means a fall to 62.5% of the start price: 0.98^d ≤ 0.625 first at d = 24
    const r = run([[Math.log(0.98), Math.log(0.98)]], loanOf(flat(60), 100));
    expect(r.pLiquidation).toBe(1);
    expect(r.samplePaths.every((p) => p.event.day === Math.ceil(Math.log(0.625) / Math.log(0.98)))).toBe(true);
  });
  it('the day\'s low counts, not only the close: a dip to the liquidation price that recovers the same day still liquidates', () => {
    const steps = [[0, 0], [0, Math.log(0.62)], [0, 0]]; // day 2 dips 38% and closes unchanged
    expect(run(steps, loanOf(flat(60), 100)).samplePaths[0].event.day).toBe(2);
  });
  it('a margin call that is not fixed: the sale happens exactly when the deadline ends, at that day\'s close', () => {
    // price falls 30% on day 3 (below the margin-call price at LTV 70%: 71.4% of start) and stays there
    const steps = [[0, 0], [0, 0], [Math.log(0.7), Math.log(0.7)], [0, 0]];
    const r = runMonteCarlo({ model: 'fixed', params: { steps: [...steps, ...Array(60).fill([0, 0])] }, s0: 100, days: 30, nPaths: 1, seed: 1, samplePaths: 1,
      loan: loanOf(flat(30), 100, { marginCallLtv: 0.7, marginCallConsequence: 'liquidateAfterCure' }), cureDays: 2 });
    expect(r.samplePaths[0].event).toEqual({ day: 3 + 2, kind: 'cureExpired' });
  });
  it('a partial liquidation brings the LTV back exactly to the target, the fee included', () => {
    for (const fee of [{ value: 0.02, basis: 'debt' }, { value: 0.03, basis: 'collateralSold' }]) {
      const rules = lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationSale: 'partial', liquidationFee: fee });
      const s = createLoanState(100);
      stepLoan(s, rules, { time: 1, low: 60, close: 61, debt: 5000, cure: 0 }); // liquidation price 62.5, sold at the low 60
      expect(s.partialSales.length).toBe(1);
      expect((5000 * s.scale) / (s.c * 60)).toBeCloseTo(0.5, 10);
    }
  });
});

describe('a fall through the level: the lender sells at the lowest price of that step, never above the level (issue #7)', () => {
  // 100 BTC, debt 5,000, liquidation at LTV 80% → liquidation price 62.50; the step's low is 55.
  const rulesOf = (over = {}) => lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationFee: { value: 0.05, basis: 'debt' }, ...over });
  it('full sale: sold at 55, not at 62.50; the trigger level is kept', () => {
    const s = createLoanState(100);
    stepLoan(s, rulesOf(), { time: 1, low: 55, close: 70, debt: 5000, cure: 0 });
    expect(s.liquidation.price).toBe(55);
    expect(s.liquidation.level).toBeCloseTo(62.5, 10);
    expect(s.liquidation.btcSold).toBeCloseTo((5000 * 1.05) / 55, 10);
    expect(s.liquidation.btcReturned).toBeCloseTo(100 - (5000 * 1.05) / 55, 10);
  });
  it('a low that only touches the level: sold exactly at the level, as before', () => {
    const s = createLoanState(100);
    stepLoan(s, rulesOf(), { time: 1, low: 62.5, close: 70, debt: 5000, cure: 0 });
    expect(s.liquidation.price).toBe(62.5);
  });
  it('partial sale at the liquidation LTV: sold at 55, and the LTV at that price is back at the target', () => {
    const s = createLoanState(100);
    stepLoan(s, rulesOf({ liquidationSale: 'partial' }), { time: 1, low: 55, close: 70, debt: 5000, cure: 0 });
    expect(s.partialSales[0].price).toBe(55);
    expect(s.partialSales[0].level).toBeCloseTo(62.5, 10);
    expect((5000 * s.scale) / (s.c * 55)).toBeCloseTo(0.5, 10);
  });
  it('sale at the margin call (autoPartial): sold at the low of 68, not at the margin-call price 71.43', () => {
    const s = createLoanState(100);
    stepLoan(s, rulesOf({ marginCallLtv: 0.7, marginCallConsequence: 'autoPartial', liquidationFee: { value: 0, basis: 'debt' } }), { time: 1, low: 68, close: 70, debt: 5000, cure: 0 });
    expect(s.partialSales[0].price).toBe(68);
    expect(s.partialSales[0].btc).toBeCloseTo((5000 - 0.5 * 100 * 68) / 0.5 / 68, 10);
  });
  it('with the step\'s hours known: sold at the low of the first hour that reaches the level, not at the step\'s low', () => {
    const s = createLoanState(100);
    const hours = [90, 70, 60, 58, 55]; // the level 62.50 is first reached in the 3rd hour (low 60); the day goes on to 55
    const firstLow = (level) => hours.find((p) => p <= level) ?? null;
    stepLoan(s, rulesOf(), { time: 1, low: 55, close: 70, debt: 5000, cure: 0, firstLow });
    expect(s.liquidation.price).toBe(60);
    expect(s.liquidation.btcSold).toBeCloseTo((5000 * 1.05) / 60, 10);
  });
  it('simulation with real hours: the day dips to 55, but the level 62.50 is crossed at 60 in its 3rd hour, so the sale is at 60', () => {
    const hours = [0.9, 0.7, 0.6, 0.58, 0.55].map(Math.log); // hourly lows relative to the previous close
    const steps = [[0, 0], [0, Math.log(0.55), hours], ...Array(60).fill([0, 0])];
    const r = runMonteCarlo({ model: 'fixed', params: { steps }, s0: 100, days: 30, nPaths: 1, seed: 1, samplePaths: 1,
      loan: { debtByDay: flat(30), collateralBtc: 100, rules: rulesOf() } });
    expect(r.samplePaths[0].sales[0][1]).toBeCloseTo(60, 10);
  });
  it('bootstrap of real days with their hours: every drawn day crosses the level in its 2nd hour (low 61), the day\'s low is 50', () => {
    const n = 40; const hourLows = Array.from({ length: n }, () => Float64Array.from([0.8, 0.61, 0.5].map(Math.log)));
    const params = { returns: Array(n).fill(0), lowRel: Array(n).fill(Math.log(0.5)), hourLows, blockDays: 5 };
    const r = runMonteCarlo({ model: 'bootstrap', params, s0: 100, days: 30, nPaths: 3, seed: 1, samplePaths: 3,
      loan: { debtByDay: flat(30), collateralBtc: 100, rules: rulesOf() } });
    expect(r.samplePaths.map((p) => p.sales[0][1])).toEqual([61, 61, 61].map((x) => expect.closeTo(x, 9)));
    // with a trend removed or added, the hours move with the day (same shift as the day's low)
    const t = runMonteCarlo({ model: 'bootstrap', params, s0: 100, days: 30, nPaths: 1, seed: 1, samplePaths: 1, logDriftPerDay: 0.01,
      loan: { debtByDay: flat(30), collateralBtc: 100, rules: rulesOf() } });
    expect(t.samplePaths[0].sales[0][1]).toBeCloseTo(61 * Math.exp(0.01), 9);
  });
  it('simulation: a day whose low falls 45% sells at that day\'s low, and the cost of the risk uses that price', () => {
    const steps = [[0, 0], [0, Math.log(0.55)], ...Array(60).fill([0, 0])]; // day 2 dips to 55 and closes at 100
    const r = runMonteCarlo({ model: 'fixed', params: { steps }, s0: 100, days: 30, nPaths: 1, seed: 1, samplePaths: 1, riskCost: true,
      loan: { debtByDay: flat(30), collateralBtc: 100, rules: rulesOf({ liquidationFee: { value: 0, basis: 'debt' } }) } });
    expect(r.samplePaths[0].sales[0][1]).toBeCloseTo(55, 10);
    // all BTC that repaid debt (5,000 / 55) misses the rise back to 100
    expect(r.riskCost.value).toBeCloseTo((5000 / 55) * (100 - 55), 6);
  });
});

describe('the daily series keeps each day\'s hourly lows, relative to the previous close (issue #7)', () => {
  it('two days of 3 hours: day 2\'s hours, in order, against day 1\'s close; the day\'s low is their lowest', () => {
    const t0 = 86400 * 20000;
    const hourly = { time: [0, 1, 2, 86400, 86401, 86402].map((x) => t0 + (x % 86400) * 3600 + Math.floor(x / 86400) * 86400),
      open: [100, 100, 100, 100, 95, 90], low: [99, 98, 97, 95, 80, 88], close: [100, 99, 100, 96, 90, 92] };
    const { lowRel, hourLows } = dailyReturns(dailyFromHourly(hourly), hourly);
    expect(hourLows).toHaveLength(1);
    expect([...hourLows[0]].map(Math.exp)).toEqual([0.95, 0.8, 0.88].map((x) => expect.closeTo(x, 12)));
    expect(Math.exp(lowRel[0])).toBeCloseTo(0.8, 12);
  });
});

describe('calmer or wilder swings (issue #10, decision 021): the same days, every move scaled', () => {
  const rules = lenderRules({ initialLtv: 0.5, liquidationLtv: 0.8, marginCallLtv: null, liquidationFee: { value: 0, basis: 'debt' } });
  const loan = { debtByDay: flat(60), collateralBtc: 100, rules };
  it('a steady fall of 2% a day, twice as wild: each day falls 3.96%, so the 62.5% level is reached on day 12, not day 24', () => {
    const r = run([[Math.log(0.98), Math.log(0.98)]], loan, { volScale: 2 });
    expect(r.samplePaths[0].event.day).toBe(Math.ceil(Math.log(0.625) / (2 * Math.log(0.98))));
  });
  it('a factor of 1 gives exactly the result without it', () => {
    const steps = [[0.01, -0.02], [-0.05, -0.08], [0.02, -0.01], [-0.12, -0.2]];
    expect(run(steps, loan, { volScale: 1 })).toEqual(run(steps, loan));
  });
  it('the hours of a day are scaled with it: lows 0.8 / 0.61 / 0.5 of the previous close, 1.2 times as wild, cross 62.5 at 0.61^1.2', () => {
    const n = 40; const hourLows = Array.from({ length: n }, () => Float64Array.from([0.8, 0.61, 0.5].map(Math.log)));
    const params = { returns: Array(n).fill(0), lowRel: Array(n).fill(Math.log(0.5)), hourLows, blockDays: 5 };
    const r = runMonteCarlo({ model: 'bootstrap', params, s0: 100, days: 30, nPaths: 1, seed: 1, samplePaths: 1, volScale: 1.2, loan });
    expect(r.samplePaths[0].sales[0][1]).toBeCloseTo(100 * 0.61 ** 1.2, 9);
  });
  it('on the same random draws, wilder swings never give fewer liquidations and calmer never more (real-like days, 3 loans)', () => {
    const rng = makeRng(7); const n = 2000;
    const returns = Array.from({ length: n }, () => 0.035 * rng.normal()); const lowRel = returns.map((r) => Math.min(0, r) - Math.abs(0.02 * rng.normal()));
    for (const lLtv of [0.65, 0.8, 0.9]) {
      const l = { debtByDay: flat(365), collateralBtc: 1, rules: lenderRules({ initialLtv: 0.5, liquidationLtv: lLtv, marginCallLtv: null, liquidationFee: { value: 0, basis: 'debt' } }) };
      const p = (k) => runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: 30 }, s0: 10000, days: 365, nPaths: 2000, seed: 3, logDriftPerDay: 0, loan: { ...l, debtByDay: new Float64Array(366).fill(5000) }, volScale: k, countOnly: true }).pLiquidation;
      const [calm, mid, wild] = [0.7, 1, 1.4].map(p);
      expect(calm, `liquidation ${lLtv}`).toBeLessThanOrEqual(mid);
      expect(mid, `liquidation ${lLtv}`).toBeLessThanOrEqual(wild);
      expect(wild).toBeGreaterThan(calm);
    }
  });
  it('the anchors: the calmest run of whole windows of days, and the volatility of the days in 2017–2021, both in yearly terms', () => {
    // 3-day windows on made-up days: moves ±1% except a calm stretch of ±0.1%, and ±5% in 2018
    const t0 = Date.UTC(2016, 11, 25) / 1000; const moves = [];
    for (let i = 0; i < 40; i++) { const y = new Date((t0 + (i + 1) * 86400) * 1000).getUTCFullYear(); const a = i >= 10 && i < 13 ? 0.001 : y === 2018 ? 0.05 : 0.01; moves.push(i % 2 ? a : -a); }
    const close = [100]; for (const m of moves) close.push(close.at(-1) * Math.exp(m));
    const daily = { time: close.map((_, i) => t0 + i * 86400), close };
    const a = volatilityAnchors(daily, moves, { window: 3 });
    const sd = (xs) => { const m = xs.reduce((u, v) => u + v, 0) / xs.length; return Math.sqrt(xs.reduce((u, v) => u + (v - m) ** 2, 0) / xs.length * 365); };
    expect(a.calm.vol).toBeCloseTo(sd(moves.slice(10, 13)), 12);
    expect(a.calm.end).toBe(daily.time[13]);
    const in1721 = moves.filter((_, i) => { const y = new Date(daily.time[i + 1] * 1000).getUTCFullYear(); return y >= 2017 && y <= 2021; });
    expect(a.wild.vol).toBeCloseTo(sd(in1721), 12);
  });
});

describe('borrowing extra cash to buy BTC, compared future by future with not borrowing it', () => {
  // 100 BTC pledged at 100; without the extra cash the loan repays 5,500 at the end; with 1,000 extra
  // (which buys 10 BTC today) it repays 6,600. At the end BTC is at 100 or at 120, the same in every future.
  const levRun = (endRel, lev) => runMonteCarlo({ model: 'fixed', params: { steps: [[Math.log(endRel), 0], [0, 0]] }, s0: 100, days: 30, nPaths: 3, seed: 1,
    loan: loanOf(new Float64Array(31).fill(5000), 100), leverage: lev });
  const base = (endRel) => levRun(endRel, { bought: 0, payback: 5500, repay: 'sell', keepPaths: true }).leverage.endBtcPerPath;
  it('BTC flat: the extra 1,000 costs 1,100 back, so less BTC than without it', () => {
    const r = levRun(1, { bought: 10, payback: 6600, repay: 'sell', base: base(1) });
    expect(r.leverage.lessKept).toBe(1);
    expect(r.leverage.middleDiff.lessKept).toBeCloseTo(10 - 1100 / 100, 9); // −1 BTC
  });
  it('BTC 20% higher: the 10 BTC bought are worth more than the 1,100 to repay, so more BTC', () => {
    const r = levRun(1.2, { bought: 10, payback: 6600, repay: 'sell', base: base(1.2) });
    expect(r.leverage.more).toBe(1);
    expect(r.leverage.middleDiff.more).toBeCloseTo(10 - 1100 / 120, 9);
  });
});

describe('random streams and precision', () => {
  it('one stream per path, all different; runs with neighbouring seeds share no path', () => {
    const run1 = new Set(Array.from({ length: 20000 }, (_, p) => mixSeed(1001, p)));
    expect(run1.size).toBe(20000);
    for (const s of [1002, 1003, 1031]) expect(Array.from({ length: 20000 }, (_, p) => mixSeed(s, p)).filter((x) => run1.has(x)).length).toBe(0);
  });
  it('the count varies between seeds as much as statistics says (independent paths), not less', () => {
    const returns = []; const lowRel = []; const rng = makeRng(7);
    for (let i = 0; i < 3000; i++) { const x = rng.normal() * 0.035; returns.push(x); lowRel.push(Math.min(0, x) - Math.abs(rng.normal()) * 0.01); }
    const ps = [];
    for (let s = 1; s <= 30; s++) ps.push(runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, blockDays: 30 }, s0: 100, days: 180, nPaths: 2000, seed: s, liquidationBarrier: 70, logDriftPerDay: 0 }).pLiquidation);
    const m = ps.reduce((a, b) => a + b, 0) / ps.length;
    const sd = Math.sqrt(ps.reduce((a, b) => a + (b - m) ** 2, 0) / (ps.length - 1));
    const expected = Math.sqrt((m * (1 - m)) / 2000);
    expect(sd).toBeGreaterThan(0.6 * expected);
    expect(sd).toBeLessThan(1.6 * expected);
  });
});

describe('no built-in trend, also with recent days weighted more', () => {
  it('the simulated paths have no drift: their average log move is about 0, although the data rise', () => {
    const rng = makeRng(3); const returns = []; const lowRel = [];
    for (let i = 0; i < 4000; i++) { const x = 0.002 * (i / 4000) + rng.normal() * 0.03; returns.push(x); lowRel.push(Math.min(0, x)); } // rising, and faster lately
    const weights = recencyWeights(returns.length, 3 * 365);
    const r = runMonteCarlo({ model: 'bootstrap', params: { returns, lowRel, weights, blockDays: 30 }, s0: 100, days: 365, nPaths: 4000, seed: 9, liquidationBarrier: 0, logDriftPerDay: 0, collectMinRatios: true });
    // the middle price after a year: within 2% of today (without removing the trend: +40%)
    expect(Math.abs(r.fanByMonth.at(-1).q50 / 100 - 1)).toBeLessThan(0.02);
  });
});

describe('count-only runs ("Make it safer", slider, trends) give exactly the counts of a full run', () => {
  it('random loans on random price moves: liquidated, partly liquidated, margin calls and the months agree exactly', () => {
    const rng = makeRng(11); const returns = []; const lowRel = [];
    for (let i = 0; i < 2000; i++) { const x = rng.normal() * 0.04; returns.push(x); lowRel.push(Math.min(0, x) - Math.abs(rng.normal()) * 0.015); }
    for (let k = 0; k < 12; k++) {
      const ltv = 0.3 + 0.03 * k; const sale = k % 2 ? 'partial' : 'all';
      const consequence = ['warningOnly', 'liquidateAfterCure', 'partialAfterCure', 'autoPartial'][k % 4];
      const loan = loanOf(new Float64Array(366).fill(ltv * 100 * 100), 100, { initialLtv: ltv, liquidationLtv: 0.8, marginCallLtv: (ltv + 0.8) / 2, marginCallConsequence: consequence, liquidationSale: sale, liquidationFee: { value: 0.05, basis: 'debt' } });
      const opts = { model: 'bootstrap', params: { returns, lowRel, blockDays: 30 }, s0: 100, days: 365, nPaths: 3000, seed: 5 + k, logDriftPerDay: 0, loan, cureDays: 2 };
      const full = runMonteCarlo(opts); const fast = runMonteCarlo({ ...opts, countOnly: true });
      expect([fast.pLiquidation, fast.pPartial, fast.pMarginCall, fast.cumulativeByMonth]).toEqual([full.pLiquidation, full.pPartial, full.pMarginCall, full.cumulativeByMonth]);
    }
  });
});
