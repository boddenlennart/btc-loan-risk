// The risk calculations behind the results page. Runs inside a Web Worker
// (worker.js), or directly on the page if the browser refuses to start a worker.
import { gunzipSync } from 'fflate';
import { decodeHourly } from '../data/codec.js';
import { dailyFromHourly, dailyReturns } from '../engine/history.js';
import { fitGarchT } from '../engine/garch.js';
import { runMonteCarlo } from '../engine/montecarlo.js';
import { gbmBarrierHitProbability } from '../engine/barrier.js';
import { replayAll } from '../engine/replay.js';
import { collateralBtc, liquidationPrices, marginCallPrices, loanDays, addMonths, daysBetween } from '../engine/loan.js';

const store = {}; // currency -> { hourly, returns, lowRel, sigma, garch }

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function setData(currency, base64, appended) {
  const h = decodeHourly(gunzipSync(b64ToBytes(base64)));
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
  const { returns, lowRel } = dailyReturns(dailyFromHourly(hourly));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sigma = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1) * 365);
  store[currency] = { hourly, returns, lowRel, sigma, garch: null };
}

/** Month ends of the loan in days from the start (calendar months). */
function monthEndsFor(terms) {
  const ends = [];
  for (let m = 1; m <= terms.durationMonths; m++) ends.push(daysBetween(terms.startDate, addMonths(terms.startDate, m)));
  return ends;
}

function mcFor(terms, s, model, settings, { reserve, nPaths, seed }) {
  const days = loanDays(terms);
  const m = marginCallPrices(terms);
  const params = model === 'bootstrap' ? { returns: s.returns, lowRel: s.lowRel, blockDays: settings.blockDays } : s.garch;
  const cureDays = terms.marginCallConsequence === 'liquidateAfterCure' && m ? Math.max(1, Math.ceil((terms.curePeriodHours ?? 0) / 24)) : null;
  return runMonteCarlo({
    model, params, s0: terms.btcPrice, days, nPaths, seed,
    liquidationBarrier: liquidationPrices(terms).byDay,
    marginBarrier: m ? m.byDay : null,
    monthEnds: monthEndsFor(terms),
    logDriftPerDay: Math.log(1 + settings.trend) / 365,
    cureDays,
    reserve: reserve ? { amount: terms.reserveAmount, collateralBtc: collateralBtc(terms) } : null,
  });
}

function whatIfCells(terms) {
  const ltvs = [terms.initialLtv - 0.1, terms.initialLtv, terms.initialLtv + 0.1]
    .map((x) => Math.round(x * 1000) / 1000)
    .filter((x) => x >= 0.05 && x < terms.liquidationLtv - 0.01);
  const durations = [...new Set([Math.max(1, Math.round(terms.durationMonths / 2)), terms.durationMonths, terms.durationMonths * 2])];
  const cells = [];
  for (const ltv of ltvs) {
    for (const months of durations) {
      const t = { ...terms, initialLtv: ltv, durationMonths: months, reserveAmount: 0, cureTargetLtv: null };
      if (t.marginCallLtv && t.marginCallLtv <= ltv) t.marginCallLtv = null;
      if (t.rate.type === 'variable') t.rate = { ...t.rate, path: t.rate.path.filter((p) => p.fromMonth < months) };
      cells.push({ ltv, months, terms: t });
    }
  }
  return { ltvs, durations, cells };
}

async function run(id, terms, settings, garch, post = postMessage) {
  const s = store[terms.currency];
  if (!s) throw new Error(`no price history for ${terms.currency}`);
  if (garch) s.garch = garch;
  const hasReserve = terms.reserveAmount > 0 && !!terms.marginCallLtv;
  const wi = whatIfCells(terms);
  const total = 3 + (hasReserve ? 3 : 0) + wi.cells.length;
  let done = 0;
  // after each step: report progress and give the page a moment to repaint
  const tick = async () => { post({ type: 'progress', id, done: ++done, total }); await new Promise((r) => setTimeout(r, 0)); };
  post({ type: 'progress', id, done, total });

  if (!s.garch) s.garch = fitGarchT(s.returns);
  const result = { garch: s.garch, currency: terms.currency };
  const opts = { nPaths: settings.nPaths, seed: 20240101 };

  result.bootstrap = mcFor(terms, s, 'bootstrap', settings, opts); await tick();
  result.garchMc = mcFor(terms, s, 'garch', settings, opts); await tick();
  result.replay = replayAll(s.hourly, { ...terms, reserveAmount: 0 }); await tick();
  if (hasReserve) {
    result.bootstrapReserve = mcFor(terms, s, 'bootstrap', settings, { ...opts, reserve: true }); await tick();
    result.garchMcReserve = mcFor(terms, s, 'garch', settings, { ...opts, reserve: true }); await tick();
    const r = replayAll(s.hourly, terms);
    result.replayReserve = { starts: r.starts, liquidatedShare: r.liquidatedShare, marginCallShare: r.marginCallShare }; await tick();
  }

  const years = loanDays(terms) / 365;
  const lp = liquidationPrices(terms);
  result.barrier = {
    sigma: s.sigma,
    p: gbmBarrierHitProbability({ s0: terms.btcPrice, barrier: lp.atStart, mu: Math.log(1 + settings.trend) + s.sigma ** 2 / 2, sigma: s.sigma, years }),
  };

  result.history = { from: s.hourly.time[0], to: s.hourly.time[s.hourly.time.length - 1] };
  post({ type: 'partial', id, result: { ...result, whatIf: null } }); // show the main results before the what-if table

  result.whatIf = { ltvs: wi.ltvs, durations: wi.durations, cells: [] };
  for (const c of wi.cells) {
    const mc = mcFor(c.terms, s, 'bootstrap', settings, { nPaths: 2000, seed: 7 });
    const rp = replayAll(s.hourly, c.terms);
    result.whatIf.cells.push({ ltv: c.ltv, months: c.months, p: mc.pLiquidation, replay: rp.liquidatedShare, starts: rp.starts });
    await tick();
  }
  return result;
}

export { setData, run };
