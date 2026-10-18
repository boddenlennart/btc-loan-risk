// The page: builds the form, reads it into loan terms, shows the answer first and
// asks the worker for the risk results. No wording lives here: every visible word
// comes from src/content/text.*.js via t().
import { initLang, setLang, getLang, t, texts, rich, esc } from './i18n.js';
import { money, money0, pct, num, btc, date, dateTime, isoDate } from './format.js';
import { fanChart, barChart, futuresChart, storiesChart } from './charts.js';
import { EXAMPLE_FORM } from '../content/examples.js';
import { SITE } from '../content/site.js';
import { validateTerms } from '../engine/validate.js';
import {
  loanSummary, collateralBtc, liquidationPrices, marginCallPrices, dropToLiquidation, topUpToCure,
  costIfLiquidated, breakevenReturn, addMonths, daysBetween,
} from '../engine/loan.js';
import { lenderRules, partialSaleBtc } from '../engine/lender.js';
import { getSpotPrice } from '../live/price.js';
import { setData as jobSetData, run as jobRun } from './riskjob.js';
import { encodeState, decodeLink } from './share.js';
import { toTerms, numOr, today, exampleKey, switchCosts } from './terms.js';
import { feedbackText, mailtoLink } from './feedback.js';
import { dataAge } from '../data/candles.js';
import { gunzipSync, strFromU8 } from 'fflate';

const META = JSON.parse(document.getElementById('meta').textContent);
const STORE_KEY = 'btc-loan-risk:form';
const $ = (sel, root = document) => root.querySelector(sel);
const STORY_COLORS = ['var(--story-1)', 'var(--story-2)', 'var(--story-3)', 'var(--story-4)'];
const SOURCE_NAMES = { coinbase: 'Coinbase', kraken: 'Kraken', binance: 'Binance', coingecko: 'CoinGecko', embedded: '' };

// ------------------------------------------------------------------ state
const linkData = decodeLink(location.hash);
const openedFromLink = !!linkData; let scrolledToAnswer = false;
// A comparison: { kind: 'offers' | 'refi', active, offers: [forms], names: [] }. `state` is always
// the selected offer's form; the others wait in compare.offers. null when nothing is compared.
let compare = null;
let state = loadState();
let priceInfo = null; // { source, time, stale } | { source: 'manual' }
const feedback = { use: '', meaning: '', useful: 0, easy: 0, missing: '', language: '', attach: false };
let lastTerms = null; let lastSettings = null; let lastRisk = null; let timer = null; let started = false;
// the terms and settings the current risk results were calculated for (charts must use these, not newer inputs)
let riskTerms = null; let riskSettings = null; const pending = {};
let showOtherPaths = false;
// the example answer computed by the build (META.example), shown at once while the page recomputes it
let embeddedKey = null;
let undoState = null; let sliderChanging = false;
function undoSlider() {
  if (!undoState) return;
  state = undoState; undoState = null; $('#slider-undo').hidden = true;
  saveState(); renderForm(); update();
}
let termsOpen = false;
function setTermsOpen(open, { focus = false } = {}) {
  termsOpen = open;
  $('#terms').classList.toggle('closed', !open);
  const tg = $('#terms-toggle'); tg.setAttribute('aria-expanded', String(open)); tg.textContent = t(open ? 'form.closeTerms' : 'form.editTerms');
  if (focus) { $('#terms').scrollIntoView({ block: 'start' }); const f = $('#form input'); if (f) f.focus({ preventScroll: true }); }
  updateAnswerBar();
}

// Phones: while the terms are open and the answer is out of sight, a bar at the bottom shows the
// number (and the one before the last change), so every change can be seen while typing.
let answerInView = true; let barNow = null; let barWas = null;
const isPhone = () => matchMedia('(max-width: 1023px)').matches;
function updateAnswerBar() {
  const bar = $('#answer-bar'); if (!bar) return;
  const show = termsOpen && !answerInView && isPhone();
  bar.hidden = !show; document.body.classList.toggle('bar-on', show);
  if (!show) return;
  const busy = !lastRisk || document.body.classList.contains('outdated') || document.body.classList.contains('invalid');
  const R = texts().results;
  $('#answer-bar-text').innerHTML = busy || barNow === null ? esc(texts().ui.computingShort)
    : esc(t('results.barLine', { n: '§' })).replace('§', `<b>${barNow}</b>`) + (barWas !== null && barWas !== barNow ? ` ${esc(t('results.barWas', { m: barWas }))}` : '');
  $('#answer-bar-btn').textContent = R.barGo;
}
function toAnswer() { $('#answer').scrollIntoView({ block: 'start', behavior: 'smooth' }); }

function loadState() {
  const fromLink = linkData && linkData.form;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { /* storage blocked */ }
  // saved inputs are checked like a shared link: anything broken is ignored, never fatal
  if (!saved || typeof saved !== 'object' || (saved.state && typeof saved.state !== 'object')) saved = null;
  const c = linkData ? linkData.compare : saved && saved.compare;
  const okCompare = c && typeof c === 'object' && ['offers', 'refi'].includes(c.kind) && Array.isArray(c.offers) && c.offers.length >= 2 && c.offers.length <= 3
    && c.offers.every((o) => o && typeof o === 'object') && Number.isInteger(c.active) && c.active >= 0 && c.active < c.offers.length;
  if (okCompare) compare = { kind: c.kind, active: c.active, names: Array.isArray(c.names) ? c.names.map((n) => String(n ?? '').slice(0, 40)) : [], offers: c.offers.map((o) => ({ ...EXAMPLE_FORM, ...o })) };
  const s = { ...EXAMPLE_FORM, ...(saved && saved.state), ...(fromLink || {}), ...(compare ? compare.offers[compare.active] : {}) };
  if (fromLink) s.priceManual = false;
  if (!META.prices[s.currency]) s.currency = Object.keys(META.prices)[0];
  // until the live price arrives, start from the last stored price, so the answer can show at once
  if (numOr(s.btcPrice, null) === null) { s.btcPrice = META.prices[s.currency].lastClose; s.priceManual = false; }
  return s;
}
function saveState() {
  if (compare) compare.offers[compare.active] = state;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ state, compare })); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ small HTML helpers
const F = () => texts().form.fields;
const helpBtn = (id, label) => `<button type="button" class="q" aria-expanded="false" aria-controls="help-${id}" aria-label="${esc(t('ui.more'))}: ${esc(label)}">?</button>`;
const helpBox = (id, text) => `<div class="help" id="help-${id}" hidden>${rich(text)}</div>`;
function numField(key, label, unit, { help, hint, step = 'any', id = key } = {}) {
  return `<div class="field" data-field="${id}">
    <div class="label-row"><label for="f-${id}">${esc(label)}</label>${help ? helpBtn(id, label) : ''}</div>
    ${help ? helpBox(id, help) : ''}
    <div class="with-unit"><input id="f-${id}" data-k="${key}" type="number" inputmode="decimal" step="${step}" value="${esc(getPath(state, key) ?? '')}">${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    <p class="err" role="alert" hidden></p></div>`;
}
function seg(key, options, label, { help, id = key } = {}) {
  const btns = options.map(([v, l]) => `<button type="button" data-set="${key}" data-val="${esc(v)}" aria-pressed="${String(getPath(state, key)) === String(v)}">${esc(l)}</button>`).join('');
  return `<div class="field" data-field="${id}">${label ? `<div class="label-row"><span class="label" id="l-${id}">${esc(label)}</span>${help ? helpBtn(id, label) : ''}</div>` : ''}
    ${help ? helpBox(id, help) : ''}<div class="seg" role="group"${label ? ` aria-labelledby="l-${id}"` : ''}>${btns}</div><p class="err" role="alert" hidden></p></div>`;
}
function select(key, options, label, { id = key } = {}) {
  const opts = options.map(([v, l]) => `<option value="${esc(v)}"${String(state[key]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return `<div class="field" data-field="${id}"><label for="f-${id}">${esc(label)}</label><select id="f-${id}" data-k="${key}">${opts}</select><p class="err" role="alert" hidden></p></div>`;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// ------------------------------------------------------------------ form
function isExample() {
  return !compare && state.mode === 'new' && exampleKey(state) === exampleKey({ ...EXAMPLE_FORM, btcPrice: state.btcPrice });
}

const openDetails = new Set();

function renderForm() {
  const f = F(); const fm = texts().form; const existing = state.mode === 'existing';
  const cur = state.currency;
  const currencySel = `<select class="cur" data-k="currency" aria-label="${esc(f.currency.label)}">${Object.keys(META.prices).map((c) => `<option${c === cur ? ' selected' : ''}>${c}</option>`).join('')}</select>`;
  const durations = [6, 12, 24, 36];
  const durChips = durations.map((m) => `<button type="button" data-set="durationMonths" data-val="${m}" aria-pressed="${Number(state.durationMonths) === m}">${m} ${esc(t('ui.months'))}</button>`).join('');
  const other = !durations.includes(Number(state.durationMonths));
  let ltvBlock;
  if (existing) {
    ltvBlock = numField('collateralBtc', f.collateralBtc.labelExisting, 'BTC', { id: 'collateralBtc' }) + '<p class="hint" id="ltv-today"></p>';
  } else if (state.ltvInput === 'btc') {
    ltvBlock = numField('collateralBtc', f.collateralBtc.label, 'BTC', { id: 'collateralBtc' }) + `<p class="hint"><span id="ltv-today"></span> · <button type="button" class="link" data-set="ltvInput" data-val="ltv">${esc(fm.orEnterLtv)}</button></p>`;
  } else {
    ltvBlock = numField('initialLtv', f.initialLtv.label, '%', { help: fm.help.initialLtv }) + `<p class="hint"><button type="button" class="link" data-set="ltvInput" data-val="btc">${esc(fm.orEnterBtc)}</button></p>`;
  }
  const rate = state.rateType === 'variable'
    ? `<div class="field" data-field="ratePath"><span class="label">${esc(f.rateAnnual.label)}</span>${state.ratePath.map((r, i) => `<div class="pair rate-row">
        <label>${esc(fm.fromMonth)}<input type="number" step="1" min="0" inputmode="numeric" data-k="ratePath.${i}.fromMonth" value="${esc(r.fromMonth)}"></label>
        <label>${esc(fm.ratePercent)}<input type="number" step="any" min="0" inputmode="decimal" data-k="ratePath.${i}.rate" value="${esc(r.rate)}"></label>
        ${i > 0 ? `<button type="button" class="link" data-remove-rate="${i}">${esc(fm.removeRateStep)}</button>` : ''}</div>`).join('')}
        <p class="hint"><button type="button" class="link" data-add-rate>${esc(fm.addRateStep)}</button> · <button type="button" class="link" data-set="rateType" data-val="fixed">${esc(fm.rateFixed)}</button></p><p class="err" role="alert" hidden></p></div>`
    : numField('rateAnnual', f.rateAnnual.label, f.rateAnnual.unit) + `<p class="hint"><button type="button" class="link" data-set="rateType" data-val="variable">${esc(fm.rateChanges)}</button></p>`;

  const mc = state.marginCallLtv !== '' && state.marginCallLtv !== null;
  const afterCure = ['liquidateAfterCure', 'partialAfterCure'].includes(state.marginCallConsequence);
  const anyPartial = state.marginCallConsequence === 'partialAfterCure' || state.marginCallConsequence === 'autoPartial' || state.liquidationSale === 'partial';
  const feeSel = (key, opts) => `<select data-k="${key}" aria-label="${esc(f[key === 'liquidationFeeBasis' ? 'liquidationFee' : 'originationFee'].label)}">${opts.map(([v, l]) => `<option value="${v}"${(key === 'originationFee.type' ? state.originationFee.type : state[key]) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const more = `
    ${seg('repayment', ['interestOnly', 'bullet', 'amortizing'].map((v) => [v, f.repayment[v]]), f.repayment.label, { help: fm.help.repayment })}
    ${state.repayment === 'bullet' ? seg('compounding', ['none', 'monthly'].map((v) => [v, f.compounding[v]]), f.compounding.label) : ''}
    ${existing ? '' : `<div class="field" data-field="originationFee"><label for="f-originationFee">${esc(f.originationFee.label)}</label><div class="pair"><input id="f-originationFee" data-k="originationFee.value" type="number" step="any" min="0" inputmode="decimal" value="${esc(state.originationFee.value)}">${feeSel('originationFee.type', [['percent', f.originationFee.percent], ['fixed', f.originationFee.fixed]])}</div><p class="err" role="alert" hidden></p></div>`}
    <fieldset class="sub-group" data-field="marginCall"><legend><span class="label">${esc(f.marginCall.label)}</span>${helpBtn('marginCall', f.marginCall.label)}</legend>${helpBox('marginCall', fm.help.marginCall)}
      ${numField('marginCallLtv', f.marginCallLtv.label, '%', { hint: f.marginCallLtv.hint })}
      ${mc ? select('marginCallConsequence', ['warningOnly', 'liquidateAfterCure', 'partialAfterCure', 'autoPartial'].map((v) => [v, f.marginCallConsequence[v]]), f.marginCallConsequence.label) : ''}
      ${mc && afterCure ? numField('curePeriodHours', f.curePeriodHours.label, fm.hours) : ''}
      ${seg('liquidationSale', ['all', 'partial'].map((v) => [v, f.liquidationSale[v]]), f.liquidationSale.label)}
      ${(mc || anyPartial) ? numField('cureTargetLtv', f.cureTargetLtv.label, '%', { hint: existing ? '' : f.cureTargetLtv.hint }) : ''}
    </fieldset>
    <div class="field" data-field="liquidationFee"><label for="f-liquidationFee">${esc(f.liquidationFee.label)}</label><div class="pair"><input id="f-liquidationFee" data-k="liquidationFee" type="number" step="any" min="0" inputmode="decimal" value="${esc(state.liquidationFee)}">${feeSel('liquidationFeeBasis', [['debt', f.liquidationFee.debt], ['collateralSold', f.liquidationFee.collateralSold]])}</div><p class="err" role="alert" hidden></p></div>
    ${state.purpose === 'buy' ? seg('repayWith', ['sell', 'cash'].map((v) => [v, f.repayWith[v]]), f.repayWith.label) : ''}`;
  const expert = `
    ${existing ? '' : `<div class="field" data-field="startDate"><label for="f-startDate">${esc(f.startDate.label)}</label><input id="f-startDate" type="date" data-k="startDate" value="${esc(state.startDate || today())}"><p class="hint">${esc(f.startDate.hint)}</p></div>`}
    ${select('dayCount', ['30/360', 'act/365', 'act/360'].map((v) => [v, f.dayCount[v]]), f.dayCount.label)}
    ${select('simPaths', ['2000', '10000', '20000'].map((v) => [v, f.simPaths[v]]), f.simPaths.label)}
    ${numField('bootstrapBlockDays', f.bootstrapBlockDays.label, '', { step: '1' })}`;

  const Cm = texts().compare; const refi = !!state.refi;
  const nameField = compare ? `<div class="field"><label for="f-offerName">${esc(Cm.nameLabel)}</label><input id="f-offerName" type="text" maxlength="40" data-offer-name value="${esc(compare.names[compare.active] || '')}" placeholder="${esc(offerName(compare.active))}"></div>` : '';
  let top;
  if (refi) {
    const base = compare.offers[0];
    const ch = state.refi.change;
    top = `<p class="hint">${esc(t('compare.startsFrom', { owed: money0(numOr(base.loanAmount), cur), btc: num(numOr(base.collateralBtc), 4), months: base.durationMonths }))}</p>
      ${seg('refi.change', [['same', Cm.same], ['more', Cm.more], ['back', Cm.back]], Cm.whatChanges, { id: 'refiChange' })}
      ${ch === 'more' ? numField('refi.extra', Cm.extra, cur, { id: 'refiExtra' }) : ''}
      ${ch === 'back' ? numField('refi.back', Cm.backBtc, 'BTC', { id: 'refiBack' }) : ''}
      <p class="hint" id="ltv-today"></p>`;
  } else {
    top = `${compare ? '' : seg('mode', [['new', fm.modeNew], ['existing', fm.modeExisting]], '', { id: 'mode' })}
    <p class="hint"><button type="button" class="link" aria-expanded="false" aria-controls="where">${esc(t('ui.whereLink'))}</button></p>
    <div id="where" class="where" hidden>${whereHtml()}</div>
    <div class="amount-row">${numField('loanAmount', existing ? f.loanAmount.labelExisting : f.loanAmount.label, '', { hint: existing ? f.loanAmount.hintExisting : '' })}${currencySel}</div>
    ${ltvBlock}`;
  }
  const switching = refi ? `<details class="more" data-remember="switch"><summary>${esc(Cm.switching)} <span class="sum">· ${esc(t('compare.switchingSum', { sum: money0(switchCosts(state), cur) }))}</span></summary>
      ${numField('refi.exitFee', Cm.exitFee, cur, { id: 'refiExitFee' })}${numField('refi.transferFee', Cm.transferFee, cur, { id: 'refiTransfer' })}</details>` : '';
  $('#form').innerHTML = `
    ${nameField}
    ${top}
    ${numField('liquidationLtv', f.liquidationLtv.label, '%', { help: fm.help.liquidationLtv })}
    <div class="field" data-field="durationMonths"><span class="label" id="l-dur">${esc(existing ? f.durationMonths.labelExisting : f.durationMonths.label)}</span>
      <div class="chips" role="group" aria-labelledby="l-dur">${durChips}<span class="with-unit other"><input type="number" step="1" min="1" inputmode="numeric" data-k="durationMonths" aria-label="${esc(fm.otherDuration)}" placeholder="${esc(fm.otherDuration)}" value="${other ? esc(state.durationMonths) : ''}"><span class="unit">${esc(t('ui.months'))}</span></span></div>${existing ? '' : `<p class="hint">${esc(f.durationMonths.hint)}</p>`}<p class="err" role="alert" hidden></p></div>
    ${rate}
    ${refi ? '' : seg('purpose', [['spend', f.purpose.spend], ['buy', f.purpose.buy]], f.purpose.label) + `<p class="hint purpose-hint">${esc(f.purpose.hint)}</p>`}
    <p class="price-line" id="price-line" aria-live="polite"></p>
    <div class="field" data-field="btcPrice" id="price-edit" hidden><span class="with-unit"><input type="number" step="any" inputmode="decimal" data-k="btcPrice" aria-label="BTC ${esc(cur)}" value="${esc(state.btcPrice ?? '')}"><span class="unit">${esc(cur)}</span></span><p class="err" role="alert" hidden></p></div>
    <details class="more" data-remember="more"><summary>${esc(refi ? Cm.moreTerms : existing ? fm.moreTermsExisting : fm.moreTerms)} <span class="sum" id="more-sum"></span></summary>${more}</details>
    ${switching}
    <details class="more" data-remember="expert"><summary>${esc(fm.expert)}</summary>${expert}</details>`;
  for (const d of document.querySelectorAll('#form details[data-remember]')) if (openDetails.has(d.dataset.remember)) d.open = true;
  renderPriceLine();
}

function whereHtml() {
  const w = texts().where;
  return `<p><b>${esc(w.title)}</b></p><p class="sample">${esc(w.sample)}</p><p>${esc(w.intro)}</p>
    <ol>${w.items.map((i) => `<li><b>${esc(i.field)}</b>: ${esc(i.words)}</li>`).join('')}</ol><p class="hint">${esc(w.others)}</p>`;
}

function moreSummary(terms) {
  const f = F();
  const parts = [f.repayment[terms.repayment]];
  if (terms.marginCallLtv) parts.push(`${f.marginCallLtv.label} ${pct(terms.marginCallLtv, 0)}`);
  parts.push(`${f.liquidationFee.label} ${pct(terms.liquidationFee.value, 1)}`);
  const el = $('#more-sum'); if (el) el.textContent = `· ${parts.join(' · ')}`;
}

function renderPriceLine() {
  const el = $('#price-line'); if (!el) return;
  const fm = texts().form; const cur = state.currency;
  const p = numOr(state.btcPrice, null);
  let line;
  if (!priceInfo || p === null) line = esc(fm.priceLoading);
  else if (priceInfo.source === 'manual') line = esc(t('form.priceManual', { price: money0(p, cur) }));
  else if (priceInfo.stale) line = esc(t('form.priceStale', { price: money0(p, cur), time: dateTime(priceInfo.time) }));
  else line = esc(t('form.priceLine', { price: money0(p, cur), source: SOURCE_NAMES[priceInfo.source] ?? priceInfo.source, time: dateTime(priceInfo.time) }));
  el.innerHTML = `${line} · <button type="button" class="link" data-edit-price>${esc(fm.priceChange)}</button> · <button type="button" class="link" data-reload-price>${esc(fm.priceReload)}</button>`;
  el.classList.toggle('stale', !!(priceInfo && priceInfo.stale));
  $('#stale-banner').hidden = !(priceInfo && priceInfo.stale);
}

// ------------------------------------------------------------------ events
function setPath(obj, path, value) {
  const keys = path.split('.'); let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}
function change(mutate, { rerenderForm = false } = {}) {
  state = structuredClone(state); mutate(state); saveState();
  if (!sliderChanging) { $('#slider-undo').hidden = true; undoState = null; }
  $('#shared-note').hidden = true; // the inputs are now the visitor's own
  if (rerenderForm) renderForm();
  update();
}

function onInput(e) {
  const k = e.target.dataset.k;
  if (!k) {
    if (e.target.dataset.fb) feedback[e.target.dataset.fb] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.matches('[data-offer-name]') && compare) { compare.names[compare.active] = e.target.value.slice(0, 40); saveState(); renderCompare(); renderAnswerTop(lastTerms); }
    return;
  }
  const v = e.target.value;
  if (k === 'currency') { lastRisk = null; if (compare) for (const o of compare.offers) o.currency = v; change((s) => { s.currency = v; }, { rerenderForm: true }); loadPrice(true); ensureRecent(v); return; }
  if (k === 'btcPrice') { priceInfo = { source: 'manual' }; change((s) => { s.btcPrice = v; s.priceManual = true; }); renderPriceLine(); return; }
  if (k === 'marginCallLtv') { const wasEmpty = state.marginCallLtv === '' || state.marginCallLtv === null; change((s) => { s.marginCallLtv = v; }, { rerenderForm: wasEmpty !== (v === '') }); return; }
  if (k === 'marginCallConsequence') { change((s) => { s.marginCallConsequence = v; }, { rerenderForm: true }); return; }
  change((s) => setPath(s, k, v));
}

function onClick(e) {
  if (e.target.closest('#terms-toggle')) { const closing = termsOpen; setTermsOpen(!termsOpen); if (closing && isPhone()) toAnswer(); return; }
  if (e.target.closest('[data-to-answer]')) { toAnswer(); return; }
  if (e.target.closest('[data-slider-undo]')) { undoSlider(); return; }
  const ctl = e.target.closest('button[aria-controls]');
  if (ctl) {
    const box = document.getElementById(ctl.getAttribute('aria-controls'));
    const open = ctl.getAttribute('aria-expanded') !== 'true';
    ctl.setAttribute('aria-expanded', String(open)); box.hidden = !open;
    return;
  }
  const set = e.target.closest('[data-set]');
  if (set) {
    const k = set.dataset.set; let v = set.dataset.val;
    if (k === 'durationMonths') v = Number(v);
    change((s) => {
      if ((k === 'ltvInput' && v === 'btc') || (k === 'mode' && v === 'existing')) {
        if (!numOr(s.collateralBtc, 0)) s.collateralBtc = String(+(numOr(s.loanAmount) / ((numOr(s.initialLtv) / 100) * numOr(s.btcPrice))).toFixed(4));
      }
      setPath(s, k, v);
    }, { rerenderForm: true });
    return;
  }
  const tgt = e.target;
  if (tgt.matches('[data-add-rate]')) {
    const last = state.ratePath[state.ratePath.length - 1];
    change((s) => { s.ratePath.push({ fromMonth: Number(last.fromMonth) + 1, rate: last.rate }); }, { rerenderForm: true });
  } else if (tgt.matches('[data-remove-rate]')) {
    change((s) => { s.ratePath.splice(Number(tgt.dataset.removeRate), 1); }, { rerenderForm: true });
  } else if (tgt.matches('[data-edit-price]')) {
    $('#price-edit').hidden = false; $('#price-edit input').focus();
  } else if (tgt.matches('[data-reload-price]')) {
    loadPrice(true);
  } else if (tgt.matches('[data-other-paths]')) {
    showOtherPaths = !showOtherPaths; renderFutures();
  } else if (tgt.closest('[data-open-terms]')) {
    setTermsOpen(true, { focus: true });
  } else if (tgt.closest('[data-share]')) {
    share();
  } else if (tgt.closest('[data-compare-start]')) {
    startCompare();
  } else if (tgt.closest('[data-compare-add]')) {
    addOffer();
  } else if (tgt.closest('[data-compare-remove]')) {
    removeOffer(compare.active);
  } else if (tgt.closest('[data-compare-end]')) {
    endCompare();
  } else if (tgt.closest('[data-offer]')) {
    setActive(Number(tgt.closest('[data-offer]').dataset.offer));
  } else if (tgt.matches('[data-fb-send], [data-fb-copy]')) {
    const body = feedbackText({
      ...feedback, use: feedback.use ? texts().feedback.useOptions[feedback.use] : '', terms: feedback.attach ? { ...lastTerms } : null,
      version: new Date(META.built * 1000).toISOString().slice(0, 10), lang: getLang(), device: matchMedia('(max-width: 600px)').matches ? 'phone' : 'desktop',
    });
    if (tgt.matches('[data-fb-send]')) location.href = mailtoLink(SITE.feedbackEmail, texts().feedback.subject, body);
    else navigator.clipboard?.writeText(body).then(() => { $('#fb-copied').hidden = false; });
  } else if (tgt.matches('[data-copy-address]')) {
    navigator.clipboard?.writeText(SITE.donationAddress).then(() => { tgt.textContent = t('donate.copied'); });
  } else if (tgt.closest('a.gloss')) {
    $('#glossary').open = true;
  } else if (tgt.closest('a[href="#method"]')) {
    $('#method').open = true;
  }
}

function onToggle(e) {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement)) return;
  if (d.dataset.remember) { if (d.open) openDetails.add(d.dataset.remember); else openDetails.delete(d.dataset.remember); }
  if (d.id === 'sec-falls' && d.open) renderFutures();
  if (d.id === 'sec-history' && d.open) renderStories();
  if (d.id === 'method' && d.open) renderExpertCharts();
}

// ------------------------------------------------------------------ live price & recent candles
async function loadPrice(force = false) {
  if (!force && state.priceManual && numOr(state.btcPrice, null) !== null) { priceInfo = { source: 'manual' }; renderPriceLine(); return; }
  priceInfo = null; renderPriceLine();
  const embedded = Object.fromEntries(Object.entries(META.prices).map(([c, m]) => [c, { price: m.lastClose, time: m.to }]));
  const cur = state.currency;
  const r = await getSpotPrice(cur, { embedded });
  if (cur !== state.currency) return;
  priceInfo = r;
  state = { ...state, btcPrice: r.price, priceManual: false };
  saveState();
  const input = $('#price-edit input'); if (input) input.value = r.price;
  renderPriceLine();
  update();
}

const appended = {};
async function fetchRecentCandles(cur) {
  const m = META.prices[cur]; const out = [];
  let start = m.to + 3600; const now = Date.now() / 1000;
  try {
    for (let k = 0; k < 12 && start < now - 7200; k++) {
      const res = await fetch(`https://www.bitstamp.net/api/v2/ohlc/btc${cur.toLowerCase()}/?step=3600&limit=1000&start=${start}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      const rows = ((await res.json()).data || {}).ohlc || [];
      if (!rows.length) break;
      for (const c of rows) {
        const o = { time: +c.timestamp, open: +c.open, high: +c.high, low: +c.low, close: +c.close };
        if (o.time >= start && o.time % 3600 === 0 && o.low > 0 && o.low <= Math.min(o.open, o.close) && o.high >= Math.max(o.open, o.close) && o.time + 3600 <= now) out.push(o);
      }
      start = +rows[rows.length - 1].timestamp + 3600;
    }
  } catch { /* offline: embedded history only */ }
  return out;
}
async function ensureRecent(cur) {
  if (appended[cur]) return;
  appended[cur] = [];
  // currencies computed from the euro history: recent euro hours × the last ECB rate
  const fx = fxFor(cur); const r = fx ? fx.rates[cur].at(-1) : 1;
  const candles = fx ? (await fetchRecentCandles('EUR')).map((c) => ({ time: c.time, open: c.open * r, high: c.high * r, low: c.low * r, close: c.close * r })) : await fetchRecentCandles(cur);
  appended[cur] = candles;
  if (candles.length) sentData.delete(cur); // picked up by the next recalculation
}

// ------------------------------------------------------------------ worker
// '#no-worker' in the address forces the fallback (to test browsers that block workers)
let worker = null; let useInline = location.hash === '#no-worker'; let runId = 0; let busy = false;
const sentData = new Set(); const garchCache = { ...(META.garch || {}) }; // fitted at build time
function makeWorker() {
  sentData.clear();
  if (useInline) return;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([document.getElementById('worker-src').textContent], { type: 'text/javascript' })));
    worker.onmessage = (e) => onWorkerMessage(e.data);
    worker.onerror = () => { useInline = true; worker = null; update(); };
  } catch { useInline = true; worker = null; }
}
// rates for the currencies computed from the euro history (CHF, GBP, CAD, AUD, CZK, PLN)
let fxTable = null;
function fxFor(cur) {
  if (!META.prices[cur].fromEur) return null;
  if (!fxTable) fxTable = JSON.parse(strFromU8(gunzipSync(Uint8Array.from(atob(document.getElementById('data-FX').textContent.trim()), (ch) => ch.charCodeAt(0)))));
  return { days: fxTable.days, rates: { [cur]: fxTable.rates[cur] } };
}
function sendData(cur) {
  if (sentData.has(cur)) return;
  const fx = fxFor(cur);
  const base64 = document.getElementById(`data-${fx ? 'EUR' : cur}`).textContent.trim();
  if (useInline) jobSetData(cur, base64, appended[cur], fx); else worker.postMessage({ type: 'data', currency: cur, base64, appended: appended[cur], fx });
  sentData.add(cur);
}
// runs that only confirm the embedded example answer update quietly, once, at the end
const quietRuns = new Set();
function onWorkerMessage(m) {
  if (m.id !== runId) return;
  if (quietRuns.has(m.id) && m.type !== 'result' && m.type !== 'error') return;
  if (m.type === 'progress') {
    $('#progress').hidden = false; $('#progress').textContent = t('ui.computing', { pct: Math.min(99, Math.round((m.done / m.total) * 100)) });
  } else if (m.type === 'partial' || m.type === 'result') {
    garchCache[m.result.currency] = m.result.garch;
    lastRisk = m.result; [riskTerms, riskSettings] = pending[m.id];
    if (m.type === 'result') { busy = false; $('#progress').hidden = true; document.body.dataset.ready = '1'; }
    renderRisk();
    // a shared link opens on the answer the sender saw, not on the form
    if (openedFromLink && !scrolledToAnswer) { scrolledToAnswer = true; $('#shared-note').hidden = false; renderAnswerTop(riskTerms); $('#answer').scrollIntoView({ block: 'start' }); }
  } else if (m.type === 'error') {
    busy = false; $('#progress').textContent = m.message;
  }
}
function requestRisk(terms, settings) {
  runId++; document.body.dataset.ready = '0';
  if (busy && !useInline) { worker.terminate(); makeWorker(); }
  if (!worker && !useInline) makeWorker();
  sendData(terms.currency);
  busy = true;
  pending[runId] = [terms, settings];
  const garch = garchCache[terms.currency] || null;
  if (useInline) {
    const id = runId;
    jobRun(id, terms, settings, garch, onWorkerMessage).then((result) => onWorkerMessage({ type: 'result', id, result })).catch((err) => onWorkerMessage({ type: 'error', id, message: String(err.message || err) }));
  } else worker.postMessage({ type: 'run', id: runId, terms, settings, garch });
}

// ------------------------------------------------------------------ update
function showErrors(errors) {
  for (const el of document.querySelectorAll('[data-field] .err')) { el.hidden = true; el.textContent = ''; }
  // a refinancing offer has no amount or LTV fields: those problems are shown at "What changes?"
  const fieldFor = (f) => (state.refi && ['loanAmount', 'collateralBtc', 'initialLtv'].includes(f) ? 'refiChange'
    : f === 'rate' ? (state.rateType === 'variable' ? 'ratePath' : 'rateAnnual') : f === 'marginCallConsequence' ? 'marginCallLtv' : f);
  for (const e of errors) {
    if (e.field === 'btcPrice' && !priceInfo) continue; // the price is still loading
    const el = $(`[data-field="${fieldFor(e.field)}"] .err`);
    if (!el) continue;
    const tx = texts().errors[e.code];
    el.hidden = false; el.textContent += `${tx.problem} ${tx.fix} `;
    if (e.field === 'btcPrice' && priceInfo) $('#price-edit').hidden = false; // not while the price is still loading
    const det = el.closest('details'); if (det && !det.open) det.open = true;
  }
  const shownErrors = errors.filter((e) => !(e.field === 'btcPrice' && !priceInfo)).length;
  $('#error-banner').hidden = shownErrors === 0;
  if (shownErrors && !termsOpen) setTermsOpen(true);
}

function update() {
  const { terms, settings } = toTerms(state, { base: activeBase() });
  const v = validateTerms(terms);
  showErrors(v.errors);
  const ltvToday = $('#ltv-today');
  if (ltvToday) {
    ltvToday.textContent = !Number.isFinite(terms.initialLtv) ? '' : state.refi
      ? t('compare.newLoanLine', { amount: money0(terms.loanAmount, terms.currency), btc: num(terms.collateralInput, 4), ltv: pct(terms.initialLtv, 1) })
      : `LTV ${pct(terms.initialLtv, 1)}`;
  }
  if (!lastRisk) $('#headline-text').innerHTML = `<em class="hero-n">…</em> <span class="of">${esc(texts().results.heroOf)}</span> <span class="sentence">${esc(texts().ui.computingShort)}</span>`;
  renderCompare(); // also while the selected offer has an error, so the table and names stay current
  if (compare) $('#ans-label').textContent = offerName(compare.active);
  if (!v.ok) { document.body.classList.add('invalid'); updateAnswerBar(); return; }
  document.body.classList.remove('invalid');
  lastTerms = terms; lastSettings = settings;
  moreSummary(terms);
  renderLoan();
  clearTimeout(timer);
  if (compare) settings.compareTerms = compare.offers.map((_, i) => (i === compare.active ? null : validTermsOf(i)));
  const sameAsEmbedded = !compare && embeddedKey !== null && exampleKey(state) === embeddedKey;
  if (sameAsEmbedded) { riskTerms = terms; riskSettings = settings; } // same answer, today's price for the charts
  else if (lastRisk) document.body.classList.add('outdated');
  updateAnswerBar();
  if (!started) return;
  if (!sameAsEmbedded) { $('#progress').hidden = false; $('#progress').textContent = t('ui.computing', { pct: 0 }); }
  timer = setTimeout(() => { requestRisk(terms, settings); if (sameAsEmbedded) quietRuns.add(runId); }, 300);
}

// ------------------------------------------------------------------ results: parts that need no simulation
const of100 = (p) => Math.round(p * 100);
const signedPct = (x, d = 0) => `${x > 0 ? '+' : ''}${pct(x, d)}`;
const salePrices = (tm) => ({ lp: liquidationPrices(tm), mp: marginCallPrices(tm), rules: lenderRules(tm) });

function renderLoan() {
  const tm = lastTerms; const cur = tm.currency;
  const { lp, mp, rules } = salePrices(tm);
  const drop = dropToLiquidation(tm);
  const v = { drop: pct(drop, 0), price: money0(lp.atStart, cur), mcPrice: mp ? money0(mp.atStart, cur) : '', mcDrop: mp ? pct(1 - mp.atStart / tm.btcPrice, 0) : '', hours: tm.curePeriodHours };
  let sale;
  if (rules.behaviour === 'autoPartial') sale = t(rules.liquidationSale === 'partial' ? 'results.saleLineAutoPartialLiq' : 'results.saleLineAuto', v);
  else if (rules.liquidationSale === 'partial') sale = t('results.saleLinePartialLiq', v);
  else if (rules.afterCure) sale = t('results.saleLineCure', v);
  else sale = t('results.saleLine', v);
  const rising = tm.repayment === 'bullet' && lp.atMaturity > lp.atStart * 1.005 ? ` ${t('results.rising', { end: money0(lp.atMaturity, cur) })}` : '';
  $('#sale-line').textContent = sale + rising;
  renderAnswerTop(tm);
  renderTiles(tm);
  renderTermsChips(tm);
  renderFallsText();
  renderCost();
}

// The label above the answer ("Example" / "Your terms" / "Shared with you") and the example as a story.
function renderAnswerTop(tm) {
  const R = texts().results; const ex = isExample();
  $('#ans-label').textContent = compare ? offerName(compare.active) : ex ? R.labelExample : openedFromLink && !$('#shared-note').hidden ? R.labelShared : R.labelYours;
  $('#example-story').textContent = ex ? t('results.exampleStory', {
    amount: money0(tm.loanAmount, tm.currency), months: tm.durationMonths, value: money0(tm.loanAmount / tm.initialLtv, tm.currency),
    ltv: pct(tm.initialLtv, 0), liq: pct(tm.liquidationLtv, 0),
  }) : '';
  $('#own-terms-link').textContent = ex ? R.ownTerms : R.editTerms;
}

// ------------------------------------------------------------------ comparing offers
const offerName = (i) => {
  const Cm = texts().compare;
  if (compare && compare.names[i]) return compare.names[i];
  if (compare && compare.kind === 'refi') return i === 0 ? Cm.current : Cm.refinanced;
  return Cm.names[i];
};
const activeBase = () => (compare && compare.kind === 'refi' && compare.active > 0 ? { ...compare.offers[0], btcPrice: state.btcPrice, currency: state.currency } : null);
function formOf(i) {
  const f = i === compare.active ? state : compare.offers[i];
  return { ...f, btcPrice: state.btcPrice, currency: state.currency };
}
function termsOf(i) {
  const base = compare.kind === 'refi' && i > 0 ? formOf(0) : null;
  return toTerms(formOf(i), { base }).terms;
}
function validTermsOf(i) { const tm = termsOf(i); return validateTerms(tm).ok ? tm : null; }

function setActive(i) {
  if (!compare || i === compare.active || i < 0 || i >= compare.offers.length) return;
  compare.offers[compare.active] = state;
  state = formOf(i);
  compare.active = i;
  saveState(); renderForm(); update();
  if (lastRisk) renderRisk();
}
function startCompare() {
  const refi = state.mode === 'existing';
  compare = { kind: refi ? 'refi' : 'offers', active: 0, offers: [structuredClone(state)], names: [] };
  compare.offers.push(refi
    ? { ...structuredClone(state), mode: 'new', ltvInput: 'btc', originationFee: { value: 0, type: 'percent' }, purpose: 'spend', refi: { change: 'same', extra: '', back: '', exitFee: '', transferFee: '' } }
    : structuredClone(state));
  setActive(1);
  setTermsOpen(true, { focus: true });
}
function addOffer() {
  if (!compare || compare.kind !== 'offers' || compare.offers.length >= 3) return;
  compare.offers[compare.active] = state;
  compare.offers.push(structuredClone(state));
  setActive(compare.offers.length - 1);
  setTermsOpen(true, { focus: true });
}
function removeOffer(i) {
  if (!compare) return;
  if (compare.offers.length <= 2 || (compare.kind === 'refi' && i === 0)) { endCompare(i === 0 ? 1 : 0); return; }
  compare.offers.splice(i, 1); compare.names.splice(i, 1);
  compare.active = 0; state = formOf(0);
  saveState(); renderForm(); update();
}
function endCompare(keep = compare.active) {
  const f = formOf(keep);
  state = compare.kind === 'refi' && keep > 0 ? { ...toForm(f, formOf(0)) } : f;
  compare = null; lastRisk = null;
  saveState(); renderForm(); update();
}
// a refinancing offer kept on its own becomes an ordinary new-loan form
const toForm = (f, base) => { const { refi, ...rest } = f; const tm = toTerms(f, { base }).terms; return { ...rest, mode: 'new', ltvInput: 'btc', loanAmount: tm.loanAmount, collateralBtc: String(tm.collateralInput) }; };

// The four numbers of each offer as the headline shows them (rounded so the dots add up to 100)
function heroSplit(m) {
  const pMarginOnly = m.pMarginCall === null ? 0 : Math.max(0, m.pMarginCall - m.pLiquidation - m.pPartial);
  return splitTo100([m.pLiquidation, m.pPartial, pMarginOnly, 1 - m.pLiquidation - m.pPartial - pMarginOnly]);
}
let lastCmp = null; // the numbers in the table, for the share summary
function renderCompare() {
  const el = $('#cmp');
  $('#compare-btn').hidden = !!compare;
  $('#compare-btn').textContent = state.mode === 'existing' ? texts().compare.addRefi : texts().compare.add;
  if (!compare) { el.hidden = true; $('#showing').hidden = true; lastCmp = null; return; }
  const Cm = texts().compare; const cur = state.currency;
  const n = compare.offers.length; const idx = [...Array(n).keys()];
  const T = idx.map((i) => { try { const tm = termsOf(i); return validateTerms(tm).ok ? tm : null; } catch { return null; } });
  const ready = lastRisk && lastRisk.compare && lastRisk.compare.length === n && riskTerms && riskTerms.currency === cur;
  const mainOf = (i) => (!ready ? null : i === compare.active ? lastRisk.main : lastRisk.compare[i]);
  const big = (v) => `<span class="big">${v}</span>`;
  const cell = (v, sub = '') => `<td>${v}${sub ? `<small>${esc(sub)}</small>` : ''}</td>`;
  const dash = '–'; const wait = '…';
  const nLiq = idx.map((i) => { const m = mainOf(i); return T[i] && m ? heroSplit(m)[0] : null; });
  const head = `<tr><td></td>${idx.map((i) => `<th scope="col"><button type="button" class="col${i === compare.active ? ' active' : ''}" data-offer="${i}" aria-pressed="${i === compare.active}">${esc(offerName(i))}</button></th>`).join('')}</tr>`;
  const row = (label, sub, cells, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</th>${cells.join('')}</tr>`;
  const sold = idx.map((i) => (T[i] ? cell(esc(money0(liquidationPrices(T[i]).atStart, cur)), `−${pct(dropToLiquidation(T[i]), 0)}`) : cell(Cm.fixTerms)));
  let rows = ''; const notes = [];
  if (compare.kind === 'offers') {
    rows += row(Cm.rowLiq, '', idx.map((i) => cell(T[i] ? big(nLiq[i] ?? wait) : dash, T[i] ? t('compare.withinMonths', { months: T[i].durationMonths }) : '')));
    rows += row(Cm.rowSold, '', sold);
    rows += row(Cm.rowCost, '', idx.map((i) => { if (!T[i]) return cell(dash); const s = loanSummary(T[i]); return cell(esc(money0(s.totalCost, cur)), t('compare.perYear', { apr: pct(s.effectiveApr, 1) })); }));
    rows += row(Cm.rowReceive, '', idx.map((i) => cell(T[i] ? esc(money0(loanSummary(T[i]).amountReceived, cur)) : dash)));
    rows += row(Cm.rowMargin, '', idx.map((i) => { const mp = T[i] && marginCallPrices(T[i]); if (!mp) return cell(dash); const r = lenderRules(T[i]); return cell(esc(money0(mp.atStart, cur)), r.behaviour === 'autoPartial' ? texts().results.tileMarginAuto : r.afterCure ? t('results.tileMarginHours', { hours: T[i].curePeriodHours }) : texts().results.tileMarginWarning); }), 'desk-only');
    const ok = T.filter(Boolean);
    if (new Set(ok.map((x) => Math.round(x.loanAmount))).size > 1) notes.push(Cm.diffAmount);
    if (new Set(ok.map((x) => x.durationMonths)).size > 1) notes.push(Cm.diffMonths);
    lastCmp = { kind: 'offers', list: idx.map((i) => `${offerName(i)} ${nLiq[i] ?? wait}`).join(', ') };
  } else {
    const cur0 = T[0]; const span = cur0 ? cur0.durationMonths : null;
    const m1 = mainOf(1);
    const sameSpan = T[1] && m1 ? (span <= T[1].durationMonths ? Math.round(m1.cumulativeByMonth[span - 1] * 100) : nLiq[1]) : null;
    rows += row(Cm.rowLiq, span ? t('compare.nextMonths', { months: span }) : '', [cell(T[0] ? big(nLiq[0] ?? wait) : dash), cell(T[1] ? big(sameSpan ?? wait) : dash)]);
    rows += row(Cm.rowLiq, T[1] ? t('compare.wholeTerm', { months: T[1].durationMonths }) : '', [cell(dash), cell(T[1] ? big(nLiq[1] ?? wait) : dash)]);
    rows += row(Cm.rowSold, '', sold);
    const refiForm1 = compare.active === 1 ? state : compare.offers[1];
    rows += row(Cm.rowReceiveNow, '', [cell(dash), cell(T[1] && cur0 ? esc(money0(loanSummary(T[1]).amountReceived - cur0.loanAmount - switchCosts(refiForm1), cur)) : dash)]);
    rows += row(Cm.rowCost, '', [cell(cur0 ? esc(money0(loanSummary(cur0).totalInterest, cur)) : dash, Cm.interestLeft), cell(T[1] ? esc(money0(loanSummary(T[1]).totalCost + switchCosts(refiForm1), cur)) : dash, Cm.inclSwitching)]);
    if (T[1] && span && T[1].durationMonths < span) notes.push(Cm.shorterRefi);
    lastCmp = { kind: 'refi', months: span, a: nLiq[0] ?? wait, b: sameSpan ?? wait };
  }
  el.hidden = false;
  el.innerHTML = `<div class="label">${esc(compare.kind === 'refi' ? Cm.titleRefi : Cm.title)} · ${esc(Cm.sameFutures)}</div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="${esc(compare.kind === 'refi' ? Cm.titleRefi : Cm.title)}"><table class="cmp"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
    <p class="meta">${esc(Cm.noWinner)}${notes.length ? ` ${notes.map(esc).join(' ')}` : ''}</p>
    <p class="actions">${compare.kind === 'offers' && n < 3 ? `<button type="button" class="secondary" data-compare-add>${esc(Cm.addC)}</button>` : ''}
      <button type="button" class="link" data-compare-remove>${esc(t('compare.remove', { name: offerName(compare.active) }))}</button>
      <button type="button" class="link" data-compare-end>${esc(Cm.end)}</button></p>`;
  $('#showing').hidden = false;
  $('#showing').textContent = t('compare.showing', { name: offerName(compare.active) });
}

// Key figures under the answer. All of them need no simulation, so they follow typing at once.
function renderTiles(tm) {
  const R = texts().results; const cur = tm.currency;
  const { lp, mp, rules } = salePrices(tm);
  const s = loanSummary(tm);
  const tile = (label, value, sub, cls = '') => `<div class="tile${cls}"><div class="label">${esc(label)}</div><div class="v">${esc(value)}</div><div class="s">${esc(sub)}</div></div>`;
  let html = tile(rules.liquidationSale === 'partial' ? R.tilePartSold : R.tileSold, money0(lp.atStart, cur), t('results.tileSoldSub', { drop: `−${pct(dropToLiquidation(tm), 0)}` }));
  const marginTile = mp ? tile(R.tileMargin, money0(mp.atStart, cur), rules.behaviour === 'autoPartial' ? R.tileMarginAuto : rules.afterCure ? t('results.tileMarginHours', { hours: tm.curePeriodHours }) : R.tileMarginWarning, ' desk-only') : '';
  if (tm.mode === 'existing') {
    html += tile(R.tileInterest, money0(s.totalInterest, cur), R.tileInterestSub);
    html += mp ? marginTile.replace(' desk-only', '') : '';
  } else {
    html += marginTile;
    html += tile(R.tileCost, money0(s.totalCost + switchCosts(state), cur), t('results.tileCostSub', { apr: pct(s.effectiveApr, 1) }));
    const rise = tm.purpose === 'buy' ? s.totalPayback / s.amountReceived - 1 : breakevenReturn(tm, { taxRateNow: tm.taxRateNow, taxRateAtMaturity: tm.taxRateAtMaturity });
    html += tile(tm.purpose === 'buy' ? R.tileBreakevenBuy : R.tileBreakeven, t('results.tileBreakevenValue', { rise: signedPct(rise, 0) }), R.tileBreakevenSub);
  }
  $('#tiles').innerHTML = html;
  // what a sale leaves you with: "liquidated" does not mean "everything lost"
  if (rules.liquidationSale === 'all') {
    const lq = costIfLiquidated(tm, { price: lp.atStart, debt: tm.loanAmount });
    $('#sold-line').textContent = t('results.soldGetBack', { back: num(Math.max(0, lq.btcReturned), 4), btc: num(collateralBtc(tm), 4) });
  } else $('#sold-line').textContent = R.soldPartial;
}

// The key terms in one line (phones, while the form is folded away).
function renderTermsChips(tm) {
  const f = F(); const cur = tm.currency;
  const parts = [money0(tm.loanAmount, cur), `LTV ${pct(tm.initialLtv, 0)}`, `${f.liquidationLtv.label} ${pct(tm.liquidationLtv, 0)}`,
    `${tm.durationMonths} ${t('ui.months')}`, tm.rate.type === 'fixed' ? `${pct(tm.rate.annual, 1)} ${t('ui.perYear')}` : f.rateAnnual.label];
  if (tm.marginCallLtv) parts.push(`${f.marginCallLtv.label} ${pct(tm.marginCallLtv, 0)}`);
  $('#terms-chips').innerHTML = parts.map((p) => `<span>${esc(p)}</span>`).join('');
}

// Share: the system share sheet on phones, otherwise link and summary to the clipboard.
function shareText() {
  const tm = riskTerms || lastTerms; const r = lastRisk;
  if (lastCmp) return lastCmp.kind === 'refi' ? t('share.refi', { months: lastCmp.months, a: lastCmp.a, b: lastCmp.b }) : t('share.compare', { list: lastCmp.list });
  if (!tm || !r || !headlineShown) return '';
  const { lp } = salePrices(tm); const s = loanSummary(tm);
  return t(tm.mode === 'existing' ? 'share.existing' : 'share.one', {
    n: headlineShown.n, months: tm.durationMonths, price: money0(lp.atStart, tm.currency), drop: `−${pct(dropToLiquidation(tm), 0)}`, cost: money0(s.totalCost, tm.currency),
  });
}
async function share() {
  saveState();
  const url = `${location.origin}${location.pathname}${encodeState(state, compare)}`;
  const text = shareText();
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: texts().meta.name, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  navigator.clipboard?.writeText(text ? `${text}\n${url}` : url).then(() => { $('#link-copied').hidden = false; });
}

function renderFallsText() {
  const tm = lastTerms; const cur = tm.currency; const Fa = texts().falls;
  const { lp, mp, rules } = salePrices(tm);
  const target = rules.target;
  const ladder = [[Fa.ladderToday, tm.btcPrice, 'today'], ...(mp ? [[Fa.ladderMargin, mp.atStart, 'margin']] : []), [Fa.ladderSale, lp.atStart, 'sale']];
  const span = Math.max(0.3, 1 - lp.atStart / tm.btcPrice) * 1.15;
  const pos = (p) => 90 - ((1 - p / tm.btcPrice) / span) * 80;
  let html = `<div class="ladder" role="img" aria-label="${esc(ladder.map(([l, p]) => `${l} ${money0(p, cur)}`).join(', '))}"><div class="ln"></div>${ladder.map(([l, p, k]) => `<div class="pt pt-${k}" style="left:${pos(p)}%"><i></i>${esc(l)}<br><b>${esc(money0(p, cur))}</b>${k === 'today' ? '' : `<br>−${esc(pct(1 - p / tm.btcPrice, 0))}`}</div>`).join('')}</div>`;
  if (mp) {
    const top = topUpToCure(tm, { price: mp.atStart, debt: tm.loanAmount, targetLtv: target });
    const vals = { mcPrice: money0(mp.atStart, cur), topUp: num(top.btc, 4), topUpValue: money0(top.value, cur), repay: money0(top.repayInstead, cur), target: pct(target, 0), hours: tm.curePeriodHours };
    if (rules.behaviour === 'autoPartial') html += `<p>${esc(t('falls.marginAuto', { ...vals, sold: num(partialSaleBtc(rules, tm.loanAmount, collateralBtc(tm), mp.atStart), 4) }))}</p>`;
    else if (rules.afterCure) html += `<p>${esc(t('falls.marginCure', { ...vals, what: rules.cureSale === 'partial' ? t('falls.whatPartial', { target: pct(target, 0) }) : t('falls.whatAll') }))}</p>`;
    else html += `<p>${esc(t('falls.marginWarning', vals))}</p>`;
  }
  if (rules.liquidationSale === 'partial') html += `<p>${esc(t('falls.liquidationPartial', { price: money0(lp.atStart, cur), target: pct(target, 0) }))}</p>`;
  else {
    const lq = costIfLiquidated(tm, { price: lp.atStart, debt: tm.loanAmount });
    html += `<p>${esc(t('falls.liquidationAll', { price: money0(lp.atStart, cur), sold: num(lq.btcSold, 4), returned: num(lq.btcReturned, 4), returnedValue: money0(lq.valueReturned, cur) }))}</p>`;
  }
  $('#falls-text').innerHTML = html;
}

function renderCost() {
  const tm = lastTerms; const cur = tm.currency; const C = texts().cost;
  const s = loanSummary(tm);
  const existing = tm.mode === 'existing';
  const rows = s.schedule.map((r) => `<tr><td>${r.month}</td><td>${esc(isoDate(r.date))}</td><td>${money(r.interest, cur)}</td><td>${money(r.principal, cur)}</td><td>${money(r.payment, cur)}</td><td>${money(r.balanceAfter, cur)}</td></tr>`).join('');
  let html = `<p>${esc(existing ? t('cost.lineExisting', { payback: money(s.totalPayback, cur), interest: money(s.totalInterest, cur) })
    : t('cost.line', { received: money(s.amountReceived, cur), payback: money(s.totalPayback, cur), cost: money(s.totalCost, cur), apr: pct(s.effectiveApr, 1) }))}</p>
    <p class="hint">${esc(C.timingNote)}</p>
    <details class="table-details" data-remember="plan"${openDetails.has('plan') ? ' open' : ''}><summary>${esc(C.schedule)}</summary><div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t('ui.showTable'))}"><table><thead><tr>${C.scheduleHead.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
  if (tm.purpose !== 'buy') {
    html += `<h4>${esc(texts().sections.borrowOrSell)}</h4><p>${esc(C.sellIntro)}</p>
      <p class="big-line">${esc(t('cost.breakeven', { rise: pct(breakevenReturn(tm, { taxRateNow: tm.taxRateNow, taxRateAtMaturity: tm.taxRateAtMaturity }), 1) }))}</p>
      <div class="pair tax">${numField('taxRateNow', C.taxNow, '%')}${numField('taxRateAtMaturity', C.taxLater, '%')}</div><p class="hint">${esc(C.taxNote)}</p>`;
  } else {
    html += '<div id="leverage"></div>';
  }
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
  if (active === 'taxRateNow' || active === 'taxRateAtMaturity') { // don't rebuild the field being typed in
    const bl = $('#cost-body .big-line'); if (bl) bl.textContent = t('cost.breakeven', { rise: pct(breakevenReturn(tm, { taxRateNow: tm.taxRateNow, taxRateAtMaturity: tm.taxRateAtMaturity }), 1) });
    return;
  }
  $('#cost-body').innerHTML = html;
  $('#sec-cost-title').textContent = `${texts().sections.cost} · ${tm.purpose === 'buy' ? texts().sections.leverage : texts().sections.borrowOrSell}`;
  if (tm.purpose === 'buy') renderLeverage();
}

// ------------------------------------------------------------------ results: from the simulation
function dotsHtml(groups, label) {
  let n = 0; let h = '';
  for (const [count, cls] of groups) for (let i = 0; i < count && n < 100; i++, n++) h += `<i class="${cls}"></i>`;
  return `<div class="dots" role="img" aria-label="${esc(label)}">${h}</div>`;
}
function legendHtml(items) {
  return `<p class="legend">${items.filter(([n]) => n > 0).map(([n, cls, l]) => `<span><i class="${cls}"></i>${n} ${esc(l)}</span>`).join('')}</p>`;
}
function splitTo100(parts) { // rounds shares so they add up to exactly 100
  const raw = parts.map((p) => Math.max(0, p) * 100); const fl = raw.map(Math.floor);
  let rest = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return fl;
}

function renderRisk() {
  const r = lastRisk; const tm = riskTerms;
  if (!r || !tm || r.currency !== tm.currency) return;
  document.body.classList.remove('outdated');
  const R = texts().results; const cur = tm.currency; const months = tm.durationMonths;
  const m = r.main;
  const [nLiq, nPart, nMargin, nNone] = heroSplit(m);
  const rest = m.pPartial >= 0.005 ? t('results.heroPartial', { m: nPart, months })
    : t(tm.mode === 'existing' ? 'results.heroLiqExisting' : 'results.heroLiq', { months });
  const headline = `${nLiq} ${R.heroOf} ${rest}`;
  $('#headline-text').innerHTML = `<em class="hero-n">${nLiq}</em> <span class="of">${esc(R.heroOf)}</span> <span class="sentence">${esc(rest)}</span>`;
  if (barNow !== null && barNow !== nLiq) barWas = barNow;
  barNow = nLiq;
  headlineShown = { p: m.pLiquidation, n: nLiq };
  $('#best-lever').textContent = bestLeverText(r);
  $('#dots').innerHTML = dotsHtml([[nLiq, 'd-liq'], [nPart, 'd-part'], [nMargin, 'd-margin'], [nNone, 'd-none']], headline)
    + legendHtml([[nLiq, 'd-liq', R.legendLiquidated], [nPart, 'd-part', R.legendPartial], [nMargin, 'd-margin', R.legendMargin], [nNone, 'd-none', R.legendNothing]]);
  $('#kept-line').textContent = m.keptAfterSale && m.pPartial >= 0.005 ? t('results.kept', { kept: pct(m.keptAfterSale.q50, 0) }) : '';
  const lastHour = Math.max(META.prices[cur].to, appended[cur] && appended[cur].length ? appended[cur].at(-1).time : 0);
  $('#basis-line').textContent = t('results.basis');
  // the assumption behind the number, and the two other methods next to it (fairness: the
  // simulation is the most cautious; the real history and the volatility model are shown with it)
  const rules = lenderRules(tm);
  $('#assume-line').textContent = !rules.afterCure ? '' : tm.reserveAmount > 0 ? t('results.assumeReserve', { reserve: money0(tm.reserveAmount, cur) }) : texts().results.assumeNoTopUp;
  $('#methods-line').textContent = `${t('results.otherMethods', { h: of100(r.replay.liquidatedShare), g: of100(r.garchMc.pLiquidation) })} · `;
  // the whole period the results are based on, and when the stored data was last updated
  $('#data-period').textContent = t('ui.dataThrough', { from: date(META.prices[cur].from), to: date(lastHour), updated: date(META.dataUpdated || META.prices[cur].to) });
  renderSafer(); renderTrend(); renderCompare(); updateAnswerBar();
  if (tm.purpose === 'buy') renderLeverage();
  $('#history-text').innerHTML = historyText();
  $('#falls-month').textContent = fallsMonthText();
  renderTrendFacts();
  if ($('#sec-falls').open) renderFutures();
  if ($('#sec-history').open) renderStories();
  if ($('#method').open) renderExpertCharts();
  $('#data-range').textContent = `${t('ui.dataUntil', { from: date(META.prices[cur].from), to: date(META.prices[cur].to) })}${appended[cur] && appended[cur].length ? ` ${t('ui.dataAppended', { to: dateTime(appended[cur].at(-1).time) })}` : ''}`;
}

// The visitor's own number is shown exactly as in the headline (which rounds so the dots add up to 100).
let headlineShown = null;
const shown = (p) => (headlineShown && p === headlineShown.p ? headlineShown.n : of100(p));
const leverLabel = (l, tm) => t(`results.levers.${l.id}`, {
  value: l.id === 'reserve' ? money0(l.value, tm.currency) : l.id === 'shorter' ? l.value : l.value !== null ? pct(l.value, 0) : '', months: tm.durationMonths,
});
// Under the answer: the one change from "Make it safer" that lowers the number most
function bestLeverText(r) {
  const best = r.levers && r.levers[0];
  if (!best || shown(best.p) >= shown(r.main.pLiquidation)) return '';
  return t('results.bestLever', { lever: leverLabel(best, riskTerms), p: shown(best.p) });
}

function renderSafer() {
  const r = lastRisk; const tm = riskTerms; const R = texts().results;
  const el = $('#safer-body');
  if (!r.slider) { el.innerHTML = `<p class="progress">${esc(texts().ui.computingShort)}</p>`; return; }
  const grid = r.slider;
  if (!grid.length) { el.innerHTML = ''; return; }
  const idx = grid.reduce((best, g, i) => (Math.abs(g.ltv - tm.initialLtv) < Math.abs(grid[best].ltv - tm.initialLtv) ? i : best), 0);
  const line = (i) => {
    const g = grid[i];
    if (tm.mode === 'existing') {
      const btcNeeded = tm.loanAmount / (g.ltv * tm.btcPrice);
      const add = btcNeeded - tm.collateralInput;
      return add > 0.00005 ? t('results.sliderLineExisting', { ltv: pct(g.ltv, 0), p: shown(g.p), btc: btc(btcNeeded), add: btc(add) })
        : t('results.sliderLineExistingNow', { ltv: pct(g.ltv, 0), p: shown(g.p), btc: btc(btcNeeded) });
    }
    return t('results.sliderLine', { ltv: pct(g.ltv, 0), p: shown(g.p), btc: btc(g.btc) });
  };
  const levers = r.levers || [];
  const label = (l) => leverLabel(l, tm);
  const row = (text, p, base) => `<div class="lv${base ? ' base' : ''}"><span>${esc(text)}</span><span class="b"><i style="width:${p * 100}%"></i></span><b>${shown(p)}</b></div>`;
  const higher = levers.find((l) => l.id === 'higherLiq');
  // The slider moves by the LTV itself (0-1000 = lowest to highest LTV on the grid) and snaps to
  // the nearest computed point, so a label sits exactly where its LTV is, also when the visitor's
  // own LTV (say 47%) lies between two points. Labels: every 10%.
  const lo = grid[0].ltv; const hi = grid[grid.length - 1].ltv;
  const posOf = (ltv) => Math.round(((ltv - lo) / (hi - lo)) * 1000);
  const nearest = (pos) => grid.reduce((b, g, i) => (Math.abs(posOf(g.ltv) - pos) < Math.abs(posOf(grid[b].ltv) - pos) ? i : b), 0);
  const tickLtvs = []; for (let x = Math.ceil(lo * 10 - 1e-9) / 10; x <= hi + 1e-9; x += 0.1) tickLtvs.push(Math.round(x * 100) / 100);
  el.innerHTML = `<div class="slider"><label for="ltv-slider" id="slider-line">${esc(line(idx))}</label>
    <input id="ltv-slider" type="range" min="0" max="1000" step="1" value="${posOf(grid[idx].ltv)}" style="--fill:${posOf(grid[idx].ltv) / 10}%">
    <div class="ticks" aria-hidden="true">${tickLtvs.map((x) => `<span style="--at:${posOf(x) / 1000}">${pct(x, 0)}</span>`).join('')}</div>
    <p class="hint">${esc(R.sliderNote)}</p></div>
    <p class="sub">${esc(R.otherOptions)}</p>
    <div class="levers">${row(R.yourTerms, r.leverBase, true)}${levers.map((l) => row(label(l), l.p)).join('')}</div>
    ${higher && Math.abs(higher.p - r.leverBase) < 0.05 ? `<p class="hint">${esc(R.higherLiqNote)}</p>` : ''}`;
  const slider = $('#ltv-slider');
  const snap = () => { const i = nearest(Number(slider.value)); slider.value = posOf(grid[i].ltv); slider.style.setProperty('--fill', `${posOf(grid[i].ltv) / 10}%`); return i; };
  slider.setAttribute('aria-valuetext', line(idx));
  // arrow keys jump to the next computed point (the native step of 1 in 1000 would snap back)
  slider.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = Math.min(grid.length - 1, Math.max(0, nearest(Number(slider.value)) + d));
    slider.value = posOf(grid[i].ltv);
    slider.dispatchEvent(new Event('input'));
  });
  slider.addEventListener('input', () => { const i = snap(); $('#slider-line').textContent = line(i); slider.setAttribute('aria-valuetext', line(i)); });
  slider.addEventListener('change', () => {
    if (state.refi) return; // the BTC of a refinancing offer follows from "What changes?"
    const g = grid[snap()];
    if (Math.abs(g.ltv - toTerms(state, { base: activeBase() }).terms.initialLtv) < 1e-9) return; // no change
    // Undo goes back to the terms from before the first slider move (also after several moves)
    if (!undoState) undoState = structuredClone(state);
    sliderChanging = true;
    $('#slider-undo-text').textContent = t('results.sliderUndone', { ltv: pct(g.ltv, 0) });
    $('#slider-undo-btn').textContent = texts().results.sliderUndo;
    $('#slider-undo').hidden = false;
    change((s) => {
      if (s.mode === 'existing' || s.ltvInput === 'btc') s.collateralBtc = String(+(numOr(s.loanAmount) / (g.ltv * numOr(s.btcPrice))).toFixed(6));
      else s.initialLtv = Math.round(g.ltv * 100);
    }, { rerenderForm: true });
    sliderChanging = false;
  });
}

// "Does the price trend matter?": the visitor's loan at fixed yearly trends of the middle path.
function trendRows(r, value, label) {
  return r.trends.map((x) => `<div class="lv${x.trend === 0 ? ' base' : ''}"><span>${esc(t(x.trend === 0 ? 'history.trendNone' : 'history.trendRow', { trend: signedPct(x.trend) }))}</span><span class="b"><i style="width:${value(x) * 100}%"></i></span><b>${shown(value(x))}</b></div>`).join('')
    + `<p class="sub">${esc(label)}</p>`;
}
function renderTrend() {
  const r = lastRisk; const el = $('#trend-body'); if (!el) return;
  if (!r || !r.trends) { el.innerHTML = `<p class="progress">${esc(texts().ui.computingShort)}</p>`; return; }
  const H = texts().history;
  const top = r.trends.at(-1);
  el.innerHTML = `<p class="hint">${rich(H.trendIntro)}</p><div class="levers">${trendRows(r, (x) => x.p, H.trendUnit)}</div>
    <p>${esc(t('history.trendConclusion', { top: shown(top.p), topTrend: signedPct(top.trend) }))}</p>`;
}
// Why no trend is assumed: method justification, shown in "How these numbers are made"
function renderTrendFacts() {
  const r = lastRisk; const el = $('#trend-facts'); if (!el || !r || !r.facts) return;
  const f = r.facts; const by = f.fourYearByStart; const a = by[0]; const z = by[by.length - 1];
  el.innerHTML = `<p class="hint">${esc(t('history.trendUncertainty', { estimate: signedPct(f.trendRange.estimate), low: signedPct(f.trendRange.low), high: signedPct(f.trendRange.high) }))}</p>
    <p class="hint">${esc(t('history.trendPast', { worst: signedPct(f.fourYear.worst), median: signedPct(f.fourYear.median), best: signedPct(f.fourYear.best), firstFrom: a.from, firstTo: a.to, firstRate: signedPct(a.perYear), lastFrom: z.from, lastTo: z.to, lastRate: signedPct(z.perYear) }))}</p>
    <p class="hint">${esc(t('history.trendSwings', { deep: f.deepYears, years: f.years }))}</p>`;
}

function renderLeverage() {
  const r = lastRisk; const tm = riskTerms || lastTerms; const C = texts().cost; const el = $('#leverage');
  if (!el) return;
  const s = loanSummary(tm); const cur = tm.currency;
  const bought = s.amountReceived / tm.btcPrice; const c0 = collateralBtc(tm);
  let html = `<h4>${esc(texts().sections.leverage)}</h4><p>${esc(t('cost.levIntro', { received: money0(s.amountReceived, cur), bought: num(bought, 4) }))}</p>`;
  if (r && r.main && r.main.leverage) {
    const L = r.main.leverage;
    const [more, lessKept, liq] = splitTo100([L.more, L.lessKept, L.liquidated]);
    const sentence = t('cost.levHeadline', { more, less: lessKept + liq, liq });
    html += `<p class="big-line">${esc(sentence)}</p>${dotsHtml([[more, 'd-good'], [lessKept, 'd-none'], [liq, 'd-liq']], sentence)}
      ${legendHtml([[more, 'd-good', C.levLegendMore], [lessKept, 'd-none', C.levLegendLess], [liq, 'd-liq', C.levLegendLiq]])}`;
    if (r.trends && r.trends[0].more !== null) html += `<h4>${esc(C.levTrendTitle)}</h4><div class="levers">${trendRows(r, (x) => x.more, C.levTrendUnit)}</div>`;
  }
  if (lenderRules(tm).liquidationSale === 'all') {
    const lq = costIfLiquidated(tm, { price: liquidationPrices(tm).atStart, debt: tm.loanAmount });
    html += `<p>${esc(t('cost.levLiquidated', { end: num(lq.btcReturned + bought, 4), start: num(c0, 4) }))}</p>`;
  }
  html += `<p>${esc(t('cost.levBreakeven', { rise: pct(s.totalPayback / s.amountReceived - 1, 1) }))}</p>`;
  if (tm.repayWith === 'cash') html += `<p>${esc(t('cost.levCash', { payback: money0(s.totalPayback, cur) }))}</p>`;
  if (r && r.facts) html += `<p class="hint">${esc(t('cost.levFacts', { h4: pct(r.facts.higherAfter4y, 0), h1: pct(r.facts.higherAfter1y, 0), w1: pct(r.facts.worst1y, 0) }))}</p>`;
  el.innerHTML = html;
}

// Real history first, then one sentence that connects it with the answer at the top
function historyText() {
  const r = lastRisk; const rp = r.replay;
  const partial = rp.partialShare >= 0.005 ? t('history.replayPartial', { m: of100(rp.partialShare) }) : '';
  const h = of100(rp.liquidatedShare); const n = shown(r.main.pLiquidation);
  let html = `<p class="big-line">${esc(t('history.replay', { n: h, partial }))}</p>`;
  if (h !== n) html += `<p>${esc(t(h < n ? 'history.bridgeLower' : 'history.bridgeOther', { n }))}</p>`;
  return html;
}
// When the simulated liquidations happen: shown in "What happens when BTC falls"
function fallsMonthText() {
  const cum = lastRisk.main.cumulativeByMonth; const total = cum.at(-1);
  if (total <= 0.02) return '';
  const half = cum.findIndex((x) => x >= total / 2) + 1;
  return half > 0 && half < cum.length ? t('history.byMonth', { months: half }) : '';
}

// charts are drawn when their section is opened (and redrawn after new results)
function chartCommon() {
  const tm = riskTerms; const { lp, mp } = salePrices(tm); const cur = tm.currency;
  const days = daysBetween(tm.startDate, addMonths(tm.startDate, tm.durationMonths));
  return {
    days, liq: [lp.atStart, lp.atMaturity], mc: mp ? [mp.atStart, mp.atMaturity] : null,
    fmt: (v) => money0(v, cur), monthLabel: (m) => (m === 0 ? t('ui.today') : t('ui.monthN', { n: m })),
  };
}
function renderFutures() {
  const r = lastRisk;
  if (!r || !r.main.samplePaths) { // the instant example has no sample paths: they arrive with the full calculation
    $('#futures-chart').innerHTML = `<p class="progress">${esc(texts().ui.computingShort)}</p>`;
    return;
  }
  const Fa = texts().falls; const paths = r.main.samplePaths;
  const shown = showOtherPaths ? paths.slice(20, 40) : paths.slice(0, 20);
  $('#futures-line').textContent = t('falls.futuresLine', { k: shown.filter((p) => p.event).length });
  futuresChart($('#futures-chart'), {
    ...chartCommon(), paths: shown,
    labels: { title: Fa.futuresTitle, margin: Fa.ladderMargin, sale: Fa.ladderSale, tip: (mo, sold) => `${mo === 0 ? t('ui.today') : t('ui.monthN', { n: mo })}: ${sold} / 20 ✕` },
  });
  $('#futures-note').hidden = !shown.some((p) => p.event && p.event.kind !== 'liquidationLtv');
}
function renderStories() {
  const r = lastRisk; if (!r || !r.stories) return;
  const tm = riskTerms; const H = texts().history;
  const names = r.stories.map((s) => isoDate(s.start));
  storiesChart($('#stories-chart'), { ...chartCommon(), stories: r.stories, s0: tm.btcPrice, colors: STORY_COLORS, labels: { title: H.storiesTitle, names, margin: texts().falls.ladderMargin, sale: texts().falls.ladderSale } });
  $('#stories-legend').innerHTML = r.stories.map((s, j) => {
    const d = isoDate(s.start);
    const text = !s.sale ? t('history.survived', { date: d, end: num(s.endRel, 1) })
      : s.sale.reason === 'partial' ? t('history.partial', { date: d, days: s.sale.day, left: pct(s.btcLeft, 0) })
        : t('history.sold', { date: d, days: s.sale.day, end: num(s.endRel, 1) });
    return `<li><i style="background:${STORY_COLORS[j]}"></i>${esc(text)}</li>`;
  }).join('');
}
function renderExpertCharts() {
  const r = lastRisk; if (!r) return;
  const tm = riskTerms; const M = texts().method; const { lp } = salePrices(tm);
  const cm = chartCommon();
  const liqByMonth = [0, ...r.main.fanByMonth.map((f) => f.day)].map((d) => lp.byDay[d]);
  fanChart($('#fan-chart'), { s0: tm.btcPrice, fan: r.main.fanByMonth, liq: liqByMonth, fmt: cm.fmt, monthLabel: cm.monthLabel, labels: { title: M.fanTitle, median: '50%', liq: texts().falls.ladderSale } });
  barChart($('#months-chart'), { values: r.main.cumulativeByMonth.map((x) => x * 100), fmtPct: (v) => `${Math.round(v)}`, monthLabel: (m) => t('ui.monthN', { n: m }), title: M.byMonthTitle });
  const rows = M.compareRows;
  const both = (x) => of100(x.pLiquidation + (x.pPartial || 0));
  $('#compare').innerHTML = `<table><tbody>
    <tr><th scope="row">${esc(rows.bootstrap)}</th><td>${both(r.main)}</td></tr>
    <tr><th scope="row">${esc(rows.garch)}</th><td>${both(r.garchMc)}</td></tr>
    <tr><th scope="row">${esc(rows.replay)}</th><td>${of100(r.replay.liquidatedShare + (r.replay.partialShare || 0))}</td></tr>
    <tr><th scope="row">${esc(rows.barrier)}</th><td>${of100(r.barrier.p)}</td></tr></tbody></table>
    <p class="hint">${esc(t('method.barrierNote', { sigma: pct(r.barrier.sigma, 0) }))}</p>
    <p class="hint">${esc(t('method.settings', { paths: num(riskSettings.nPaths, 0), block: riskSettings.blockDays, from: date(r.history.from), to: date(r.history.to) }))}</p>`;
}

// ------------------------------------------------------------------ static parts
function renderStatic() {
  const tx = texts();
  document.title = tx.meta.title;
  $('#code-link').href = SITE.codeUrl;
  $('#basis-line').textContent = t('results.basis');
  const cur0 = state.currency;
  if (META.prices[cur0]) $('#data-period').textContent = t('ui.dataThrough', { from: date(META.prices[cur0].from), to: date(META.prices[cur0].to), updated: date(META.dataUpdated || META.prices[cur0].to) });
  $('#maker').textContent = t('footer.maker', { name: SITE.maker });
  $('#share-btn').textContent = tx.ui.share;
  $('#lang-missing').textContent = tx.feedback.languageMissing;
  $('#lang-missing').href = mailtoLink(SITE.feedbackEmail, tx.feedback.languageSubject, `${tx.feedback.language}\n\n`);
  $('#terms-toggle').textContent = t(termsOpen ? 'form.closeTerms' : 'form.editTerms');
  $('meta[name="description"]').setAttribute('content', tx.meta.description);
  for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = rich(t(el.dataset.t));
  $('#lang-code').textContent = getLang().toUpperCase();
  $('#lang-btn').setAttribute('aria-label', `${getLang().toUpperCase()}, ${tx.ui.languageSwitch}: ${tx.ui.languageName}`); // starts with the visible text
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-current', String(b.dataset.lang === getLang()));
  $('#limits').innerHTML = tx.results.limits.map((x) => `<li>${esc(x)}</li>`).join('');
  for (const b of document.querySelectorAll('#answer button.q, #sec-falls button.q')) b.setAttribute('aria-label', tx.ui.more);
  $('#headline-help').innerHTML = rich(tx.results.headlineHelp);
  $('#futures-help').innerHTML = rich(tx.falls.futuresHelp);
  $('#questions').innerHTML = tx.falls.questions.map((x) => `<li>${esc(x)}</li>`).join('');
  const [codeBefore, codeAfter] = tx.method.code.split('{link}');
  $('#method-text').innerHTML = tx.method.text.map((x) => `<li>${rich(x)}</li>`).join('') + `<li>${esc(codeBefore)}<a href="${SITE.codeUrl}" rel="noopener">${esc(SITE.codeUrl.replace('https://', ''))}</a>${esc(codeAfter || '')}</li>`;
  $('#glossary-list').innerHTML = Object.entries(tx.glossary.terms).map(([id, g]) => `<dt id="g-${id}">${esc(g.term)}</dt><dd>${rich(g.text)}</dd>`).join('');
  const em = (s) => esc(s).replace('{email}', `<a href="mailto:${SITE.feedbackEmail}">${SITE.feedbackEmail}</a>`);
  $('#impressum-body').innerHTML = tx.legal.impressum.map((x) => `<p>${em(x)}</p>`).join('');
  $('#privacy-body').innerHTML = tx.legal.privacy.map((sec) => `<h4>${esc(sec.h)}</h4>${sec.p.map((x) => `<p>${em(x)}</p>`).join('')}`).join('');
  for (const n of document.querySelectorAll('.template-note')) n.hidden = !JSON.stringify(tx.legal).includes('«');
  // the embedded history is maintained by the weekly update; warn if it has not run for 45 days
  const oldest = Math.min(...Object.values(META.prices).map((m) => m.to));
  $('#data-old').hidden = !dataAge(oldest).stale;
  $('#data-old').textContent = t('ui.dataOld', { date: date(oldest) });
  $('#donate-address').textContent = SITE.donationAddress;
  renderFeedbackForm();
}

function renderFeedbackForm() {
  const Fb = texts().feedback;
  const scale = (key) => `<div class="chips scale" role="group" aria-label="${esc(Fb[key])}"><span class="sub">${esc(Fb.scaleLow)}</span>${[1, 2, 3, 4, 5, 6, 7].map((n) => `<label class="chip"><input type="radio" name="fb-${key}" value="${n}" data-fb="${key}"${Number(feedback[key]) === n ? ' checked' : ''}><span>${n}</span></label>`).join('')}<span class="sub">${esc(Fb.scaleHigh)}</span></div>`;
  $('#feedback-body').innerHTML = `<p class="hint">${esc(Fb.intro)}</p>
    <fieldset><legend>${esc(Fb.use)}</legend><div class="chips">${Object.entries(Fb.useOptions).map(([k, l]) => `<label class="chip"><input type="radio" name="fb-use" value="${k}" data-fb="use"${feedback.use === k ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
    <label class="block">${esc(Fb.meaning)}<textarea rows="2" data-fb="meaning">${esc(feedback.meaning)}</textarea></label>
    <fieldset><legend>${esc(Fb.useful)}</legend>${scale('useful')}</fieldset>
    <fieldset><legend>${esc(Fb.easy)}</legend>${scale('easy')}</fieldset>
    <label class="block">${esc(Fb.missing)}<textarea rows="2" data-fb="missing">${esc(feedback.missing)}</textarea></label>
    <label class="block">${esc(Fb.language)}<input type="text" data-fb="language" value="${esc(feedback.language)}"></label>
    <label class="check"><input type="checkbox" data-fb="attach"${feedback.attach ? ' checked' : ''}> ${esc(Fb.attach)}</label>
    <p class="buttons"><button type="button" class="primary" data-fb-send>${esc(Fb.write)}</button><button type="button" class="secondary" data-fb-copy>${esc(Fb.copy)}</button></p>
    <p class="hint" id="fb-copied" hidden>${esc(t('feedback.copied', { email: SITE.feedbackEmail }))}</p>`;
}

function showEmbeddedExample() {
  const ex = META.example;
  if (!ex || !lastTerms || exampleKey(state) !== ex.key || !META.prices[state.currency]) return;
  embeddedKey = ex.key;
  lastRisk = ex.result; riskTerms = lastTerms; riskSettings = lastSettings;
  renderRisk();
}

function renderAll() {
  renderStatic();
  renderForm();
  update();
  if (lastRisk) renderRisk();
}

// ------------------------------------------------------------------ start
initLang();
document.addEventListener('input', onInput);
$('#form').addEventListener('submit', (e) => e.preventDefault()); // Enter in a field must not reload the page
document.addEventListener('click', onClick);
document.addEventListener('toggle', onToggle, true);
// language menu: opened by the generic show/hide for aria-controls buttons; closes on choice, Escape or a click elsewhere
const closeLangMenu = () => { $('#lang-list').hidden = true; $('#lang-btn').setAttribute('aria-expanded', 'false'); };
document.addEventListener('click', (e) => {
  const choice = e.target.closest('[data-lang]');
  if (choice) { closeLangMenu(); if (choice.dataset.lang !== getLang()) { setLang(choice.dataset.lang); renderAll(); } $('#lang-btn').focus(); return; }
  if (!e.target.closest('.lang-menu')) closeLangMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#lang-list').hidden) { closeLangMenu(); $('#lang-btn').focus(); } });
$('#reset-btn').addEventListener('click', () => { state = { ...EXAMPLE_FORM, currency: state.currency, btcPrice: state.btcPrice, priceManual: state.priceManual }; saveState(); renderAll(); });
$('#forget-btn').addEventListener('click', () => {
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem('btc-loan-risk:lang'); } catch { /* ignore */ }
  state = { ...EXAMPLE_FORM, currency: state.currency, btcPrice: state.btcPrice, priceManual: false };
  renderAll(); $('#forgotten').hidden = false;
});
if (state.priceManual && numOr(state.btcPrice, null) !== null) priceInfo = { source: 'manual' };
renderAll();
showEmbeddedExample();
// is the answer's number on screen? (decides whether the answer bar is needed)
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { answerInView = e.isIntersecting; updateAnswerBar(); }).observe($('#headline-text'));
}
makeWorker();
const waitMax = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
// wait for the live price (at most 4 s) and the recent hours (at most 1.5 s); later candles are used in the next recalculation
Promise.all([waitMax(loadPrice(false), 4000), waitMax(ensureRecent(state.currency), 1500)]).then(() => { started = true; update(); });
