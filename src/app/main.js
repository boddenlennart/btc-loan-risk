// The page: builds the form from the field list, reads it into loan terms,
// shows the simple loan numbers at once and asks the worker for the risk results.
// No text lives here: every word comes from src/content/text.*.js via t().
import { initLang, setLang, getLang, t, texts, rich, esc } from './i18n.js';
import { money, money0, pct, num, btc, date, dateTime, isoDate } from './format.js';
import { fanChart, barChart, replayStrip } from './charts.js';
import { EXAMPLE_TERMS } from '../content/examples.js';
import { validateTerms } from '../engine/validate.js';
import {
  loanSummary, collateralBtc, liquidationPrices, marginCallPrices, dropToLiquidation, topUpToCure,
  costIfLiquidated, breakevenReturn, earlyRepaymentCost, addMonths, daysBetween,
} from '../engine/loan.js';
import { getSpotPrice } from '../live/price.js';
import { setData as jobSetData, run as jobRun } from './riskjob.js';

const META = JSON.parse(document.getElementById('meta').textContent);
const STORE_KEY = 'btc-loan-risk:form';
const $ = (sel, root = document) => root.querySelector(sel);

// ---------------------------------------------------------------- form spec
// kind: money | percent | int | number | select | date | text | textarea | ratePath | fee
// show(state): whether the field applies; badge: show "example" badge while unchanged
const GROUPS = [
  ['groupBasics', [
    { id: 'currency', kind: 'select', options: Object.keys(META.prices) },
    { id: 'btcPrice', kind: 'money' },
    { id: 'loanAmount', kind: 'money', badge: true },
    { id: 'startDate', kind: 'date' },
    { id: 'durationMonths', kind: 'int', badge: true },
  ]],
  ['groupLtv', [
    { id: 'initialLtv', kind: 'percent', badge: true },
    { id: 'marginCallLtv', kind: 'percent', optional: true, badge: true },
    { id: 'liquidationLtv', kind: 'percent', badge: true },
  ]],
  ['groupInterest', [
    { id: 'rateType', kind: 'select', options: ['fixed', 'variable'], badge: true },
    { id: 'rateAnnual', kind: 'percent', badge: true, show: (s) => s.rateType === 'fixed' },
    { id: 'ratePath', kind: 'ratePath', badge: true, show: (s) => s.rateType === 'variable' },
    { id: 'repayment', kind: 'select', options: ['interestOnly', 'bullet', 'amortizing'], badge: true },
    { id: 'compounding', kind: 'select', options: ['none', 'monthly'], badge: true, show: (s) => s.repayment === 'bullet' },
    { id: 'dayCount', kind: 'select', options: ['30/360', 'act/365', 'act/360'], advanced: true },
  ]],
  ['groupFees', [
    { id: 'originationFee', kind: 'fee', badge: true },
    { id: 'liquidationFee', kind: 'percent', badge: true },
    { id: 'liquidationFeeBasis', kind: 'select', options: ['debt', 'collateralSold'], badge: true },
    { id: 'earlyRepaymentFee', kind: 'percent', badge: true },
  ]],
  ['groupMarginCall', [
    { id: 'curePeriodHours', kind: 'number', optional: true, badge: true },
    { id: 'marginCallConsequence', kind: 'select', options: ['warningOnly', 'liquidateAfterCure'], badge: true },
    { id: 'cureTargetLtv', kind: 'percent', optional: true },
    { id: 'reserveAmount', kind: 'money', badge: true },
  ]],
  ['groupTax', [
    { id: 'taxRateNow', kind: 'percent' },
    { id: 'taxRateAtMaturity', kind: 'percent' },
    { id: 'taxJurisdiction', kind: 'text' },
  ]],
  ['groupNotes', [{ id: 'notes', kind: 'textarea' }]],
  ['groupSimulation', [
    { id: 'simPaths', kind: 'select', options: ['2000', '10000', '20000'] },
    { id: 'bootstrapBlockDays', kind: 'int' },
    { id: 'assumedTrend', kind: 'percent' },
  ], true],
];
const FIELDS = GROUPS.flatMap(([, f]) => f);

const today = () => new Date().toISOString().slice(0, 10);
const P = (x) => (x === null || x === undefined ? '' : Math.round(x * 1e6) / 1e4); // fraction -> percent number

function exampleState() {
  const e = EXAMPLE_TERMS;
  return {
    currency: e.currency, btcPrice: '', loanAmount: e.loanAmount, startDate: today(), durationMonths: e.durationMonths,
    initialLtv: P(e.initialLtv), marginCallLtv: P(e.marginCallLtv), liquidationLtv: P(e.liquidationLtv),
    rateType: e.rate.type, rateAnnual: P(e.rate.annual), ratePath: e.rate.path.map((s) => ({ fromMonth: s.fromMonth, rate: P(s.annual) })),
    repayment: e.repayment, compounding: e.compounding, dayCount: e.dayCount,
    originationFee: { value: e.originationFee.type === 'percent' ? P(e.originationFee.value) : e.originationFee.value, type: e.originationFee.type },
    liquidationFee: P(e.liquidationFee.value), liquidationFeeBasis: e.liquidationFee.basis, earlyRepaymentFee: P(e.earlyRepaymentFee),
    curePeriodHours: e.curePeriodHours ?? '', marginCallConsequence: e.marginCallConsequence, cureTargetLtv: P(e.cureTargetLtv),
    reserveAmount: e.reserveAmount, taxRateNow: P(e.taxRateNow), taxRateAtMaturity: P(e.taxRateAtMaturity),
    taxJurisdiction: e.taxJurisdiction, notes: e.notes,
    simPaths: String(e.simPaths), bootstrapBlockDays: e.bootstrapBlockDays, assumedTrend: P(e.assumedTrend),
  };
}
const EXAMPLE = exampleState();

let state = loadState();
if (!META.prices[state.currency]) state.currency = Object.keys(META.prices)[0];
let priceInfo = null; // { source, time, stale } | { source: 'manual' }

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...EXAMPLE, ...saved.state };
  } catch { /* storage blocked or broken: start fresh */ }
  return { ...EXAMPLE };
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ state })); } catch { /* ignore */ }
}

const numOrNull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const numOrNaN = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const frac = (v) => { const n = numOrNull(v); return n === null ? null : n / 100; };

/** Form state -> engine terms (fractions) and simulation settings. */
function toTerms(s) {
  const fee = s.originationFee;
  const terms = {
    currency: s.currency, btcPrice: numOrNaN(s.btcPrice), loanAmount: numOrNaN(s.loanAmount), startDate: s.startDate || today(),
    durationMonths: numOrNaN(s.durationMonths), initialLtv: numOrNaN(s.initialLtv) / 100, marginCallLtv: frac(s.marginCallLtv),
    liquidationLtv: numOrNaN(s.liquidationLtv) / 100,
    rate: s.rateType === 'variable'
      ? { type: 'variable', path: s.ratePath.map((r) => ({ fromMonth: numOrNaN(r.fromMonth), annual: numOrNaN(r.rate) / 100 })) }
      : { type: 'fixed', annual: numOrNaN(s.rateAnnual) / 100 },
    repayment: s.repayment, compounding: s.repayment === 'bullet' ? s.compounding : 'none', dayCount: s.dayCount,
    originationFee: { type: fee.type, value: fee.type === 'percent' ? numOrNaN(fee.value) / 100 : numOrNaN(fee.value) },
    liquidationFee: { value: numOrNaN(s.liquidationFee) / 100, basis: s.liquidationFeeBasis },
    earlyRepaymentFee: frac(s.earlyRepaymentFee) ?? 0,
    curePeriodHours: numOrNull(s.curePeriodHours), marginCallConsequence: s.marginCallConsequence,
    cureTargetLtv: frac(s.cureTargetLtv), reserveAmount: numOrNull(s.reserveAmount) ?? 0,
    taxRateNow: frac(s.taxRateNow) ?? 0, taxRateAtMaturity: frac(s.taxRateAtMaturity) ?? 0,
  };
  const settings = {
    nPaths: Number(s.simPaths) || 10000,
    blockDays: Math.max(1, Math.round(numOrNull(s.bootstrapBlockDays) ?? 30)),
    trend: (numOrNull(s.assumedTrend) ?? 0) / 100,
  };
  return { terms, settings };
}

// ---------------------------------------------------------------- rendering the form
function control(f) {
  const v = state[f.id];
  const id = `f-${f.id}`;
  const optAttr = 'aria-describedby';
  const desc = `h-${f.id}`;
  if (f.kind === 'select') {
    const opts = f.options.map((o) => `<option value="${esc(o)}"${String(v) === o ? ' selected' : ''}>${esc(t(`options.${f.id}.${o}`))}</option>`).join('');
    return `<select id="${id}" data-k="${f.id}" ${optAttr}="${desc}">${opts}</select>`;
  }
  if (f.kind === 'textarea') return `<textarea id="${id}" data-k="${f.id}" rows="3" ${optAttr}="${desc}">${esc(v ?? '')}</textarea>`;
  if (f.kind === 'text') return `<input id="${id}" data-k="${f.id}" type="text" value="${esc(v ?? '')}" ${optAttr}="${desc}">`;
  if (f.kind === 'date') return `<input id="${id}" data-k="${f.id}" type="date" value="${esc(v ?? '')}" ${optAttr}="${desc}">`;
  if (f.kind === 'fee') {
    const opts = ['percent', 'fixed'].map((o) => `<option value="${o}"${v.type === o ? ' selected' : ''}>${esc(t(`options.feeType.${o}`))}</option>`).join('');
    return `<div class="pair"><input id="${id}" data-k="originationFee.value" type="number" step="any" min="0" inputmode="decimal" value="${esc(v.value)}" ${optAttr}="${desc}"><select data-k="originationFee.type" aria-label="${esc(t('inputs.originationFee.label'))}">${opts}</select></div>`;
  }
  if (f.kind === 'ratePath') {
    const rows = v.map((r, i) => `<div class="pair rate-row">
      <label>${esc(t('ui.fromMonth'))}<input type="number" step="1" min="0" inputmode="numeric" data-k="ratePath.${i}.fromMonth" value="${esc(r.fromMonth)}"></label>
      <label>${esc(t('ui.ratePercent'))}<input type="number" step="any" min="0" inputmode="decimal" data-k="ratePath.${i}.rate" value="${esc(r.rate)}"></label>
      ${i > 0 ? `<button type="button" class="link" data-remove-rate="${i}">${esc(t('ui.removeRateStep'))}</button>` : ''}</div>`).join('');
    return `<div id="${id}">${rows}<button type="button" class="link" data-add-rate>${esc(t('ui.addRateStep'))}</button></div>`;
  }
  const unit = f.kind === 'percent' ? '%' : f.kind === 'money' ? esc(state.currency) : '';
  const step = f.kind === 'int' ? '1' : 'any';
  const extra = f.id === 'btcPrice' ? `<button type="button" class="secondary" id="refresh-price">${esc(t('ui.refreshPrice'))}</button>` : '';
  return `<div class="pair"><span class="with-unit"><input id="${id}" data-k="${f.id}" type="number" step="${step}" inputmode="decimal" value="${esc(v ?? '')}" ${optAttr}="${desc}">${unit ? `<span class="unit">${unit}</span>` : ''}</span>${extra}</div>`;
}

function fieldHtml(f) {
  const tx = texts().inputs[f.id];
  const opt = f.optional ? ` <span class="muted">(${esc(t('ui.optional'))})</span>` : '';
  const live = f.id === 'btcPrice' ? '<p class="live" id="live-status" aria-live="polite"></p>' : '';
  return `<div class="field" data-field="${f.id}">
    <div class="label-row"><label for="f-${f.id}">${esc(tx.label)}${opt}</label>
      <button type="button" class="q" aria-expanded="false" aria-controls="m-${f.id}" aria-label="${esc(t('ui.moreButton'))}: ${esc(tx.label)}">?</button></div>
    ${control(f)}
    ${live}
    <p class="badge" hidden>${esc(t('ui.exampleBadge'))}</p>
    <p class="err" role="alert" hidden></p>
    <p class="hint" id="h-${f.id}">${rich(tx.hint)}</p>
    <p class="where"><b>${esc(t('ui.whereToFind'))}</b> ${rich(tx.where)}</p>
    <div class="more" id="m-${f.id}" hidden>${rich(tx.more)}</div>
  </div>`;
}

function renderForm() {
  const html = GROUPS.map(([g, fields, collapsed]) => {
    const main = fields.filter((f) => !f.advanced).map(fieldHtml).join('');
    const adv = fields.filter((f) => f.advanced);
    const advHtml = adv.length ? `<details class="advanced"><summary>${esc(t('ui.advanced'))}</summary>${adv.map(fieldHtml).join('')}</details>` : '';
    const inner = `${main}${advHtml}`;
    return collapsed
      ? `<details class="group"><summary><h3>${esc(t(`ui.${g}`))}</h3></summary>${inner}</details>`
      : `<fieldset class="group"><legend><h3>${esc(t(`ui.${g}`))}</h3></legend>${inner}</fieldset>`;
  }).join('');
  $('#form').innerHTML = html;
  syncFormVisibility();
  renderLiveStatus();
}

function syncFormVisibility() {
  for (const f of FIELDS) {
    const el = $(`[data-field="${f.id}"]`);
    if (!el) continue;
    el.hidden = f.show ? !f.show(state) : false;
    const badge = $('.badge', el);
    badge.hidden = !(f.badge && JSON.stringify(state[f.id]) === JSON.stringify(EXAMPLE[f.id]));
  }
  for (const u of document.querySelectorAll('[data-field] .unit')) {
    if (u.closest('[data-field="btcPrice"], [data-field="loanAmount"], [data-field="reserveAmount"]')) u.textContent = state.currency;
  }
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function onInput(e) {
  const k = e.target.dataset.k;
  if (!k) return;
  const v = e.target.value;
  state = structuredClone(state);
  setPath(state, k, v);
  if (k === 'btcPrice') { state.priceManual = true; priceInfo = { source: 'manual' }; renderLiveStatus(); }
  saveState();
  if (k === 'currency') { onCurrencyChange(); return; }
  syncFormVisibility();
  update();
}

function onClick(e) {
  const q = e.target.closest('button.q');
  if (q) {
    const more = document.getElementById(q.getAttribute('aria-controls'));
    const open = q.getAttribute('aria-expanded') !== 'true';
    q.setAttribute('aria-expanded', String(open));
    more.hidden = !open;
    return;
  }
  if (e.target.matches('[data-add-rate]')) {
    const last = state.ratePath[state.ratePath.length - 1];
    state = structuredClone(state);
    state.ratePath.push({ fromMonth: Number(last.fromMonth) + 1, rate: last.rate });
    saveState(); renderForm(); update();
  } else if (e.target.matches('[data-remove-rate]')) {
    state = structuredClone(state);
    state.ratePath.splice(Number(e.target.dataset.removeRate), 1);
    saveState(); renderForm(); update();
  } else if (e.target.id === 'refresh-price') {
    loadPrice(true);
  }
}

// ---------------------------------------------------------------- live price & data
const SOURCE_NAMES = { coinbase: 'Coinbase', kraken: 'Kraken', binance: 'Binance', coingecko: 'CoinGecko' };
function renderLiveStatus() {
  const el = $('#live-status');
  if (!el) return;
  el.classList.remove('stale');
  if (!priceInfo) el.textContent = t('ui.livePriceLoading');
  else if (priceInfo.source === 'manual') el.textContent = t('ui.livePriceManual');
  else if (priceInfo.stale) { el.textContent = t('ui.livePriceStale', { time: dateTime(priceInfo.time) }); el.classList.add('stale'); }
  else el.textContent = t('ui.livePriceFrom', { source: SOURCE_NAMES[priceInfo.source] ?? priceInfo.source, time: dateTime(priceInfo.time) });
  $('#stale-banner').hidden = !(priceInfo && priceInfo.stale);
}

async function loadPrice(force = false) {
  if (!force && priceInfo && priceInfo.source === 'manual') return;
  priceInfo = null; renderLiveStatus();
  const embedded = Object.fromEntries(Object.entries(META.prices).map(([c, m]) => [c, { price: m.lastClose, time: m.to }]));
  const cur = state.currency;
  const r = await getSpotPrice(cur, { embedded });
  if (cur !== state.currency) return;
  priceInfo = r;
  state = { ...state, btcPrice: r.price, priceManual: false };
  saveState();
  const input = $('#f-btcPrice');
  if (input) input.value = r.price;
  renderLiveStatus();
  update();
}

const appended = {}; // currency -> recent candles fetched from the exchange after the page was built
async function fetchRecentCandles(cur) {
  const m = META.prices[cur];
  const out = [];
  let start = m.to + 3600;
  const now = Date.now() / 1000;
  try {
    for (let k = 0; k < 12 && start < now - 7200; k++) {
      const res = await fetch(`https://www.bitstamp.net/api/v2/ohlc/btc${cur.toLowerCase()}/?step=3600&limit=1000&start=${start}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      const j = await res.json();
      const rows = (j.data && j.data.ohlc) || [];
      if (!rows.length) break;
      for (const c of rows) {
        const o = { time: +c.timestamp, open: +c.open, high: +c.high, low: +c.low, close: +c.close };
        const ok = o.time >= start && o.time % 3600 === 0 && o.low > 0 && o.low <= Math.min(o.open, o.close) && o.high >= Math.max(o.open, o.close);
        if (ok && o.time + 3600 <= now) out.push(o);
      }
      start = +rows[rows.length - 1].timestamp + 3600;
    }
  } catch { /* offline or blocked: keep the embedded history only */ }
  return out;
}

// ---------------------------------------------------------------- worker
// '#no-worker' in the address forces the fallback path (to test how the page behaves where workers are blocked)
let worker = null; let useInline = location.hash === '#no-worker'; let runId = 0; let busy = false;
const sentData = new Set();
const garchCache = {};

function makeWorker() {
  sentData.clear();
  if (useInline) return;
  try {
    const src = document.getElementById('worker-src').textContent;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => onWorkerMessage(e.data);
    worker.onerror = () => { useInline = true; worker = null; update(); };
  } catch {
    useInline = true; worker = null;
  }
}

function sendData(cur) {
  if (sentData.has(cur)) return;
  const msg = { type: 'data', currency: cur, base64: document.getElementById(`data-${cur}`).textContent.trim(), appended: appended[cur] };
  if (useInline) jobSetData(msg.currency, msg.base64, msg.appended);
  else worker.postMessage(msg);
  sentData.add(cur);
}

function onWorkerMessage(m) {
  if (m.id !== runId) return;
  if (m.type === 'progress') {
    $('#progress').hidden = false;
    $('#progress').textContent = t('ui.computing', { done: m.done, total: m.total });
  } else if (m.type === 'partial' || m.type === 'result') {
    garchCache[m.result.currency] = m.result.garch;
    lastRisk = m.result;
    if (m.type === 'result') { busy = false; $('#progress').hidden = true; }
    renderRisk();
  } else if (m.type === 'error') {
    busy = false;
    $('#progress').textContent = m.message;
  }
}

function requestRisk(terms, settings) {
  runId++;
  if (busy && !useInline) { worker.terminate(); makeWorker(); }
  if (!worker && !useInline) makeWorker();
  sendData(terms.currency);
  busy = true;
  const msg = { type: 'run', id: runId, terms, settings, garch: garchCache[terms.currency] || null };
  if (useInline) {
    const id = runId;
    jobRun(id, terms, settings, msg.garch, onWorkerMessage)
      .then((result) => onWorkerMessage({ type: 'result', id, result }))
      .catch((err) => onWorkerMessage({ type: 'error', id, message: String(err.message || err) }));
  } else {
    worker.postMessage(msg);
  }
}

// ---------------------------------------------------------------- results
let lastTerms = null; let lastSettings = null; let lastRisk = null; let timer = null; let started = false;

function showErrors(errors) {
  for (const el of document.querySelectorAll('[data-field] .err')) { el.hidden = true; el.textContent = ''; }
  const fieldFor = (f) => (f === 'rate' ? (state.rateType === 'variable' ? 'ratePath' : 'rateAnnual') : f);
  for (const e of errors) {
    const el = $(`[data-field="${fieldFor(e.field)}"] .err`);
    if (!el) continue;
    const tx = texts().errors[e.code];
    el.hidden = false;
    el.textContent += `${tx.problem} ${tx.fix} `;
  }
  $('#error-banner').hidden = errors.length === 0;
}

function update() {
  const { terms, settings } = toTerms(state);
  const v = validateTerms(terms);
  showErrors(v.errors);
  if (!v.ok) {
    $('#results').classList.add('invalid');
    $('#summary-bar').innerHTML = `<span>${esc(t('ui.summaryLiq'))}: <b>–</b></span><span>${esc(t('ui.summaryProb'))}: <b>–</b></span>`;
    return;
  }
  $('#results').classList.remove('invalid');
  lastTerms = terms; lastSettings = settings;
  renderLoan();
  clearTimeout(timer);
  $('#progress').hidden = false;
  $('#progress').textContent = t('ui.computing', { done: 0, total: '…' });
  if (!started) return; // the first run waits for the live price and recent prices (see start)
  timer = setTimeout(() => requestRisk(terms, settings), 350);
}

const card = (id, value, extra = '', cls = '') => {
  const o = texts().outputs[id];
  return `<div class="card ${cls}" data-output="${id}"><h4>${esc(o.label)}</h4><div class="value">${value}</div>${extra}
    <details class="meaning"><summary>${esc(t('ui.meaningButton'))}</summary><p>${rich(o.meaning)}</p></details></div>`;
};

function renderLoan() {
  const tm = lastTerms; const cur = tm.currency;
  const s = loanSummary(tm);
  const lp = liquidationPrices(tm);
  const mp = marginCallPrices(tm);
  const c = collateralBtc(tm);
  const target = tm.cureTargetLtv ?? tm.initialLtv;
  const top = mp ? topUpToCure(tm, { price: mp.atStart, debt: tm.loanAmount, targetLtv: target }) : null;
  const liq = costIfLiquidated(tm, { price: lp.atStart, debt: tm.loanAmount });
  const half = Math.max(1, Math.floor(tm.durationMonths / 2));
  const two = (a, b) => `${a} <span class="sub">${esc(t('ui.atStart'))}</span><br>${b} <span class="sub">${esc(t('ui.atMaturity'))}</span>`;
  const sameEnds = (p) => Math.abs(p.atStart - p.atMaturity) < 0.005;

  $('#loan-basics').innerHTML = [
    card('collateralBtc', `${btc(c)}<span class="sub"> = ${money(c * tm.btcPrice, cur)}</span>`),
    card('amountReceived', money(s.amountReceived, cur)),
    card('liquidationPrice', sameEnds(lp) ? `${money(lp.atStart, cur)} <span class="sub">${esc(t('ui.perBtc'))}</span>` : two(money(lp.atStart, cur), money(lp.atMaturity, cur))),
    card('marginCallPrice', mp ? (sameEnds(mp) ? money(mp.atStart, cur) : two(money(mp.atStart, cur), money(mp.atMaturity, cur))) : esc(t('ui.none'))),
    card('dropToLiquidation', pct(dropToLiquidation(tm))),
  ].join('');

  const rows = s.schedule.map((r) => `<tr><td>${r.month}</td><td>${esc(isoDate(r.date))}</td><td>${money(r.interest, cur)}</td><td>${money(r.principal, cur)}</td><td>${money(r.payment, cur)}</td><td>${money(r.balanceAfter, cur)}</td></tr>`).join('');
  $('#loan-cost').innerHTML = [
    card('totalInterest', money(s.totalInterest, cur)),
    card('totalPayback', money(s.totalPayback, cur)),
    card('interestShare', pct(s.interestShareOfPayback)),
    card('totalCost', money(s.totalCost, cur)),
    card('effectiveApr', pct(s.effectiveApr, 2)),
    card('earlyRepaymentCost', money(earlyRepaymentCost(tm, half), cur), `<p class="sub">${esc(t('ui.month'))} ${half}</p>`),
  ].join('') + `<details class="schedule wide"><summary>${esc(t('ui.tableShowSchedule'))}</summary><div class="table-wrap"><table>
    <thead><tr><th>${esc(t('ui.scheduleMonth'))}</th><th>${esc(t('ui.scheduleDate'))}</th><th>${esc(t('ui.scheduleInterest'))}</th><th>${esc(t('ui.schedulePrincipal'))}</th><th>${esc(t('ui.schedulePayment'))}</th><th>${esc(t('ui.scheduleBalance'))}</th></tr></thead>
    <tbody>${rows}</tbody></table></div></details>`;

  $('#loan-events').innerHTML = [
    card('topUpToCure', top ? `+${btc(top.btc)} <span class="sub">= ${money(top.value, cur)}</span><br><span class="sub">${esc(t('ui.orRepay', { amount: money(top.repayInstead, cur) }))}</span>` : esc(t('ui.none'))),
    card('costIfLiquidated', `−${btc(liq.btcSold)} <span class="sub">(${money(liq.btcSold * lp.atStart, cur)})</span><br><span class="sub">+${btc(liq.btcReturned)} = ${money(liq.valueReturned, cur)}</span>`),
    card('breakevenReturn', pct(breakevenReturn(tm, { taxRateNow: tm.taxRateNow, taxRateAtMaturity: tm.taxRateAtMaturity }))),
    card('taxNote', `${btc(liq.btcSold)} × ${money(lp.atStart, cur)} = ${money(liq.btcSold * lp.atStart, cur)}`),
  ].join('');
  renderSummaryBar();
  if (lastRisk) $('#risk').classList.add('outdated');
}

function rangeText(a, b) {
  const lo = Math.min(a, b); const hi = Math.max(a, b);
  return `${pct(lo)} – ${pct(hi)}`;
}

function renderRisk() {
  const r = lastRisk; const tm = lastTerms; const cur = tm.currency;
  if (!r || r.currency !== cur) return;
  $('#risk').classList.remove('outdated');
  const o = texts().outputs;
  const reserveOn = !!r.bootstrapReserve;
  const resLabel = esc(t('ui.withReserve', { amount: money0(tm.reserveAmount, cur) }));
  const nc = `<div class="warning"><h5>${esc(o.probLiquidation.warningTitle)}</h5><ul>${o.probLiquidation.notCaptured.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  const headline = `<span class="big">${pct(r.bootstrap.pLiquidation)}</span><span class="sub">${esc(t('ui.rangeBetweenModels', { range: rangeText(r.bootstrap.pLiquidation, r.garchMc.pLiquidation) }))}</span>${reserveOn ? `<p class="sub">${resLabel}: <b>${pct(r.bootstrapReserve.pLiquidation)}</b> (${esc(t('ui.rangeBetweenModels', { range: rangeText(r.bootstrapReserve.pLiquidation, r.garchMcReserve.pLiquidation) }))})</p>` : ''}`;
  const fmtMonth = (m) => `${t('ui.month')} ${m}`;
  const rp = r.replay;
  const worst = rp.worst;
  const reserve = rp.reserveBtcNeeded;
  const c = collateralBtc(tm);
  const resRow = (q) => `${btc(reserve[q] * c)} <span class="sub">(${money0(reserve[q] * c * tm.btcPrice, cur)})</span>`;

  $('#risk-head').innerHTML = [
    card('probLiquidation', headline, nc, 'wide headline'),
    card('replayShare', `<span class="big">${pct(rp.liquidatedShare)}</span><span class="sub">${esc(t('ui.replayStarts', { n: num(rp.starts, 0), from: date(rp.perStart.time[0]), to: date(rp.perStart.time[rp.starts - 1]) }))}</span>${reserveOn ? `<p class="sub">${resLabel}: <b>${pct(r.replayReserve.liquidatedShare)}</b></p>` : ''}`, '', 'headline'),
    card('probMarginCall', r.bootstrap.pMarginCall === null ? esc(t('ui.none')) : pct(r.bootstrap.pMarginCall)),
  ].join('');

  const fanTable = `<details class="schedule"><summary>${esc(t('ui.showTable'))}</summary><div class="table-wrap"><table>
    <thead><tr><th>${esc(t('ui.scheduleMonth'))}</th><th>5%</th><th>25%</th><th>50%</th><th>75%</th><th>95%</th><th>${esc(t('ui.legendLiquidationPrice'))}</th></tr></thead><tbody>
    ${r.bootstrap.fanByMonth.map((f, i) => `<tr><td>${f.month}</td><td>${money0(f.q05, cur)}</td><td>${money0(f.q25, cur)}</td><td>${money0(f.q50, cur)}</td><td>${money0(f.q75, cur)}</td><td>${money0(f.q95, cur)}</td><td>${money0(liquidationPrices(tm).byDay[f.day], cur)}</td></tr>`).join('')}
    </tbody></table></div></details>`;
  const monthsTable = `<details class="schedule"><summary>${esc(t('ui.showTable'))}</summary><div class="table-wrap"><table>
    <thead><tr><th>${esc(t('ui.scheduleMonth'))}</th><th>${esc(texts().outputs.probLiquidation.label)}</th></tr></thead><tbody>
    ${r.bootstrap.cumulativeByMonth.map((p, i) => `<tr><td>${i + 1}</td><td>${pct(p)}</td></tr>`).join('')}
    </tbody></table></div></details>`;
  $('#risk-charts').innerHTML = `${card('fanChart', '<div id="chart-fan"></div>', `<p class="sub">${esc(t('ui.chartFanNote'))}</p>${fanTable}`, 'wide')}
    ${card('probByMonth', '<div id="chart-months"></div>', monthsTable, 'wide')}
    ${card('replayWorst', '<div id="chart-replay"></div>', `<p class="legend"><span class="chip chip-critical"></span>${esc(t('ui.legendLiquidated'))} <span class="chip chip-neutral"></span>${esc(t('ui.legendSurvived'))}</p><p class="sub">${esc(t('ui.chartReplayNote'))}</p>
      <p>${esc(t('ui.worstStart', { start: date(worst.startTime), drop: pct(worst.maxDrawdown) }))} ${worst.liquidationTime ? esc(t('ui.liquidatedOn', { date: date(worst.liquidationTime) })) : esc(t('ui.notLiquidated'))}</p>
      ${rp.fastest ? `<p>${esc(t('ui.fastestLiquidation', { start: date(rp.fastest.startTime), days: num(rp.fastest.hours / 24, 1) }))}</p>` : ''}`, 'wide')}`;

  const liqByMonth = [0, ...Array.from({ length: tm.durationMonths }, (_, m) => daysBetween(tm.startDate, addMonths(tm.startDate, m + 1)))].map((d) => liquidationPrices(tm).byDay[d]);
  fanChart($('#chart-fan'), {
    s0: tm.btcPrice, fan: r.bootstrap.fanByMonth, liq: liqByMonth, fmt: (v) => money0(v, cur), monthLabel: (m) => (m === 0 ? t('ui.atStart') : fmtMonth(m)),
    labels: { title: t('ui.chartFanTitle'), median: '50%', liq: t('ui.legendLiquidationPrice') },
  });
  barChart($('#chart-months'), { values: r.bootstrap.cumulativeByMonth, fmtPct: (v) => pct(v), monthLabel: fmtMonth, title: t('ui.chartByMonthTitle') });
  replayStrip($('#chart-replay'), {
    time: rp.perStart.time, liquidated: rp.perStart.liquidated, liquidationTime: rp.perStart.liquidationTime, fmtDate: date,
    labels: { title: t('ui.chartReplayTitle'), liquidated: t('ui.legendLiquidated'), survived: t('ui.legendSurvived') },
  });

  const row = (label, a, b) => `<tr><th scope="row">${esc(label)}</th><td>${a}</td>${reserveOn ? `<td>${b}</td>` : ''}</tr>`;
  $('#risk-detail').innerHTML = [
    card('modelComparison', `<div class="table-wrap"><table><thead><tr><th></th><th>${esc(t('ui.withoutReserve'))}</th>${reserveOn ? `<th>${resLabel}</th>` : ''}</tr></thead><tbody>
      ${row(t('ui.modelBootstrap'), pct(r.bootstrap.pLiquidation), reserveOn && pct(r.bootstrapReserve.pLiquidation))}
      ${row(t('ui.modelGarch'), pct(r.garchMc.pLiquidation), reserveOn && pct(r.garchMcReserve.pLiquidation))}
      ${row(t('ui.modelReplay'), pct(rp.liquidatedShare), reserveOn && pct(r.replayReserve.liquidatedShare))}
      ${row(t('ui.modelBarrier'), pct(r.barrier.p), '–')}
      </tbody></table></div>`, '', 'wide'),
    card('barrierCheck', pct(r.barrier.p), `<p class="sub">σ = ${pct(r.barrier.sigma, 0)}</p>`),
    card('reserveNeeded', `${esc(t('ui.inShareOfStarts', { share: '90%' }))}: ${resRow('q90')}<br>${esc(t('ui.inShareOfStarts', { share: '95%' }))}: ${resRow('q95')}<br>${esc(t('ui.inWorstStart'))}: ${resRow('max')}`),
    card('whatIfTable', r.whatIf ? whatIfHtml(r.whatIf) : `<p class="progress">${esc(t('ui.computing', { done: '…', total: '…' }))}</p>`, '', 'wide'),
  ].join('');
  $('#data-range').textContent = `${t('ui.dataUntil', { from: date(META.prices[cur].from), to: date(META.prices[cur].to) })}${appended[cur] && appended[cur].length ? ` ${t('ui.dataAppended', { source: 'Bitstamp', to: dateTime(appended[cur][appended[cur].length - 1].time) })}` : ''}`;
  renderSummaryBar();
}

function whatIfHtml(w) {
  const head = w.durations.map((m) => `<th>${m} ${esc(t('ui.months'))}</th>`).join('');
  const body = w.ltvs.map((ltv) => `<tr><th scope="row">${pct(ltv, 0)}</th>${w.durations.map((m) => {
    const cell = w.cells.find((c) => c.ltv === ltv && c.months === m);
    const current = Math.abs(ltv - lastTerms.initialLtv) < 1e-9 && m === lastTerms.durationMonths;
    return `<td${current ? ' class="current"' : ''}>${pct(cell.p)}<br><span class="sub">${esc(t('ui.modelReplay'))}: ${cell.replay === null ? '–' : pct(cell.replay)}</span></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>${esc(t('ui.ltvCol'))} \\ ${esc(t('ui.durationCol'))}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderSummaryBar() {
  const tm = lastTerms;
  if (!tm) return;
  const lp = liquidationPrices(tm);
  const r = lastRisk && lastRisk.currency === tm.currency ? lastRisk : null;
  $('#summary-bar').innerHTML = `<span>${esc(t('ui.summaryLiq'))}: <b>${money0(lp.atStart, tm.currency)}</b></span>
    <span>${esc(t('ui.summaryProb'))}: <b>${r ? pct(r.bootstrap.pLiquidation) : '…'}</b></span>`;
}

// ---------------------------------------------------------------- static sections
function renderStatic() {
  const tx = texts();
  document.title = tx.meta.title;
  $('meta[name="description"]').setAttribute('content', tx.meta.description);
  for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = rich(t(el.dataset.t));
  $('#glossary-list').innerHTML = Object.entries(tx.glossary).map(([id, g]) => `<dt id="g-${id}">${esc(g.term)}</dt><dd>${rich(g.text)}</dd>`).join('');
  $('#impressum-body').innerHTML = tx.legal.impressum.map((x) => `<p>${esc(x)}</p>`).join('');
  $('#privacy-body').innerHTML = tx.legal.privacy.map((sec) => `<h3>${esc(sec.h)}</h3>${sec.p.map((x) => `<p>${esc(x)}</p>`).join('')}`).join('');
  const unfilled = JSON.stringify(tx.legal).includes('«');
  for (const n of document.querySelectorAll('.template-note')) n.hidden = !unfilled;
  $('#lang-btn').textContent = tx.ui.language;
  $('#lang-btn').setAttribute('lang', getLang() === 'de' ? 'en' : 'de');
  $('#lang-btn').setAttribute('aria-label', `${tx.ui.languageSwitch}: ${tx.ui.language}`);
}

function renderAll() {
  renderStatic();
  renderForm();
  update();
  if (lastRisk) renderRisk();
}

function onCurrencyChange() {
  lastRisk = null;
  priceInfo = null;
  renderForm();
  loadPrice(true);
  ensureRecent(state.currency);
}

async function ensureRecent(cur) {
  if (appended[cur]) return;
  appended[cur] = [];
  const candles = await fetchRecentCandles(cur);
  appended[cur] = candles;
  if (candles.length) {
    sentData.delete(cur); // the next run sends the history again, now with the recent hours
    if (started && cur === state.currency) update();
  }
}

function copySummary() {
  const out = [...document.querySelectorAll('#results .card')].map((c) => `${$('h4', c).textContent}: ${$('.value', c).innerText.replace(/\s+/g, ' ').trim()}`);
  const text = [texts().meta.title, ...out, '', texts().sections.notAdvice].join('\n');
  navigator.clipboard?.writeText(text).then(() => { $('#copy-btn').textContent = t('ui.copied'); setTimeout(() => { $('#copy-btn').textContent = t('ui.copyResults'); }, 1500); });
}

// ---------------------------------------------------------------- start
initLang();
document.addEventListener('input', onInput);
document.addEventListener('click', onClick);
$('#lang-btn').addEventListener('click', () => { setLang(getLang() === 'de' ? 'en' : 'de'); renderAll(); });
$('#reset-btn').addEventListener('click', () => { state = { ...EXAMPLE, currency: state.currency, btcPrice: state.btcPrice, priceManual: state.priceManual }; saveState(); renderAll(); });
$('#copy-btn').addEventListener('click', copySummary);
$('#forget-btn').addEventListener('click', () => {
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem('btc-loan-risk:lang'); } catch { /* ignore */ }
  state = { ...EXAMPLE, currency: state.currency, btcPrice: state.btcPrice, priceManual: false };
  renderAll();
  $('#forgotten').hidden = false;
});
if (state.priceManual && state.btcPrice !== '' && state.btcPrice !== null) priceInfo = { source: 'manual' };
if (!state.startDate) state.startDate = today();
renderAll();
makeWorker();
// Start the risk simulation once, after the live price and the recent hours have
// arrived (or after 5 seconds at most), instead of restarting it several times.
const waitMax = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
Promise.all([waitMax(loadPrice(false), 5000), waitMax(ensureRecent(state.currency), 5000)]).then(() => { started = true; update(); });
