// The risk calculations behind the results page. Runs inside a Web Worker
// (worker.js), or directly on the page if the browser refuses to start a worker.
// Results are posted in stages so the answer appears first:
//   'partial' after the headline numbers, then 'result' with everything.
import { gunzipSync } from 'fflate';
import { decodeHourly } from '../data/codec.js';
import { convertHourly } from '../data/fx.js';
import { dailyFromHourly, dailyReturns } from '../engine/history.js';
import { fitGarchT } from '../engine/garch.js';
import { runMonteCarlo } from '../engine/montecarlo.js';
import { gbmBarrierHitProbability } from '../engine/barrier.js';
import { replayAll, replayOne } from '../engine/replay.js';
import { lenderRules } from '../engine/lender.js';
import { collateralBtc, liquidationPrices, debtByDay, loanDays, loanSummary, addMonths, daysBetween } from '../engine/loan.js';

const store = {}; // currency -> { hourly, daily, returns, lowRel, sigma, garch, facts }

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Facts about the past for "Does the price trend matter?" and the leverage section (computed once per currency). */
function historyFacts(daily, hourly) {
  const byDay = new Map(daily.time.map((t, i) => [t, daily.close[i]]));
  const ratio = (years) => {
    const out = [];
    for (let i = 0; i < daily.time.length; i++) {
      const later = byDay.get(daily.time[i] + Math.round(365.25 * years) * 86400);
      if (later) out.push(later / daily.close[i]);
    }
    return out;
  };
  const r1 = ratio(1); const r4 = ratio(4);
  const cagr4 = r4.map((r) => r ** 0.25 - 1).sort((a, b) => a - b);
  const pick = (q) => cagr4[Math.floor(q * (cagr4.length - 1))];
  const fourYearByStart = [];
  for (let y = new Date(daily.time[0] * 1000).getUTCFullYear(); ; y++) {
    const a = byDay.get(Date.UTC(y, 0, 1) / 1000); const b = byDay.get(Date.UTC(y + 4, 0, 1) / 1000);
    if (!a || !b) break;
    fourYearByStart.push({ from: y, to: y + 4, perYear: (b / a) ** 0.25 - 1 });
  }
  // calendar years with a fall of at least 50% from a high within the same year
  let deepYears = 0; let years = 0; let worstYear = { year: null, fall: 0 };
  let year = null; let peak = 0; let fall = 0;
  const closeYear = () => { if (year !== null) { years++; if (fall >= 0.5) deepYears++; if (fall > worstYear.fall) worstYear = { year, fall }; } };
  // measured on hourly prices, like everything else on the page (daily prices miss short crashes)
  for (let i = 0; i < hourly.time.length; i++) {
    const y = new Date(hourly.time[i] * 1000).getUTCFullYear();
    if (y !== year) { closeYear(); year = y; peak = 0; fall = 0; }
    peak = Math.max(peak, hourly.close[i]); fall = Math.max(fall, 1 - hourly.low[i] / peak);
  }
  closeYear();
  // How precisely 13 years of data pin down the yearly trend: mean log growth ± 2 standard errors
  const lr = []; for (let i = 1; i < daily.close.length; i++) lr.push(Math.log(daily.close[i] / daily.close[i - 1]));
  const m = lr.reduce((x, y) => x + y, 0) / lr.length;
  const sd = Math.sqrt(lr.reduce((x, y) => x + (y - m) ** 2, 0) / (lr.length - 1));
  const span = lr.length / 365; const se = (sd * Math.sqrt(365)) / Math.sqrt(span);
  const trendRange = { estimate: Math.exp(m * 365) - 1, low: Math.exp(m * 365 - 2 * se) - 1, high: Math.exp(m * 365 + 2 * se) - 1 };
  return {
    trendRange,
    higherAfter1y: r1.filter((x) => x > 1).length / r1.length,
    worst1y: Math.min(...r1) - 1,
    higherAfter4y: r4.filter((x) => x > 1).length / r4.length,
    fourYear: { worst: pick(0), p10: pick(0.1), median: pick(0.5), best: pick(1) },
    fourYearByStart, deepYears, years, worstYear,
  };
}

/** `fx` (optional): ECB rates { days, rates: { [currency]: [...] } }; then `base64` is the euro history
 *  and is converted to `currency` hour by hour. `appended` candles are already in `currency`. */
function setData(currency, base64, appended, fx) {
  const eur = decodeHourly(gunzipSync(b64ToBytes(base64)));
  const h = fx ? convertHourly(eur, fx, currency) : eur;
  let hourly = h;
  if (appended && appended.length) {
    const last = h.time[h.time.length - 1];
    const extra = appended.filter((c) => c.time > last);
    const cat = (k, f) => Float64Array.from([...h[k], ...extra.map(f)]);
    hourly = {
      time: cat('time', (c) => c.time), open: cat('open', (c) => c.open), high: cat('high', (c) => c.high),
      low: cat('low', (c) => c.low), close: cat('close', (c) => c.close),
      noTrade: Uint8Array.from([...h.noTrade, ...extra.map(() => 0)]),
    };
  }
  const daily = dailyFromHourly(hourly);
  const { returns, lowRel } = dailyReturns(daily);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sigma = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1) * 365);
  store[currency] = { hourly, daily, returns, lowRel, sigma, garch: null, facts: historyFacts(daily, hourly) };
}

const monthEndsFor = (t) => Array.from({ length: t.durationMonths }, (_, m) => daysBetween(t.startDate, addMonths(t.startDate, m + 1)));

/** One simulation of the loan `t`. */
function simulate(t, s, settings, { model = 'bootstrap', nPaths = settings.nPaths, trend = 0, samplePaths = 0, leverage = false, seed = 20240101 } = {}) {
  const sum = loanSummary(t);
  return runMonteCarlo({
    model, params: model === 'bootstrap' ? { returns: s.returns, lowRel: s.lowRel, blockDays: settings.blockDays } : s.garch,
    s0: t.btcPrice, days: loanDays(t), nPaths, seed, monthEnds: monthEndsFor(t), samplePaths,
    logDriftPerDay: Math.log(1 + trend) / 365,
    loan: { debtByDay: debtByDay(t), collateralBtc: collateralBtc(t), rules: lenderRules(t) },
    cureDays: Math.max(1, Math.ceil((t.curePeriodHours ?? 0) / 24)),
    leverage: leverage ? { bought: sum.amountReceived / t.btcPrice, payback: sum.totalPayback, repay: t.repayWith === 'cash' ? 'cash' : 'sell' } : null,
  });
}

/** The options in "Make it safer": each is one change to the visitor's own terms. */
function leverList(t) {
  const out = [];
  const add = (id, change, value) => out.push({ id, terms: { ...t, ...change }, value });
  for (const pts of [0.1, 0.2]) {
    const ltv = Math.round((t.initialLtv - pts) * 100) / 100;
    if (ltv >= 0.05) add('lowerLtv', { initialLtv: ltv, ...(t.marginCallLtv && t.marginCallLtv <= ltv ? { marginCallLtv: null } : {}) }, ltv);
  }
  if (t.durationMonths >= 2) {
    const m = Math.max(1, Math.round(t.durationMonths / 2));
    add('shorter', { durationMonths: m, rate: t.rate.type === 'variable' ? { ...t.rate, path: t.rate.path.filter((p) => p.fromMonth < m) } : t.rate }, m);
  }
  if (t.marginCallLtv) {
    const reserve = t.reserveAmount > 0 ? t.reserveAmount : Math.round(t.loanAmount * 0.2 / 100) * 100;
    add('reserve', { reserveAmount: reserve }, reserve);
    if (t.marginCallConsequence !== 'warningOnly') add('warningOnly', { marginCallConsequence: 'warningOnly' }, null);
  }
  if (t.liquidationLtv < 0.95) add('higherLiq', { liquidationLtv: 0.95 }, 0.95);
  if (t.liquidationLtv < 0.95 && t.marginCallLtv && t.marginCallConsequence !== 'warningOnly') add('higherLiqWarning', { liquidationLtv: 0.95, marginCallConsequence: 'warningOnly' }, 0.95);
  if (t.repayment === 'bullet') add('monthlyInterest', { repayment: 'interestOnly', compounding: 'none' }, null);
  return out;
}

/** Yearly trends of the middle simulated path compared in "Does the price trend matter?". */
const TRENDS = [-0.3, 0, 0.2, 0.5, 1.0];

/** Real start dates for "What really happened" and the stress test (only those inside the data). */
const STORIES = ['2017-12-17', '2021-11-10', '2020-02-13', '2023-01-01'];

function story(s, t, iso) {
  const t0 = Date.parse(`${iso}T00:00Z`) / 1000;
  const i0 = s.daily.time.indexOf(t0);
  if (i0 < 0) return null;
  const days = loanDays({ ...t, startDate: iso });
  if (i0 + days >= s.daily.time.length) return null;
  const r = replayOne(s.hourly, { ...t, startDate: iso }, t0);
  const weekly = [];
  for (let d = 0; d <= days; d += 7) weekly.push(Math.min(...s.daily.low.slice(i0 + Math.max(1, d - 6), i0 + d + 1)) / s.daily.open[i0]);
  const sale = r.liquidation ? { day: Math.round((r.liquidation.time - t0) / 86400), reason: r.liquidation.reason }
    : r.partialSales.length ? { day: Math.round((r.partialSales[0].time - t0) / 86400), reason: 'partial' } : null;
  return { start: iso, sale, partialSales: r.partialSales.length, weekly, endRel: s.daily.close[i0 + days] / s.daily.open[i0], btcLeft: r.collateralAtEnd / r.collateralBtc };
}

async function run(id, terms, settings, garch, post = postMessage) {
  const s = store[terms.currency];
  if (!s) throw new Error(`no price history for ${terms.currency}`);
  if (garch) s.garch = garch;
  const levers = leverList(terms);
  const ltvGrid = [];
  // the slider stops below the margin-call LTV (above it, a new loan would start in a margin call)
  const ltvMax = (terms.marginCallLtv || terms.liquidationLtv) - 0.04;
  for (let x = 0.1; x < ltvMax; x += 0.05) ltvGrid.push(Math.round(x * 100) / 100);
  // the visitor's own LTV is always on the slider, so it can show exactly the headline number
  if (terms.initialLtv < ltvMax && !ltvGrid.some((x) => Math.abs(x - terms.initialLtv) < 1e-9)) {
    ltvGrid.push(terms.initialLtv); ltvGrid.sort((a, b) => a - b);
  }
  // other offers in a comparison (settings.compareTerms: one entry per offer, null for this one)
  const others = settings.compareTerms || [];
  const total = 4 + others.filter(Boolean).length + levers.length + ltvGrid.length + TRENDS.length;
  let done = 0;
  // after each step: report progress and give the page a moment to repaint
  const tick = async () => { post({ type: 'progress', id, done: ++done, total }); await new Promise((r) => setTimeout(r, 0)); };
  post({ type: 'progress', id, done, total });
  if (!s.garch) s.garch = fitGarchT(s.returns);

  const buy = terms.purpose === 'buy';
  const result = { currency: terms.currency, garch: s.garch, facts: s.facts, history: { from: s.hourly.time[0], to: s.hourly.time[s.hourly.time.length - 1] } };
  result.main = simulate(terms, s, settings, { samplePaths: 40, leverage: buy }); // 2 × 20 for "show 20 others"
  await tick();
  // Comparison: every other offer on the same simulated futures, so differences come only from
  // the terms. Each value equals what that offer's own full result shows when it is selected.
  result.compare = null;
  if (others.length) {
    result.compare = [];
    for (const t of others) {
      if (!t) { result.compare.push(null); continue; }
      const m = simulate(t, s, settings, { leverage: t.purpose === 'buy' });
      result.compare.push({ pLiquidation: m.pLiquidation, pPartial: m.pPartial, pMarginCall: m.pMarginCall, cumulativeByMonth: m.cumulativeByMonth, leverageMore: m.leverage ? m.leverage.more : null });
      await tick();
    }
  }
  result.garchMc = simulate(terms, s, settings, { model: 'garch' }); await tick();
  result.replay = replayAll(s.hourly, terms); await tick();
  result.stories = STORIES.map((iso) => story(s, terms, iso)).filter(Boolean);
  const lp = liquidationPrices(terms);
  result.barrier = {
    sigma: s.sigma,
    p: gbmBarrierHitProbability({ s0: terms.btcPrice, barrier: lp.atStart, mu: s.sigma ** 2 / 2, sigma: s.sigma, years: loanDays(terms) / 365 }),
  };
  await tick();
  post({ type: 'partial', id, result: { ...result, levers: null, slider: null, trends: null } }); // the answer first

  // "Make it safer" uses the same random paths as the answer, so "your terms as they are" is exactly
  // the headline number and every option differs only by the one change it makes
  result.levers = [];
  for (const l of levers) {
    result.levers.push({ id: l.id, value: l.value, p: simulate(l.terms, s, settings).pLiquidation });
    await tick();
  }
  result.levers.sort((a, b) => a.p - b.p);
  result.leverBase = result.main.pLiquidation;
  post({ type: 'partial', id, result: { ...result, slider: null } }); // the best option under the answer, before the rest
  // "Does the price trend matter?": the same loan at fixed yearly trends of the middle path.
  // Same random paths as the main answer, only shifted, so "no trend" is exactly the answer above.
  result.trends = [];
  for (const trend of TRENDS) {
    const sim = trend === 0 ? result.main : simulate(terms, s, settings, { trend, leverage: buy });
    // liquidated only, like the answer at the top (partial sales are shown separately there)
    result.trends.push({ trend, p: sim.pLiquidation, more: sim.leverage ? sim.leverage.more : null });
    await tick();
  }
  result.slider = [];
  for (const ltv of ltvGrid) {
    const t = { ...terms, initialLtv: ltv, ...(terms.marginCallLtv && terms.marginCallLtv <= ltv ? { marginCallLtv: null } : {}) };
    const own = Math.abs(ltv - terms.initialLtv) < 1e-9;
    result.slider.push({ ltv, p: own ? result.main.pLiquidation : simulate(t, s, settings).pLiquidation, btc: collateralBtc(t) });
    await tick();
  }
  return result;
}

export { setData, run };
