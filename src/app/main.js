// The page: builds the form, reads it into loan terms, shows the answer first and
// asks the worker for the risk results. No wording lives here: every visible word
// comes from src/content/text.*.js via t().
import { pickFutures } from './pick-futures.js';
import { bestLever } from './best-lever.js';
import { initLang, t, texts, rich, esc, pageHref } from './i18n.js';
import { money, money0, pct, num, btc, date, dateTime, isoDate } from './format.js';
import { futuresChart, storiesChart } from './charts.js';
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
import { toTerms, numOr, today, exampleKey, switchCosts, withSwitching } from './terms.js';
import { initShell, renderShell, setTheme } from './shell.js';
import { dataAge } from '../data/candles.js';
import { gunzipSync, strFromU8 } from 'fflate';

const META = JSON.parse(document.getElementById('meta').textContent);
const STORE_KEY = 'btc-loan-risk:form';
// Inputs are kept for this browser tab (sessionStorage: a reload keeps them, closing the tab deletes them).
// Only if the visitor ticks "Remember my inputs" are they kept for the next visit (localStorage).
// Privacy by default (§ 25 TDDDG): nothing is kept beyond the visit unless the visitor asks for it.
const REMEMBER_KEY = 'btc-loan-risk:remember';
let remember = false;
try { remember = localStorage.getItem(REMEMBER_KEY) === '1'; } catch { /* storage blocked */ }
const store = () => (remember ? localStorage : sessionStorage);
const $ = (sel, root = document) => root.querySelector(sel);
const STORY_COLORS = ['var(--story-1)', 'var(--story-2)', 'var(--story-3)', 'var(--story-4)'];
const SOURCE_NAMES = { bitstamp: 'Bitstamp', coinbase: 'Coinbase', embedded: '' };

// ------------------------------------------------------------------ state
const linkData = decodeLink(location.hash);
// a share link opened in a tab where the page is already open only changes the hash: load it
window.addEventListener('hashchange', () => { if (decodeLink(location.hash)) location.reload(); });
const openedFromLink = !!linkData; let scrolledToAnswer = false;
// A comparison: { kind: 'offers' | 'refi', active, offers: [forms], names: [] }. `state` is always
// the selected offer's form; the others wait in compare.offers. null when nothing is compared.
let compare = null;
let state = loadState();
let priceInfo = null; // { source, time, stale } | { source: 'manual' }
let lastTerms = null; let lastSettings = null; let lastRisk = null; let timer = null; let started = false;
// the terms and settings the current risk results were calculated for (charts must use these, not newer inputs)
let riskTerms = null; let riskSettings = null; const pending = {};
let pathSet = 0; // which 20 of the 100 sample futures are shown
// the example answer computed by the build (META.example), shown at once while the page recomputes it
let embeddedKey = null;
let undoState = null; let sliderChanging = false; let refocusSlider = false;
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
// The on-screen keyboard is open: a text field has the focus and the visible area is much shorter than the
// page's window (iPhone and Android shrink only the "visual viewport"). The bar would then float above the
// keyboard and cover the field being typed in, so it waits until the keyboard closes.
function keyboardOpen() {
  const vv = window.visualViewport; const f = document.activeElement;
  const editable = f && f.matches && f.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, select');
  return !!(vv && editable && window.innerHeight - vv.height * vv.scale > 120);
}
function updateAnswerBar() {
  const bar = $('#answer-bar'); if (!bar) return;
  const show = termsOpen && !answerInView && isPhone() && !keyboardOpen();
  bar.hidden = !show; document.body.classList.toggle('bar-on', show);
  if (!show) return;
  const busy = !lastRisk || document.body.classList.contains('outdated') || document.body.classList.contains('invalid');
  const R = texts().results;
  const html = busy || barNow === null ? esc(texts().ui.computingShort)
    : esc(t('results.barLine', { n: '§' })).replace('§', `<b>${barNow}</b>`) + (barWas !== null && barWas !== barNow ? ` ${esc(t('results.barWas', { m: barWas }))}` : '');
  // rewritten only when it changes: Safari drops a tap on the button if its text is replaced during the tap
  if ($('#answer-bar-text').innerHTML !== html) $('#answer-bar-text').innerHTML = html;
  if ($('#answer-bar-btn').textContent !== R.barGo) $('#answer-bar-btn').textContent = R.barGo;
}
// Keeps what the visitor looks at (or types in) in the same place on screen while results change above
// it. Browsers like Chrome do this themselves ("scroll anchoring"); Safari on the iPhone does not.
function anchorNow() {
  const f = document.activeElement;
  if (f && f !== document.body && f.closest && f.closest('main')) return { el: f, top: f.getBoundingClientRect().top };
  if (window.scrollY < 1) return null; // at the top of the page nothing can jump
  for (const y of [140, 220, 320]) {
    const el = document.elementFromPoint(window.innerWidth / 2, y);
    if (el && el.closest('main') && !el.closest('#answer-bar, #progress')) return { el, top: el.getBoundingClientRect().top };
  }
  return null;
}
function keepInPlace(fn) {
  const a = anchorNow();
  fn();
  if (!a || !a.el.isConnected) return;
  const d = a.el.getBoundingClientRect().top - a.top;
  if (Math.abs(d) < 1) return;
  // on a computer the terms panel scrolls on its own: correct the panel there, otherwise the page
  const panel = a.el.closest('#terms');
  if (panel && panel.scrollHeight > panel.clientHeight && getComputedStyle(panel).overflowY !== 'visible') panel.scrollTop += d;
  else window.scrollBy(0, d);
}
function toAnswer() { $('#answer').scrollIntoView({ block: 'start', behavior: 'smooth' }); }

function loadState() {
  const fromLink = linkData && linkData.form;
  let saved = null;
  try { saved = JSON.parse(store().getItem(STORE_KEY) || 'null'); } catch { /* storage blocked */ }
  // saved inputs are checked like a shared link: anything broken is ignored, never fatal
  if (!saved || typeof saved !== 'object' || (saved.state && typeof saved.state !== 'object')) saved = null;
  const c = linkData ? linkData.compare : saved && saved.compare;
  const okCompare = c && typeof c === 'object' && ['offers', 'refi'].includes(c.kind) && Array.isArray(c.offers) && c.offers.length >= 2 && c.offers.length <= 3
    && c.offers.every((o) => o && typeof o === 'object') && Number.isInteger(c.active) && c.active >= 0 && c.active < c.offers.length;
  if (okCompare) compare = { kind: c.kind, active: c.active, names: Array.isArray(c.names) ? c.names.map((n) => String(n ?? '').slice(0, 40)) : [], offers: c.offers.map((o) => ({ ...EXAMPLE_FORM, ...o })) };
  const s = { ...EXAMPLE_FORM, ...(saved && saved.state), ...(fromLink || {}), ...(compare ? compare.offers[compare.active] : {}) };
  if (fromLink) s.priceManual = false;
  // the model's own settings are fixed (10,000 futures, 30-day pieces): every explanation and the test against
  // history rest on them, so inputs saved by an older version cannot change them
  s.simPaths = EXAMPLE_FORM.simPaths; s.bootstrapBlockDays = EXAMPLE_FORM.bootstrapBlockDays;
  if (!META.prices[s.currency]) s.currency = Object.keys(META.prices)[0];
  // until the live price arrives, start from the last stored price, so the answer can show at once
  if (numOr(s.btcPrice, null) === null) { s.btcPrice = META.prices[s.currency].lastClose; s.priceManual = false; }
  return s;
}
function saveState() {
  if (compare) compare.offers[compare.active] = state;
  try { store().setItem(STORE_KEY, JSON.stringify({ state, compare })); } catch { /* ignore */ }
}
function setRemember(on) {
  remember = on;
  try {
    if (on) { localStorage.setItem(REMEMBER_KEY, '1'); sessionStorage.removeItem(STORE_KEY); } else { localStorage.removeItem(REMEMBER_KEY); localStorage.removeItem(STORE_KEY); }
  } catch { /* storage blocked: for this visit only */ }
  saveState();
}

// ------------------------------------------------------------------ small HTML helpers
const F = () => texts().form.fields;
const helpBtn = (id, label) => `<button type="button" class="q" aria-expanded="false" aria-controls="help-${id}" aria-label="${esc(t('ui.more'))}: ${esc(label)}">?</button>`;
const helpBox = (id, text) => `<div class="help" id="help-${id}" hidden>${rich(text)}</div>`;
function numField(key, label, unit, { help, hint, step = 'any', id = key, after = '' } = {}) {
  return `<div class="field" data-field="${id}">
    <div class="label-row"><label for="f-${id}">${esc(label)}</label>${help ? helpBtn(id, label) : ''}</div>
    ${help ? helpBox(id, help) : ''}
    <div class="with-unit"><input id="f-${id}" data-k="${key}" type="number" inputmode="decimal" step="${step}" value="${esc(getPath(state, key) ?? '')}">${unit ? `<span class="unit">${esc(unit)}</span>` : ''}${after}</div>
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

// Rebuilding the form replaces every field. Keep what the visitor is doing: the field (or button) with the
// cursor, the caret position and where the terms panel and the page are scrolled to. Otherwise typing "70"
// into an empty margin-call field lost the cursor after the "7" (the field appears new) and the panel jumped.
function keepFocus(rebuild) {
  const act = document.activeElement; const panel = $('#terms');
  const inForm = act && act !== document.body && act.closest && act.closest('#form');
  const find = !inForm ? null : act.id ? `#${CSS.escape(act.id)}`
    : act.dataset.set ? `[data-set="${act.dataset.set}"][data-val="${CSS.escape(act.dataset.val)}"]` : act.dataset.k ? `[data-k="${CSS.escape(act.dataset.k)}"]` : null;
  let caret = null; try { caret = inForm && typeof act.selectionStart === 'number' ? [act.selectionStart, act.selectionEnd] : null; } catch { /* number fields have no caret position */ }
  const panelTop = panel ? panel.scrollTop : 0; const pageY = window.scrollY;
  const fieldTop = inForm ? act.getBoundingClientRect().top : null;
  rebuild();
  if (panel) panel.scrollTop = panelTop;
  if (Math.abs(window.scrollY - pageY) >= 1) window.scrollTo(0, pageY);
  const el = find && $(find);
  if (el) {
    el.focus({ preventScroll: true });
    if (caret && el.setSelectionRange) try { el.setSelectionRange(...caret); } catch { /* ignore */ }
    if (el.type === 'number' && el.value) { const v = el.value; el.value = ''; el.value = v; } // caret to the end
    // the same field at the same place on screen, also if something above it changed height
    const d = el.getBoundingClientRect().top - fieldTop;
    if (Math.abs(d) >= 1) { if (panel && panel.scrollHeight > panel.clientHeight && getComputedStyle(panel).overflowY !== 'visible') panel.scrollTop += d; else window.scrollBy(0, d); }
  }
}

function renderForm() { keepFocus(buildForm); }

function buildForm() {
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
    ltvBlock = numField('initialLtv', f.initialLtv.label, '%', { help: fm.help.initialLtv }) + `<p class="hint"><button type="button" class="link" data-set="ltvInput" data-val="btc">${esc(fm.orEnterBtc)}</button></p><p class="hint" id="ltv-interest-hint">${esc(f.initialLtv.interestHint)}</p>`;
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
    ${state.purpose === 'buy' && !existing && (!state.refi || state.refi.change === 'more') ? seg('repayWith', ['sell', 'cash'].map((v) => [v, f.repayWith[v]]), f.repayWith.label) : ''}`;
  const expert = `
    ${existing ? '' : `<div class="field" data-field="startDate"><label for="f-startDate">${esc(f.startDate.label)}</label><input id="f-startDate" type="date" data-k="startDate" value="${esc(state.startDate || today())}"><p class="hint">${esc(f.startDate.hint)}</p></div>`}
    ${select('dayCount', ['30/360', 'act/365', 'act/360'].map((v) => [v, f.dayCount[v]]), f.dayCount.label)}
`;

  const Cm = texts().compare; const refi = !!state.refi;
  const nameField = compare ? `<div class="field"><label for="f-offerName">${esc(Cm.nameLabel)}</label><input id="f-offerName" type="text" maxlength="40" data-offer-name value="${esc(compare.names[compare.active] || '')}" placeholder="${esc(offerName(compare.active))}"></div>` : '';
  let top;
  if (refi) {
    const base = compare.offers[0];
    const ch = state.refi.change;
    const todayLtv = toTerms(formOf(0)).terms.initialLtv;
    top = `<p class="hint">${esc(t('compare.startsFrom', { owed: money0(numOr(base.loanAmount), cur), btc: num(numOr(base.collateralBtc), 4), months: base.durationMonths, ltv: pct(todayLtv, 0) }))}</p>
      ${seg('refi.change', [['same', Cm.same], ['more', Cm.more], ['back', Cm.back]], Cm.whatChanges, { id: 'refiChange' })}
      ${ch === 'more' || ch === 'back' ? `<p class="hint">${esc(Cm.whenRisen)}</p>` : ''}
      ${ch === 'more' ? numField('refi.extra', Cm.extra, cur, { id: 'refiExtra' }) : ''}
      ${ch === 'back' ? numField('refi.back', Cm.backBtc, 'BTC', { id: 'refiBack' }) : ''}
      <p class="hint" id="ltv-today"></p>
      <p class="refi-note" id="refi-note" role="status" hidden></p>
      <p class="hint">${esc(Cm.copyHint)}</p>`;
  } else {
    top = `${compare ? '' : seg('mode', [['new', fm.modeNew], ['existing', fm.modeExisting]], '', { id: 'mode' })}
    <p class="hint"><button type="button" class="link" aria-expanded="false" aria-controls="where">${esc(t('ui.whereLink'))}</button></p>
    <div id="where" class="where" hidden>${whereHtml()}</div>
    ${numField('loanAmount', existing ? f.loanAmount.labelExisting : f.loanAmount.label, '', { hint: existing ? f.loanAmount.hintExisting : '', after: currencySel })}
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
    ${existing || (refi && state.refi.change !== 'more') ? '' : seg('purpose', [['spend', f.purpose.spend], ['buy', f.purpose.buy]], refi ? Cm.extraPurpose : f.purpose.label) + `<p class="hint purpose-hint">${esc(f.purpose.hint)}</p>`}
    <p class="price-line" id="price-line" aria-live="polite"></p>
    <div class="field" data-field="btcPrice" id="price-edit" hidden><span class="with-unit"><input type="number" step="any" inputmode="decimal" data-k="btcPrice" aria-label="BTC ${esc(cur)}" value="${esc(state.btcPrice ?? '')}"><span class="unit">${esc(cur)}</span></span><p class="err" role="alert" hidden></p></div>
    <details class="more" data-remember="more"><summary>${esc(refi ? Cm.moreTerms : existing ? fm.moreTermsExisting : fm.moreTerms)} <span class="sum" id="more-sum"></span></summary>${more}</details>
    ${switching}
    <details class="more" data-remember="expert"><summary>${esc(fm.expert)}</summary>${expert}</details>
    <label class="check remember"><input type="checkbox" data-remember-inputs${remember ? ' checked' : ''}> ${esc(fm.remember)}</label>
    <p class="hint">${esc(fm.rememberHint)}</p>`;
  for (const d of document.querySelectorAll('#form details[data-remember]')) if (openDetails.has(d.dataset.remember)) d.open = true;
  renderPriceLine();
}

function whereHtml() {
  const w = texts().where;
  return `<p><b>${esc(w.title)}</b></p><p>${esc(w.intro)}</p>
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
  else line = esc(t('form.priceLine', { price: money0(p, cur), source: `${SOURCE_NAMES[priceInfo.source] ?? priceInfo.source}${priceInfo.viaEur ? ' (EUR × ECB)' : ''}`, time: dateTime(priceInfo.time) }));
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
  $('#shared-note').hidden = true; $('#link-note').hidden = true; // the inputs are now the visitor's own
  $('#ended-note').hidden = true;
  if (rerenderForm) renderForm();
  update();
}

function onInput(e) {
  const k = e.target.dataset.k;
  if (e.target.matches('[data-remember-inputs]')) { setRemember(e.target.checked); return; }
  if (!k) {
    if (e.target.matches('[data-offer-name]') && compare) { compare.names[compare.active] = e.target.value.slice(0, 40); saveState(); renderCompare(); renderAnswerTop(lastTerms); }
    return;
  }
  const v = e.target.value;
  if (k === 'currency') { lastRisk = null; if (compare) for (const o of compare.offers) o.currency = v; change((s) => { s.currency = v; }, { rerenderForm: true }); loadPrice(true); return; }
  if (k === 'btcPrice') { priceInfo = { source: 'manual' }; change((s) => { s.btcPrice = v; s.priceManual = true; }); renderPriceLine(); return; }
  if (k === 'marginCallLtv') { const wasEmpty = state.marginCallLtv === '' || state.marginCallLtv === null; change((s) => { s.marginCallLtv = v; }, { rerenderForm: wasEmpty !== (v === '') }); return; }
  if (k === 'marginCallConsequence') { change((s) => { s.marginCallConsequence = v; }, { rerenderForm: true }); return; }
  change((s) => setPath(s, k, v));
}

function onClick(e) {
  if (e.target.closest('#terms-toggle')) { const closing = termsOpen; setTermsOpen(!termsOpen); if (closing && isPhone()) toAnswer(); return; }
  if (e.target.closest('[data-to-answer]')) { toAnswer(); return; }
  if (e.target.closest('[data-slider-undo]')) { undoSlider(); return; }
  const ctl = e.target.closest('button[aria-controls]:not(#lang-btn)'); // the language menu: src/app/shell.js
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
      const amount = numOr(s.loanAmount); const price = numOr(s.btcPrice);
      const btcFromLtv = () => String(+(amount / ((numOr(s.initialLtv) / 100) * price)).toFixed(4));
      // switching between "starting LTV" and "BTC you pledge" converts the current values both ways
      if (k === 'ltvInput' && v === 'btc' && s.ltvInput !== 'btc' && numOr(s.initialLtv, 0) > 0) s.collateralBtc = btcFromLtv();
      if (k === 'ltvInput' && v === 'ltv' && s.ltvInput === 'btc' && numOr(s.collateralBtc, 0) > 0) s.initialLtv = +((amount / (numOr(s.collateralBtc) * price)) * 100).toFixed(1);
      // a loan I already have: start from the BTC that fits the current terms, unless BTC was entered before
      if (k === 'mode' && v === 'existing' && !numOr(s.collateralBtc, 0)) s.collateralBtc = btcFromLtv();
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
    pathSet += 1; renderFutures();
  } else if (tgt.closest('[data-open-risk]')) { // the tile line opens "What it costs" at its explanation
    e.preventDefault();
    $('#sec-cost').open = true;
    requestAnimationFrame(() => { $('#risk-cost').scrollIntoView({ block: 'start' }); const h = $('#risk-cost h4'); if (h) h.focus({ preventScroll: true }); }); // the focus follows (keyboard, screen readers)
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
  } else if (tgt.closest('[data-compare-keep]')) {
    // ending a comparison: the visitor chooses which offer stays in the terms (nothing is dropped by surprise)
    const keep = Number(tgt.closest('[data-compare-keep]').dataset.compareKeep);
    const name = offerName(keep);
    endCompare(keep);
    $('#ended-note').textContent = t('compare.keptNote', { name }); $('#ended-note').hidden = false;
  } else if (tgt.closest('[data-offer]')) {
    setActive(Number(tgt.closest('[data-offer]').dataset.offer));
  }
}

function onToggle(e) {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement)) return;
  if (d.dataset.remember) { if (d.open) openDetails.add(d.dataset.remember); else openDetails.delete(d.dataset.remember); }
  if (d.id === 'sec-falls' && d.open) { layoutLadder(); renderFutures(); }
  if (d.id === 'sec-history' && d.open) renderStories();
}

// ------------------------------------------------------------------ live price & recent candles
// The price history and the workers' code come after this script in the page, so the page and its example
// answer show before those 1.7 MB have arrived (go/no-go G1). Everything that reads them waits for dataReady.
let dataReady = document.readyState !== 'loading';
const domReady = dataReady ? Promise.resolve() : new Promise((r) => document.addEventListener('DOMContentLoaded', () => { dataReady = true; r(); }, { once: true }));
async function loadPrice(force = false) {
  if (!force && state.priceManual && numOr(state.btcPrice, null) !== null) { priceInfo = { source: 'manual' }; renderPriceLine(); return; }
  priceInfo = null; renderPriceLine();
  const embedded = Object.fromEntries(Object.entries(META.prices).map(([c, m]) => [c, { price: m.lastClose, time: m.to }]));
  const cur = state.currency;
  await domReady; // the exchange rates are part of the history
  // CHF, GBP, CAD, AUD, CZK, PLN: today's euro price × the latest ECB rate, like their price history
  const fx = fxFor(cur); let r;
  if (fx) {
    const e = await getSpotPrice('EUR', { embedded });
    r = e.stale ? { ...embedded[cur], source: 'embedded', stale: true } : { ...e, price: Math.round(e.price * fx.rates[cur].at(-1) * 100) / 100, viaEur: true };
  } else r = await getSpotPrice(cur, { embedded });
  if (cur !== state.currency) return;
  priceInfo = r;
  state = { ...state, btcPrice: r.price, priceManual: false };
  saveState();
  const input = $('#price-edit input'); if (input) input.value = r.price;
  renderPriceLine();
  update();
}

// The simulation and the real history use only the price history stored in the page (the tested weekly update),
// never hours fetched live: the same terms then give the same number all week, for everyone, and a shared link shows
// its recipient the sender's number. The live price is used for prices and LTVs. (The example once jumped 54 -> 53.)

// ------------------------------------------------------------------ worker
// '#no-worker' in the address forces the fallback (to test browsers that block workers)
let workers = []; let useInline = location.hash === '#no-worker'; let runId = 0; let busy = false;
// With enough cores, three workers compute the answer, "Make it safer" and the slider/trends at the same time
// (identical results: every part uses the same fixed futures). Otherwise one worker computes everything.
const PARTS = (navigator.hardwareConcurrency || 2) >= 4 ? ['main', 'levers', 'extras'] : ['all'];
const sentData = new Set(); const garchCache = { ...(META.garch || {}) }; // fitted at build time
function makeWorker() {
  sentData.clear(); workers = [];
  if (useInline) return;
  try {
    for (const part of PARTS) {
      const w = new Worker(URL.createObjectURL(new Blob([document.getElementById('worker-src').textContent], { type: 'text/javascript' })));
      w.onmessage = (e) => onWorkerMessage({ ...e.data, part });
      w.onerror = () => { useInline = true; for (const x of workers) x.terminate(); workers = []; update(); };
      workers.push(w);
    }
  } catch { useInline = true; workers = []; }
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
  if (useInline) jobSetData(cur, base64, null, fx); else for (const w of workers) w.postMessage({ type: 'data', currency: cur, base64, fx });
  sentData.add(cur);
}
// runs that only confirm the embedded example answer update quietly, once, at the end
const quietRuns = new Set();
// the parts of one run as they arrive: { [part]: { done, total, result } }
let partsOf = {};
function onWorkerMessage(m) {
  if (m.id !== runId) return;
  if (quietRuns.has(m.id) && m.type !== 'result' && m.type !== 'error') return;
  const part = m.part || 'all';
  if (m.type === 'progress') {
    partsOf[part] = { ...partsOf[part], done: m.done, total: m.total };
    const all = Object.values(partsOf); const done = all.reduce((x, p) => x + (p.done || 0), 0); const total = all.reduce((x, p) => x + (p.total || 0), 0);
    $('#progress').hidden = false; $('#progress').textContent = t('ui.computing', { pct: Math.min(99, Math.round((done / Math.max(1, total)) * 100)) });
  } else if (m.type === 'partial' || m.type === 'result') {
    if (m.type === 'result') partsOf[part] = { ...partsOf[part], result: m.result };
    // the answer (part 'main' or 'all') carries everything else; the other parts add their lists when they arrive
    const mainRes = m.type === 'partial' ? m.result : (partsOf.all || partsOf.main || {}).result;
    if (!mainRes) return;
    const lv = partsOf.levers && partsOf.levers.result; const ex = partsOf.extras && partsOf.extras.result;
    const merged = { ...mainRes, ...(lv ? { levers: lv.levers, leverBase: lv.leverBase } : {}), ...(ex ? { slider: ex.slider, trends: ex.trends } : {}) };
    garchCache[merged.currency] = merged.garch;
    lastRisk = merged; [riskTerms, riskSettings] = pending[m.id];
    const finished = PARTS.every((p) => partsOf[p] && partsOf[p].result) || (useInline && m.type === 'result');
    if (finished) { busy = false; $('#progress').hidden = true; document.body.dataset.ready = '1'; }
    keepInPlace(renderRisk);
    // a shared link opens on the answer the sender saw, not on the form
    if (openedFromLink && !scrolledToAnswer) { scrolledToAnswer = true; $('#shared-note').hidden = false; renderAnswerTop(riskTerms); $('#answer').scrollIntoView({ block: 'start' }); }
  } else if (m.type === 'error') {
    busy = false; $('#progress').textContent = m.message;
  }
}
function requestRisk(terms, settings) {
  runId++; document.body.dataset.ready = '0'; partsOf = {};
  if (busy && !useInline) { for (const w of workers) w.terminate(); makeWorker(); }
  if (!workers.length && !useInline) makeWorker();
  sendData(terms.currency);
  busy = true;
  pending[runId] = [terms, settings];
  const garch = garchCache[terms.currency] || null;
  if (useInline) {
    const id = runId;
    jobRun(id, terms, settings, garch, onWorkerMessage).then((result) => onWorkerMessage({ type: 'result', id, result })).catch((err) => onWorkerMessage({ type: 'error', id, message: String(err.message || err) }));
  } else PARTS.forEach((part, i) => workers[i].postMessage({ type: 'run', id: runId, terms, settings: { ...settings, part }, garch }));
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
  if (state.refi && terms.purpose === 'buy') settings.leverageBase = refiWithoutExtra().terms; // what the extra cash does (riskjob.js)
  const v = validateTerms(terms);
  showErrors(v.errors);
  const ltvToday = $('#ltv-today');
  if (ltvToday) {
    ltvToday.textContent = !Number.isFinite(terms.initialLtv) ? '' : state.refi
      ? t('compare.newLoanLine', { amount: money0(terms.loanAmount, terms.currency), btc: num(terms.collateralInput, 4), ltv: pct(terms.initialLtv, 1) })
      : `LTV ${pct(terms.initialLtv, 1)}`;
  }
  renderRefiNote(terms);
  if (!lastRisk) $('#headline-text').innerHTML = `<em class="hero-n">…</em> <span class="of">${esc(texts().results.heroOf)}</span> <span class="sentence">${esc(texts().ui.computingShort)}</span>`;
  renderCompare(); // also while the selected offer has an error, so the table and names stay current
  if (compare) $('#ans-label').textContent = offerName(compare.active);
  if (!v.ok) { document.body.classList.add('invalid'); updateAnswerBar(); return; }
  document.body.classList.remove('invalid');
  lastTerms = terms; lastSettings = settings;
  keepInPlace(() => { moreSummary(terms); renderLoan(); }); // the summary line above the fields can wrap differently
  clearTimeout(timer);
  // the terms changed: results still arriving from the previous calculation are out of date and ignored
  // (otherwise, during the short wait before the new calculation, the old offer's number could show up)
  runId++;
  if (compare) settings.compareTerms = compare.offers.map((_, i) => (i === compare.active ? null : validTermsOf(i)));
  const sameAsEmbedded = !compare && embeddedKey !== null && exampleKey(state) === embeddedKey;
  if (sameAsEmbedded) { riskTerms = terms; riskSettings = settings; if (lastRisk) renderTiles(terms); } // same answer, today's price for the charts (the tile line needs it)
  else if (lastRisk) document.body.classList.add('outdated');
  updateAnswerBar();
  if (!started) return;
  if (!sameAsEmbedded) { $('#progress').hidden = false; $('#progress').textContent = t('ui.computing', { pct: 0 }); }
  // (a calculation needs the history; on a slow connection it may still be arriving)
  timer = setTimeout(function go() { if (!dataReady) { timer = setTimeout(go, 200); return; } requestRisk(terms, settings); if (sameAsEmbedded) quietRuns.add(runId); }, 300);
}

// ------------------------------------------------------------------ results: parts that need no simulation
const of100 = (p) => Math.round(p * 100);
const signedPct = (x, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x), d)}`; // a real minus sign, as everywhere else
const salePrices = (tm) => ({ lp: liquidationPrices(tm), mp: marginCallPrices(tm), rules: lenderRules(tm) });

function renderLoan() {
  const tm = lastTerms; const cur = tm.currency;
  const { lp } = salePrices(tm);
  // the sale price and what happens around it are in the answer and the step-by-step text; here only
  // what they cannot show: a sale price that rises because interest is added to the debt
  const rising = tm.repayment === 'bullet' && lp.atMaturity > lp.atStart * 1.005 ? t('results.rising', { end: money0(lp.atMaturity, cur) }) : '';
  $('#sale-line').textContent = rising; $('#sale-line').hidden = !rising;
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

// Refinancing that borrows more or takes back BTC raises the LTV. Say so right under the input: above the
// margin call (or the liquidation LTV) no loan can start, and how far one can go at today's price; well above
// today's LTV, a lender may not offer it (no claim about lenders, only "ask your lender").
function renderRefiNote(terms) {
  const el = $('#refi-note'); if (!el) return;
  const ch = state.refi && state.refi.change;
  el.hidden = true; el.classList.remove('err');
  if (!ch || ch === 'same' || !Number.isFinite(terms.initialLtv)) return;
  const Cm = texts().compare; const base = toTerms(formOf(0)).terms; const price = terms.btcPrice; const cur = terms.currency;
  const limit = terms.marginCallLtv || terms.liquidationLtv;
  const limitName = terms.marginCallLtv ? Cm.atMargin : Cm.atLiquidation;
  const owed = base.loanAmount; const btc = base.collateralInput;
  if (terms.initialLtv >= limit - 1e-9) {
    // the most that keeps the new loan half a point below the limit (so it never shows as the limit), rounded down
    const room = limit - 0.005;
    const maxBack = Math.floor((btc - owed / (room * price)) * 1e4) / 1e4;
    const maxMore = Math.floor((room * btc * price - owed) / 10) * 10;
    const v = { ltv: pct(terms.initialLtv, 1), limit: `${limitName} ${pct(limit, 0)}` };
    el.textContent = ch === 'back'
      ? (maxBack > 0 ? t('compare.limitBack', { ...v, max: num(maxBack, 4) }) : t('compare.limitBackNone', v))
      : (maxMore > 0 ? t('compare.limitMore', { ...v, max: money0(maxMore, cur) }) : t('compare.limitMoreNone', v));
    el.classList.add('err'); el.hidden = false;
  } else if (terms.initialLtv - base.initialLtv >= 0.1) {
    el.textContent = t('compare.higherThanToday', { ltv: pct(terms.initialLtv, 0), today: pct(base.initialLtv, 0) });
    el.hidden = false;
  }
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
  $('#ended-note').hidden = true;
  const refi = state.mode === 'existing';
  compare = { kind: refi ? 'refi' : 'offers', active: 0, offers: [structuredClone(state)], names: [] };
  compare.offers.push(refi
    ? { ...structuredClone(state), mode: 'new', ltvInput: 'btc', originationFee: { value: 0, type: 'percent' }, purpose: 'spend', refi: { change: 'same', extra: '', back: '', exitFee: '', transferFee: '' } }
    : structuredClone(state));
  setActive(1);
  setTermsOpen(true);
  toCompare();
}
// After "Compare an offer": the table appears above the answer, out of sight from the button, so the
// page scrolls up to it once. The table then takes the focus: it is the fixed point that keepInPlace
// holds still while the new offer is calculated (and screen readers land on it).
function toCompare() {
  const el = $('#cmp');
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
  const { btcPrice, currency } = state;
  compare.offers[compare.active] = state; // the shown offer's latest inputs, before the list changes
  compare.offers.splice(i, 1); compare.names.splice(i, 1);
  compare.active = 0; state = { ...compare.offers[0], btcPrice, currency };
  saveState(); renderForm(); update();
}
function endCompare(keep = compare.active) {
  const f = formOf(keep);
  state = compare.kind === 'refi' && keep > 0 ? { ...toForm(f, formOf(0)) } : f;
  compare = null; lastRisk = null;
  saveState(); renderForm(); update();
  showEmbeddedExample(); // if the kept offer is the example, its answer shows at once
}
// a refinancing offer kept on its own becomes an ordinary new-loan form
const toForm = (f, base) => { const { refi, ...rest } = f; const tm = toTerms(f, { base }).terms; return { ...rest, mode: 'new', ltvInput: 'btc', loanAmount: tm.loanAmount, collateralBtc: String(tm.collateralInput) }; };

// The four numbers of each offer as the headline shows them (rounded so the dots add up to 100)
// "Liquidated" on this page: a forced sale, full or partial (the big number, the table, the options, the methods)
const pSale = (m) => m.pLiquidation + m.pPartial;
function heroSplit(m) {
  const pMarginOnly = m.pMarginCall === null ? 0 : Math.max(0, m.pMarginCall - m.pLiquidation - m.pPartial);
  return splitTo100([m.pLiquidation, m.pPartial, pMarginOnly, 1 - m.pLiquidation - m.pPartial - pMarginOnly]);
}
let lastCmp = null; // the numbers in the table, for the share summary
// A refinancing that borrows more, without the extra cash: the comparison for "buy more BTC" with that cash
const refiWithoutExtra = () => toTerms({ ...state, refi: { ...state.refi, change: 'same' } }, { base: activeBase() });
// The money that buys BTC and what it costs: the whole loan, or for a refinancing only the extra cash
// (its fees and the extra payback, compared with the same refinancing without it)
function buyMoney(tm) {
  const s = loanSummary(tm);
  if (!state.refi) return { received: s.amountReceived, payback: s.totalPayback };
  const b = loanSummary(refiWithoutExtra().terms);
  return { received: s.amountReceived - b.amountReceived, payback: s.totalPayback - b.totalPayback, refi: true };
}

// What changes hands when a refinancing starts: the cash left after repaying the current loan (`owed`)
// and paying fee and switching costs (`sum` from the terms with switching costs), and the BTC taken back.
function startText(sum, form, owed, cur, fmt = money0) {
  const cash = sum.amountReceived - owed;
  const back = form.refi && form.refi.change === 'back' ? numOr(form.refi.back, 0) : 0;
  const parts = [];
  if (back > 0) parts.push(t('compare.nowBtc', { btc: num(back, 4) }));
  if (cash < -0.5) parts.push(t('compare.nowPay', { amount: fmt(-cash, cur) }));
  else if (cash > 0.5 || !parts.length) parts.push(t('compare.nowGet', { amount: fmt(Math.max(0, cash), cur) }));
  return parts.join(', ');
}
// The cost figures of the shown offer: a refinancing offer carries its switching costs like a fee.
const costTerms = (tm) => (state.refi ? withSwitching(tm, switchCosts(state)) : tm);
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
  const nLiq = idx.map((i) => { const m = mainOf(i); if (!T[i] || !m) return null; const h = heroSplit(m); return h[0] + h[1]; });
  const head = `<tr><td></td>${idx.map((i) => `<th scope="col"><button type="button" class="col${i === compare.active ? ' active' : ''}" data-offer="${i}" aria-pressed="${i === compare.active}">${esc(offerName(i))}</button></th>`).join('')}</tr>`;
  const row = (label, sub, cells, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</th>${cells.join('')}</tr>`;
  // cost including the risk: full cost (or interest left) plus the cost of the risk of that offer's own simulation
  const riskCell = (tm, sum, m) => {
    if (!tm || !sum) return cell(dash);
    if (!m || !m.riskCost) return cell(wait);
    const x = riskTotal(tm, sum, m.riskCost.value);
    return cell(esc(money0(round10(x.total), cur)), t('compare.perYearAbout', { rate: aprText(x.rate) }));
  };
  const sold = idx.map((i) => (T[i] ? cell(esc(money0(liquidationPrices(T[i]).atStart, cur)), `−${pct(dropToLiquidation(T[i]), 0)}`) : cell(Cm.fixTerms)));
  const marginRow = row(Cm.rowMargin, '', idx.map((i) => { const mp = T[i] && marginCallPrices(T[i]); if (!mp) return cell(dash); const r = lenderRules(T[i]); return cell(esc(money0(mp.atStart, cur)), r.behaviour === 'autoPartial' ? texts().results.tileMarginAuto : r.afterCure ? t('results.tileMarginHours', { hours: T[i].curePeriodHours }) : texts().results.tileMarginWarning); }), 'desk-only');
  const rateRow = row(F().rateAnnual.label, '', idx.map((i) => (!T[i] ? cell(dash) : T[i].rate.type === 'fixed' ? cell(esc(pct(T[i].rate.annual, 1)), t('ui.perYear'))
    : cell(esc(pct(T[i].rate.path[0].annual, 1)), texts().form.rateChanges))));
  let rows = ''; const notes = [];
  if (compare.kind === 'offers') {
    rows += row(Cm.rowLiq, '', idx.map((i) => cell(T[i] ? big(nLiq[i] ?? wait) : dash, T[i] ? t('compare.withinMonths', { months: T[i].durationMonths }) : '')));
    rows += row(Cm.rowSold, '', sold);
    rows += row(Cm.rowCost, '', idx.map((i) => { if (!T[i]) return cell(dash); const s = loanSummary(T[i]); return cell(esc(money0(s.totalCost, cur)), t('compare.perYear', { apr: aprText(s.effectiveApr) })); }));
    rows += row(Cm.rowRisk, '', idx.map((i) => riskCell(T[i], T[i] && loanSummary(T[i]), mainOf(i))));
    rows += row(Cm.rowReceive, '', idx.map((i) => cell(T[i] ? esc(money0(loanSummary(T[i]).amountReceived, cur)) : dash)));
    rows += marginRow; rows += rateRow;
    const ok = T.filter(Boolean);
    if (new Set(ok.map((x) => Math.round(x.loanAmount))).size > 1) notes.push(Cm.diffAmount);
    if (new Set(ok.map((x) => x.durationMonths)).size > 1) notes.push(Cm.diffMonths);
    lastCmp = { kind: 'offers', list: idx.map((i) => `${offerName(i)} ${nLiq[i] ?? wait}`).join(', ') };
  } else {
    const cur0 = T[0]; const span = cur0 ? cur0.durationMonths : null;
    const m1 = mainOf(1);
    const sameSpan = T[1] && m1 ? (span <= T[1].durationMonths ? Math.round(m1.cumulativeByMonth[span - 1] * 100) : nLiq[1]) : null;
    const m1Months = T[1] ? T[1].durationMonths : null; const shorter = T[1] && span && m1Months < span;
    rows += row(Cm.rowLiq, span ? t('compare.nextMonths', { months: span }) : '', [cell(T[0] ? big(nLiq[0] ?? wait) : dash), cell(T[1] ? big(sameSpan ?? wait) : dash, shorter ? t('compare.onlyMonths', { months: m1Months }) : '')]);
    rows += row(Cm.rowLiq, T[1] ? t('compare.wholeTerm', { months: m1Months }) : '', [cell(dash), cell(T[1] ? big(nLiq[1] ?? wait) : dash)]);
    rows += row(Cm.rowSold, '', sold);
    rows += marginRow; rows += rateRow;
    const refiForm1 = compare.active === 1 ? state : compare.offers[1];
    const s1 = T[1] ? loanSummary(withSwitching(T[1], switchCosts(refiForm1))) : null;
    const startCell = s1 && cur0 ? startText(s1, refiForm1, cur0.loanAmount, cur) : '';
    rows += row(Cm.rowReceiveNow, '', [cell(dash), cell(startCell ? esc(startCell[0].toUpperCase() + startCell.slice(1)) : dash)]);
    rows += row(Cm.rowCost, '', [cell(cur0 ? esc(money0(loanSummary(cur0).totalInterest, cur)) : dash, cur0 ? t('compare.interestLeft', { months: span }) : ''),
      cell(s1 ? esc(money0(s1.totalCost, cur)) : dash, s1 ? t('compare.inclSwitching', { months: m1Months, apr: aprText(s1.effectiveApr) }) : '')]);
    rows += row(Cm.rowRisk, '', [riskCell(cur0, cur0 && loanSummary(cur0), mainOf(0)), riskCell(T[1], s1, m1)]);
    if (shorter) notes.push(t('compare.shorterRefi', { m: m1Months, n: span }));
    if (T[1] && span && m1Months > span) notes.push(t('compare.longerRefi', { m: m1Months, n: span }));
    lastCmp = { kind: 'refi', months: span, a: nLiq[0] ?? wait, b: sameSpan ?? wait };
  }
  el.hidden = false;
  el.innerHTML = `<div class="label" id="cmp-label">${esc(compare.kind === 'refi' ? Cm.titleRefi : Cm.title)} · ${esc(Cm.sameFutures)}</div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="${esc(compare.kind === 'refi' ? Cm.titleRefi : Cm.title)}"><table class="cmp"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
    <p class="meta">${esc(Cm.noWinner)}${notes.length ? ` ${notes.map(esc).join(' ')}` : ''}</p>
    <p class="actions">${compare.kind === 'offers' && n < 3 ? `<button type="button" class="secondary" data-compare-add>${esc(Cm.addC)}</button>` : ''}
      <button type="button" class="link" data-compare-remove>${esc(t('compare.remove', { name: offerName(compare.active) }))}</button>
    </p>
    <p class="end-row"><span>${esc(Cm.endKeep)}</span>${idx.map((i) => `<button type="button" class="secondary" data-compare-keep="${i}">${esc(offerName(i))}</button>`).join('')}</p>`;
  $('#showing').hidden = false;
  $('#showing').textContent = t('compare.showing', { name: offerName(compare.active) });
}

// A partial sale at `price`: about how much BTC the lender sells (its fee included) and what is left.
function partialAt(tm, price) {
  const rules = lenderRules(tm); const btc = collateralBtc(tm);
  const sold = partialSaleBtc(rules, tm.loanAmount, btc, price);
  return { sold: num(sold, 4), left: num(btc - sold, 4), btc: num(btc, 4), target: pct(rules.target, 0) };
}

// An existing loan whose LTV today is already at or above its margin call
const pastMarginCall = (tm) => tm.mode === 'existing' && !!tm.marginCallLtv && tm.initialLtv >= tm.marginCallLtv;
// The yearly rate, also when it is beyond what the calculation resolves (absurd fees)
const aprText = (x) => (x >= 9.99 ? `> ${pct(10, 0)}` : pct(x, 1));

// Under "Full cost" / "Interest left": the same with the liquidation risk (ux/M-risk-cost-spec.md). It comes
// from the simulation, so it shows "…" until the result for exactly these terms has arrived.
// While a new result is being calculated, the previous line stays (dimmed with the whole answer), so nothing jumps.
let lastTileRisk = '';
function tileRiskLine(tm, s) {
  const R = texts().results; const r = lastRisk;
  let value = lastTileRisk || '…';
  if (r && r.main && r.main.riskCost && riskTerms === tm) {
    const x = riskTotal(tm, s, r.main.riskCost.value); const total = money0(round10(x.total), tm.currency);
    value = tm.mode === 'existing' ? t('results.tileRiskExisting', { total }) : t('results.tileRiskValue', { total, rate: aprText(x.rate) })
      .replace(/· (.+)$/, (_, r) => `· ${r.replace(/ /g, '\u00A0')}`); // "22.7% a year" stays on one line
    lastTileRisk = value;
  }
  return `<a class="s tile-risk" href="#risk-cost" data-open-risk>${esc(R.tileRiskLabel)}<br>${esc(value)}</a>`;
}

// Key figures under the answer. All of them need no simulation, so they follow typing at once.
function renderTiles(tm) {
  const R = texts().results; const cur = tm.currency;
  const { lp, mp, rules } = salePrices(tm);
  const s = loanSummary(costTerms(tm));
  const tile = (label, value, sub, cls = '', extra = '') => `<div class="tile${cls}" role="listitem"><div class="label">${esc(label)}</div><div class="v">${esc(value)}</div><div class="s">${esc(sub)}</div>${extra}</div>`;
  let html = tile(rules.liquidationSale === 'partial' ? R.tilePartSold : R.tileSold, money0(lp.atStart, cur), t('results.tileSoldSub', { drop: `−${pct(dropToLiquidation(tm), 0)}` }));
  const marginTile = mp ? tile(R.tileMargin, money0(mp.atStart, cur), rules.behaviour === 'autoPartial' ? R.tileMarginAuto : rules.afterCure ? t('results.tileMarginHours', { hours: tm.curePeriodHours }) : R.tileMarginWarning, ' desk-only') : '';
  const pastMargin = pastMarginCall(tm);
  $('#questions-title').textContent = t(tm.mode === 'existing' ? 'falls.questionsTitleExisting' : 'falls.questionsTitle', { n: texts().falls.questions.length });
  $('#now-note').hidden = !pastMargin;
  $('#now-note').textContent = pastMargin ? t('results.nowAboveMargin', { ltv: pct(tm.initialLtv, 0), mc: pct(tm.marginCallLtv, 0) }) : '';
  if (tm.mode === 'existing') {
    html += tile(R.tileInterest, money0(s.totalInterest, cur), R.tileInterestSub, '', tileRiskLine(tm, s));
    html += !mp ? '' : pastMargin ? tile(R.tileMargin, money0(mp.atStart, cur), R.tileMarginNow) : marginTile.replace(' desk-only', '');
  } else {
    html += marginTile;
    html += tile(R.tileCost, money0(s.totalCost, cur), t('results.tileCostSub', { apr: aprText(s.effectiveApr) }), '', tileRiskLine(tm, s));
    const rise = tm.purpose === 'buy' ? (({ received, payback }) => payback / received - 1)(buyMoney(tm)) : breakevenReturn(costTerms(tm), { taxRateNow: tm.taxRateNow, taxRateAtMaturity: tm.taxRateAtMaturity });
    html += tile(tm.purpose === 'buy' ? R.tileBreakevenBuy : R.tileBreakeven, t('results.tileBreakevenValue', { rise: signedPct(rise, 0) }), R.tileBreakevenSub);
  }
  $('#tiles').innerHTML = html;
  // what a sale leaves you with: "liquidated" does not mean "everything lost"
  if (rules.liquidationSale === 'all') {
    const lq = costIfLiquidated(tm, { price: lp.atStart, debt: tm.loanAmount });
    $('#sold-line').textContent = lq.btcReturned < 0.00005 ? t('results.soldNothing', { btc: num(collateralBtc(tm), 4) })
      : t('results.soldGetBack', { back: num(lq.btcReturned, 4), btc: num(collateralBtc(tm), 4) });
  } else $('#sold-line').textContent = t('results.soldPartial', partialAt(tm, lp.atStart));
}

// The key terms in one line (phones, while the form is folded away).
function renderTermsChips(tm) {
  const f = F(); const cur = tm.currency;
  const parts = [money0(tm.loanAmount, cur), `LTV ${pct(tm.initialLtv, 0)}`, `${f.liquidationLtv.label} ${pct(tm.liquidationLtv, 0)}`,
    `${tm.durationMonths} ${t(tm.durationMonths === 1 ? 'ui.month' : 'ui.months')}`, tm.rate.type === 'fixed' ? `${pct(tm.rate.annual, 1)} ${t('ui.perYear')}` : f.rateAnnual.label];
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
  const past = pastMarginCall(tm);
  const ladder = [[Fa.ladderToday, tm.btcPrice, 'today'], ...(mp && !past ? [[Fa.ladderMargin, mp.atStart, 'margin']] : []), [Fa.ladderSale, lp.atStart, 'sale']];
  const span = Math.max(0.3, 1 - lp.atStart / tm.btcPrice) * 1.15;
  const pos = (p) => 90 - ((1 - p / tm.btcPrice) / span) * 80;
  // dots on the line; the labels are placed by layoutLadder() so they never overlap
  let html = `<div class="ladder" role="img" aria-label="${esc(ladder.map(([l, p]) => `${l} ${money0(p, cur)}`).join(', '))}"><div class="ln"></div>${ladder.map(([, p, k]) => `<i class="dot dot-${k}" style="left:${pos(p)}%"></i>`).join('')}${ladder.map(([l, p, k]) => `<div class="lab lab-${k}" data-at="${pos(p)}">${esc(l)}<br><b>${esc(money0(p, cur))}</b>${k === 'today' ? '' : `<br>−${esc(pct(1 - p / tm.btcPrice, 0))}`}</div>`).join('')}</div>`;
  if (mp && past) {
    const top = topUpToCure(tm, { price: tm.btcPrice, debt: tm.loanAmount, targetLtv: target });
    html += `<p>${esc(t('falls.marginNow', { topUp: num(top.btc, 4), topUpValue: money0(top.value, cur), repay: money0(top.repayInstead, cur), target: pct(target, 0) }))}</p>`;
  } else if (mp) {
    const top = topUpToCure(tm, { price: mp.atStart, debt: tm.loanAmount, targetLtv: target });
    const vals = { mcPrice: money0(mp.atStart, cur), topUp: num(top.btc, 4), topUpValue: money0(top.value, cur), repay: money0(top.repayInstead, cur), target: pct(target, 0), hours: tm.curePeriodHours };
    if (rules.behaviour === 'autoPartial') html += `<p>${esc(t('falls.marginAuto', { ...vals, ...partialAt(tm, mp.atStart) }))}</p>`;
    else if (rules.afterCure) html += `<p>${esc(t('falls.marginCure', { ...vals, what: rules.cureSale === 'partial' ? t('falls.whatPartial', partialAt(tm, mp.atStart)) : t('falls.whatAll') }))}</p>`;
    else html += `<p>${esc(t('falls.marginWarning', vals))}</p>`;
  }
  if (rules.liquidationSale === 'partial') html += `<p>${esc(t('falls.liquidationPartial', { price: money0(lp.atStart, cur), ...partialAt(tm, lp.atStart) }))}</p>`;
  else {
    const lq = costIfLiquidated(tm, { price: lp.atStart, debt: tm.loanAmount });
    html += `<p>${esc(t('falls.liquidationAll', { price: money0(lp.atStart, cur), sold: num(lq.btcSold, 4), returned: num(lq.btcReturned, 4), returnedValue: money0(lq.valueReturned, cur) }))}</p>`;
  }
  $('#falls-text').innerHTML = html;
  layoutLadder();
}

// Price ladder labels: each sits centred under its dot, kept inside the box. When two would touch,
// the later one moves above the line (if there is room there), otherwise it is pushed aside.
// Measured, so it works for any prices, languages and widths; redone when the section opens or the width changes.
function layoutLadder() {
  const el = $('#falls-text .ladder'); if (!el || !el.clientWidth) return;
  const W = el.clientWidth; const gap = 8; const right = [-Infinity, -Infinity]; // right edge of the last label per row (0 below, 1 above)
  const labs = [...el.querySelectorAll('.lab')].sort((a, b) => a.dataset.at - b.dataset.at);
  for (const lab of labs) {
    const w = lab.offsetWidth;
    let left = Math.min(Math.max((lab.dataset.at / 100) * W - w / 2, 0), W - w);
    let row = 0;
    if (left < right[0] + gap) {
      if (left >= right[1] + gap) row = 1;
      else left = Math.min(right[0] + gap, W - w);
    }
    lab.style.left = `${left}px`; lab.classList.toggle('up', row === 1);
    right[row] = left + w;
  }
  el.classList.toggle('two-rows', labs.some((l) => l.classList.contains('up')));
}
window.addEventListener('resize', layoutLadder);

// How much BTC must rise for borrowing to beat selling today; with a higher tax today, it may even fall
function breakevenLine(ct, tm) {
  const rise = breakevenReturn(ct, { taxRateNow: tm.taxRateNow, taxRateAtMaturity: tm.taxRateAtMaturity });
  return rise < 0 ? t('cost.breakevenFall', { fall: pct(-rise, 1) }) : t('cost.breakeven', { rise: pct(rise, 1) });
}
function renderCost() {
  const tm = lastTerms; const cur = tm.currency; const C = texts().cost;
  const ct = costTerms(tm); const s = loanSummary(ct);
  const existing = tm.mode === 'existing';
  const owed = state.refi ? toTerms(formOf(0)).terms.loanAmount : 0;
  const rows = s.schedule.map((r) => `<tr><td>${r.month}</td><td>${esc(isoDate(r.date))}</td><td>${money(r.interest, cur)}</td><td>${money(r.principal, cur)}</td><td>${money(r.payment, cur)}</td><td>${money(r.balanceAfter, cur)}</td></tr>`).join('');
  let html = `<p>${esc(existing ? t('cost.lineExisting', { payback: money(s.totalPayback, cur), interest: money(s.totalInterest, cur) })
    : state.refi ? t('cost.lineRefi', { amount: money(tm.loanAmount, cur), owed: money(owed, cur), now: startText(s, state, owed, cur, money), payback: money(s.totalPayback, cur), cost: money(s.totalCost, cur), apr: aprText(s.effectiveApr) })
    : t('cost.line', { received: money(s.amountReceived, cur), payback: money(s.totalPayback, cur), cost: money(s.totalCost, cur), apr: aprText(s.effectiveApr) }))}</p>
    ${existing ? '' : `<p class="hint">${esc(C.timingNote)}</p>`}
    <details class="table-details" data-remember="plan"${openDetails.has('plan') ? ' open' : ''}><summary>${esc(C.schedule)}</summary><div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t('ui.showTable'))}"><table><thead><tr>${C.scheduleHead.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
  html += '<div id="risk-cost" class="risk-cost"></div>'; // filled from the simulation (renderRiskCost)
  if (tm.purpose !== 'buy') {
    html += `<h4>${esc(texts().sections.borrowOrSell)}</h4><p>${esc(state.refi ? C.sellIntroRefi : existing ? C.sellIntroExisting : C.sellIntro)}</p>
      <p class="big-line" id="breakeven-line">${esc(breakevenLine(ct, tm))}</p>
      <div class="pair tax">${numField('taxRateNow', C.taxNow, '%')}${numField('taxRateAtMaturity', C.taxLater, '%')}</div><p class="hint">${esc(C.taxNote)}</p>`;
  } else {
    html += '<div id="leverage"></div>';
  }
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
  if (active === 'taxRateNow' || active === 'taxRateAtMaturity') { // don't rebuild the field being typed in
    const bl = $('#breakeven-line'); if (bl) bl.textContent = breakevenLine(ct, tm);
    return;
  }
  $('#cost-body').innerHTML = html;
  $('#sec-cost-title').textContent = `${texts().sections.cost} · ${tm.purpose === 'buy' ? texts().sections.leverage : texts().sections.borrowOrSell}`;
  if (tm.purpose === 'buy') renderLeverage();
  renderRiskCost();
}

// "Cost including the risk" (ux/M-risk-cost-spec.md): the full cost plus the cost of the risk, an
// option price from the simulation, so it follows the last calculation (like the other simulated numbers)
const round10 = (x) => Math.round(x / 10) * 10;
function riskTotal(tm, sum, riskValue) {
  const years = tm.durationMonths / 12;
  if (tm.mode === 'existing') return { total: sum.totalInterest + riskValue, rate: (sum.totalInterest + riskValue) / tm.loanAmount / years };
  return { total: sum.totalCost + riskValue, rate: sum.effectiveApr + riskValue / tm.loanAmount / years };
}
function renderRiskCost() {
  const el = $('#risk-cost'); if (!el) return;
  const r = lastRisk; const tm = riskTerms;
  if (!r || !r.main || !r.main.riskCost || !tm) { el.innerHTML = ''; return; }
  const C = texts().cost; const cur = tm.currency;
  const s = loanSummary(costTerms(tm)); const rc = r.main.riskCost;
  const { total, rate } = riskTotal(tm, s, rc.value);
  // the futures without a sale are those not counted in the answer: 100 minus its number, so the two add up
  // to 100 (each rounded on its own gave 54 and 47 for the example: 53.5 and 46.5)
  const line = tm.mode === 'existing'
    ? t('cost.riskLineExisting', { total: money0(round10(total), cur), months: tm.durationMonths, interest: money(s.totalInterest, cur) }) // as in the line above it (€999.96, not €1,000)
    : t('cost.riskLine', { total: money0(round10(total), cur), rate: aprText(rate), apr: aprText(s.effectiveApr) });
  el.innerHTML = `<h4 tabindex="-1">${esc(C.riskTitle)}</h4><p class="big-line">${esc(line)}</p>
    <p>${esc(t('cost.riskPart', { risk: money0(round10(rc.value), cur) }))}</p>
    <p class="hint">${esc(t('cost.riskNotFee', { none: 100 - shown(pSale(r.main)) }))} ${esc(C.riskCompare)}</p>
    <p class="hint"><a href="${pageHref('method/')}#risk-cost">${esc(C.riskLink)}</a></p>`;
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
function splitToN(parts, n) { // rounds shares of a whole so they add up to exactly n
  const sum = parts.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const raw = parts.map((p) => (Math.max(0, p) / sum) * n); const fl = raw.map(Math.floor);
  let rest = n - fl.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return fl;
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
  if (tm === lastTerms) renderTiles(tm); // the tile line with the liquidation risk needs this result
  const R = texts().results; const cur = tm.currency; const months = tm.durationMonths;
  const m = r.main;
  const [nLiq, nPart, nMargin, nNone] = heroSplit(m);
  // with partial sales, the big number counts every forced sale (a big 0 next to 68 partial sales misled: UAT finding 1)
  const nAny = nLiq + nPart;
  const rest = nPart > 0 ? t(tm.mode === 'existing' ? 'results.heroAnyExisting' : 'results.heroAny', { full: nLiq, months })
    : t(tm.mode === 'existing' ? 'results.heroLiqExisting' : 'results.heroLiq', { months });
  const headline = `${nAny} ${R.heroOf} ${rest}`;
  $('#headline-text').innerHTML = `<em class="hero-n">${nAny}</em> <span class="of">${esc(R.heroOf)}</span> <span class="sentence">${esc(rest)}</span>`;
  if (barNow !== null && barNow !== nAny) barWas = barNow;
  barNow = nAny;
  headlineShown = { p: pSale(m), n: nAny };
  // until the options are computed, the line keeps its last text (dimmed) instead of disappearing and coming back
  if (r.levers) $('#best-lever').textContent = bestLeverText(r);
  $('#best-lever').classList.toggle('pending', !r.levers);
  $('#dots').innerHTML = dotsHtml([[nLiq, 'd-liq'], [nPart, 'd-part'], [nMargin, 'd-margin'], [nNone, 'd-none']], headline)
    + legendHtml([[nLiq, 'd-liq', R.legendLiquidated], [nPart, 'd-part', R.legendPartial], [nMargin, 'd-margin', R.legendMargin], [nNone, 'd-none', R.legendNothing]]);
  $('#kept-line').textContent = m.keptAfterSale && m.pPartial >= 0.005 ? t('results.kept', { kept: pct(m.keptAfterSale.q50, 0) }) : '';
  const lastHour = META.prices[cur].to;
  $('#basis-line').textContent = t('results.basis');
  // the assumption behind the number, and the two other methods next to it (fairness: the
  // simulation is the most cautious; the real history and the volatility model are shown with it)
  const rules = lenderRules(tm);
  $('#assume-line').textContent = !rules.afterCure ? '' : tm.reserveAmount > 0 ? t('results.assumeReserve', { reserve: money0(tm.reserveAmount, cur) }) : texts().results.assumeNoTopUp;
  // "the simulation is the most cautious" only where it is true for this loan
  const h = of100(r.replay.liquidatedShare + r.replay.partialShare); const g = of100(pSale(r.garchMc)); const n = shown(pSale(m));
  const hasHistory = r.replay.starts > 0; // none for a loan longer than the real prices allow
  $('#methods-line').textContent = `${hasHistory ? t('results.otherMethods', { h, g }) : t('results.otherMethodNoHistory', { g })}${n >= g && (!hasHistory || n >= h) ? R.mostCautious : ''} · `;
  // the whole period the results are based on, and when the stored data was last updated
  $('#data-period').textContent = t('ui.dataThrough', { from: date(META.prices[cur].from), to: date(lastHour), updated: date(META.dataUpdated || META.prices[cur].to) });
  renderSafer(); renderTrend(); renderCompare(); updateAnswerBar();
  if (tm.purpose === 'buy') renderLeverage();
  renderRiskCost();
  $('#history-text').innerHTML = historyText();
  $('#falls-month').textContent = fallsMonthText();
  renderFallHook(r, tm);
  if ($('#sec-falls').open) renderFutures();
  if ($('#sec-history').open) renderStories();
}

// One line under the answer that links the visitor's sale price with what happened since 2014:
// how fast BTC fell this far at its fastest (the "how often" is already the real-history number).
function renderFallHook(r, tm) {
  const el = $('#fall-hook'); const f = r.fastestFall;
  if (!f) { el.hidden = true; return; }
  const H = texts().results;
  const time = f.hours === null ? '' : f.hours === 1 ? H.hookHour : f.hours < 48 ? t('results.hookHours', { n: f.hours }) : t('results.hookDays', { n: Math.round(f.hours / 24) });
  const line = f.hours === null ? t('results.hookNever', { drop: `−${pct(f.drop, 0)}`, worst: `−${pct(f.worst, 0)}` }) : t('results.hookFastest', { drop: `−${pct(f.drop, 0)}`, time });
  el.innerHTML = `${esc(line)} <a href="${pageHref('insights/')}#buffer">${esc(H.hookLink)} →</a>`;
  el.hidden = false;
}

// The visitor's own number is shown exactly as in the headline (which rounds so the dots add up to 100).
let headlineShown = null;
const shown = (p) => (headlineShown && p === headlineShown.p ? headlineShown.n : of100(p));
const leverLabel = (l, tm) => t(`results.levers.${tm.mode === 'existing' && ['lowerLtv', 'shorter'].includes(l.id) ? `${l.id}Existing` : l.id}`, {
  value: l.id === 'reserve' ? money0(l.value, tm.currency) : l.id === 'shorter' ? l.value : l.value !== null ? pct(l.value, 0) : '', months: tm.durationMonths,
});
// Under the answer: the one change from "Make it safer" that lowers the number most
function bestLeverText(r) {
  const best = bestLever(r.levers, shown(pSale(r.main)), shown);
  if (!best) return '';
  return t('results.bestLever', { lever: leverLabel(best, riskTerms), p: shown(best.p) });
}

function holdWhileComputing(el) {
  if (!el.children.length) { el.innerHTML = `<p class="progress">${esc(texts().ui.computingShort)}</p>`; return; } // nothing to keep yet
  el.classList.add('pending'); el.inert = true; // still visible, not clickable until the new values arrive
}

function renderSafer() {
  const r = lastRisk; const tm = riskTerms; const R = texts().results;
  const el = $('#safer-body');
  // while the options are recalculated, the previous ones stay in place, dimmed and inactive, so the page
  // below does not jump up and down (they used to shrink to one line "Calculating…" for a moment)
  if (!r.slider) { holdWhileComputing(el); return; }
  el.classList.remove('pending'); el.inert = false;
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
  el.innerHTML = `${state.refi ? `<p class="hint">${esc(R.sliderRefi)}</p>` : ''}<div class="slider"${state.refi ? ' hidden' : ''}><label for="ltv-slider" id="slider-line">${esc(line(idx))}</label>
    <input id="ltv-slider" type="range" min="0" max="1000" step="1" value="${posOf(grid[idx].ltv)}" style="--fill:${posOf(grid[idx].ltv) / 10}%">
    <div class="ticks" aria-hidden="true">${tickLtvs.map((x) => `<span style="--at:${posOf(x) / 1000}">${pct(x, 0)}</span>`).join('')}</div>
    <p class="hint">${esc(tm.mode === 'existing' ? R.sliderExisting : R.sliderNote)}</p></div>
    <p class="sub">${esc(R.otherOptions)}</p>
    <div class="levers">${row(R.yourTerms, r.leverBase, true)}${levers.map((l) => row(label(l), l.p)).join('')}</div>
    ${higher && Math.abs(higher.p - r.leverBase) < 0.05 ? `<p class="hint">${esc(R.higherLiqNote)}</p>` : ''}`;
  const slider = $('#ltv-slider');
  if (refocusSlider) { refocusSlider = false; slider.focus({ preventScroll: true }); }
  const snap = () => { const i = nearest(Number(slider.value)); slider.value = posOf(grid[i].ltv); slider.style.setProperty('--fill', `${posOf(grid[i].ltv) / 10}%`); return i; };
  slider.setAttribute('aria-valuetext', line(idx));
  // arrow keys jump to the next computed point (the native step of 1 in 1000 would snap back)
  // the arrow keys set the value themselves, so the browser sends no "change": take the new LTV once
  // the visitor pauses, and give the rebuilt slider the focus back
  let keyTimer = 0;
  slider.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = Math.min(grid.length - 1, Math.max(0, nearest(Number(slider.value)) + d));
    slider.value = posOf(grid[i].ltv);
    slider.dispatchEvent(new Event('input'));
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => slider.dispatchEvent(new Event('change')), 600);
  });
  // While dragging, only the line and the fill follow the nearest point; the slider's own value is not
  // touched. Safari (every browser on an iPhone) counts a value set by the page as the new starting
  // point and then sends no "change" when the finger or mouse lets go, so nothing was recalculated.
  slider.addEventListener('input', () => {
    const i = nearest(Number(slider.value));
    slider.style.setProperty('--fill', `${posOf(grid[i].ltv) / 10}%`);
    $('#slider-line').textContent = line(i); slider.setAttribute('aria-valuetext', line(i));
  });
  slider.addEventListener('change', () => {
    if (state.refi) return; // the BTC of a refinancing offer follows from "What changes?"
    const g = grid[snap()];
    if (Math.abs(g.ltv - toTerms(state, { base: activeBase() }).terms.initialLtv) < 1e-9) return; // no change
    // Undo goes back to the terms from before the first slider move (also after several moves)
    if (!undoState) undoState = structuredClone(state);
    sliderChanging = true; refocusSlider = document.activeElement === slider; // a keyboard user stays on the slider
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
  if (!r || !r.trends) { holdWhileComputing(el); return; }
  el.classList.remove('pending'); el.inert = false;
  const H = texts().history;
  const top = r.trends.at(-1);
  el.innerHTML = `<p class="hint">${rich(H.trendIntro)}</p><div class="levers">${trendRows(r, (x) => x.p, H.trendUnit)}</div>
    <p>${esc(t('history.trendConclusion', { top: shown(top.p), topTrend: signedPct(top.trend) }))}</p>`;
}
function renderLeverage() {
  const r = lastRisk; const tm = riskTerms || lastTerms; const C = texts().cost; const el = $('#leverage');
  if (!el) return;
  const s = loanSummary(tm); const cur = tm.currency; const bm = buyMoney(tm);
  const bought = bm.received / tm.btcPrice; const c0 = collateralBtc(tm);
  let html = `<h4>${esc(texts().sections.leverage)}</h4><p>${esc(t(bm.refi ? 'cost.levIntroRefi' : 'cost.levIntro', { received: money0(bm.received, cur), bought: num(bought, 4) }))}</p>`;
  if (r && r.main && r.main.leverage) {
    const L = r.main.leverage;
    // "liquidated" is the same count as in the dots under the answer (rounded once, there); more and less
    // share the rest (rounded on their own, it once said 53 here and 54 there)
    const liq = heroSplit(r.main)[0]; // L.liquidated is the same share as r.main.pLiquidation (the same futures)
    const [more, lessKept] = splitToN([L.more, L.lessKept], 100 - liq);
    const sentence = t(bm.refi ? 'cost.levHeadlineRefi' : 'cost.levHeadline', { more, less: lessKept + liq, liq });
    html += `<p class="big-line">${esc(sentence)}</p>${dotsHtml([[more, 'd-good'], [lessKept, 'd-none'], [liq, 'd-liq']], sentence)}
      ${legendHtml([[more, 'd-good', C.levLegendMore], [lessKept, 'd-none', C.levLegendLess], [liq, 'd-liq', C.levLegendLiq]])}`;
    if (L.middleDiff) {
      const sz = (x) => (x === null ? '–' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${num(Math.abs(x), 4)} BTC`);
      html += `<p class="sub" id="lev-sizes">${esc(t(bm.refi ? 'cost.levSizesRefi' : 'cost.levSizes', { more: sz(L.middleDiff.more), less: sz(L.middleDiff.lessKept), liq: sz(L.middleDiff.liquidated) }))}</p>`;
    }
    if (r.trends && r.trends[0].more !== null) html += `<h4>${esc(C.levTrendTitle)}</h4><div class="levers">${trendRows(r, (x) => x.more, C.levTrendUnit)}</div>`;
  }
  if (!bm.refi && lenderRules(tm).liquidationSale === 'all') { // (a refinancing: compared with no extra cash, not with no loan)
    const lq = costIfLiquidated(tm, { price: liquidationPrices(tm).atStart, debt: tm.loanAmount });
    html += `<p>${esc(t('cost.levLiquidated', { end: num(lq.btcReturned + bought, 4), start: num(c0, 4) }))}</p>`;
  }
  html += `<p>${esc(t('cost.levBreakeven', { rise: pct(bm.payback / bm.received - 1, 1) }))}</p>`;
  if (tm.repayWith === 'cash') html += `<p>${esc(t('cost.levCash', { payback: money0(s.totalPayback, cur) }))}</p>`;
  el.innerHTML = html;
}

// Real history first, then one sentence that connects it with the answer at the top
function historyText() {
  const r = lastRisk; const rp = r.replay;
  const partial = rp.partialShare >= 0.005 ? t('history.replayPartial', { m: of100(rp.partialShare) }) : '';
  const h = of100(rp.liquidatedShare); const n = shown(pSale(r.main)); const hAny = of100(rp.liquidatedShare + rp.partialShare);
  if (!rp.starts) return `<p>${esc(texts().history.replayNone)}</p>`;
  let html = `<p class="big-line">${esc(t('history.replay', { n: h, partial }))}</p>`;
  if (rp.starts < 4 * 365) html += `<p>${esc(t('history.replayFew', { last: date(rp.lastStart) }))}</p>`; // fewer than 4 years of start days
  if (hAny !== n) html += `<p>${esc(t(hAny < n ? 'history.bridgeLower' : 'history.bridgeOther', { n }))}</p>`;
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
  if (!r || !r.main.samplePool) { // the instant example has no sample futures: they arrive with the full calculation
    $('#futures-chart').innerHTML = `<p class="progress">${esc(texts().ui.computingShort)}</p>`;
    return;
  }
  // together the 100 futures have exactly the answer's number of forced sales
  const Fa = texts().falls; const paths = pickFutures(r.main.samplePool, shown(pSale(r.main)));
  const sets = Math.max(1, Math.floor(paths.length / 20)); const set = pathSet % sets;
  const inSet = paths.slice(set * 20, set * 20 + 20);
  $('#other-paths').textContent = t('falls.showOthers', { n: ((set + 1) % sets) + 1, sets });
  $('#futures-line').textContent = `${t('falls.futuresLine', { k: inSet.filter((p) => p.event).length })} ${t('falls.futuresPicked', { n: paths.filter((p) => p.event).length })}`;
  futuresChart($('#futures-chart'), {
    ...chartCommon(), paths: inSet,
    labels: { title: Fa.futuresTitle, margin: Fa.ladderMargin, sale: Fa.ladderSale, tip: (mo, sold) => `${mo === 0 ? t('ui.today') : t('ui.monthN', { n: mo })}: ${sold} / 20 ✕` },
  });
  $('#futures-note').hidden = !inSet.some((p) => p.event && p.event.kind !== 'liquidationLtv');
}
function renderStories() {
  const r = lastRisk; if (!r || !r.stories) return;
  const tm = riskTerms; const H = texts().history;
  const names = r.stories.map((s) => isoDate(s.start));
  if (!r.stories.length) { storiesChart($('#stories-chart'), { stories: [] }); $('#stories-legend').innerHTML = `<li>${esc(H.storiesNone)}</li>`; return; }
  storiesChart($('#stories-chart'), { ...chartCommon(), stories: r.stories, s0: tm.btcPrice, colors: STORY_COLORS, labels: { title: H.storiesTitle, names, margin: texts().falls.ladderMargin, sale: texts().falls.ladderSale } });
  $('#stories-legend').innerHTML = r.stories.map((s, j) => {
    const d = isoDate(s.start);
    const text = !s.sale ? t('history.survived', { date: d, end: num(s.endRel, 1) })
      : s.sale.reason === 'partial' ? t('history.partial', { date: d, days: s.sale.day, left: pct(s.btcLeft, 0) })
        : t('history.sold', { date: d, days: s.sale.day, end: num(s.endRel, 1) });
    return `<li><i style="background:${STORY_COLORS[j]}"></i>${esc(text)}</li>`;
  }).join('');
}
// ------------------------------------------------------------------ static parts
function renderStatic() {
  const tx = texts();
  document.title = tx.meta.title;
  renderShell();
  $('#code-link').href = SITE.codeUrl;
  $('#method-link').href = pageHref('method/');
  $('#basis-line').textContent = t('results.basis');
  const cur0 = state.currency;
  if (META.prices[cur0]) $('#data-period').textContent = t('ui.dataThrough', { from: date(META.prices[cur0].from), to: date(META.prices[cur0].to), updated: date(META.dataUpdated || META.prices[cur0].to) });
  $('#share-btn').textContent = tx.ui.share;
  $('#terms-toggle').textContent = t(termsOpen ? 'form.closeTerms' : 'form.editTerms');
  $('meta[name="description"]').setAttribute('content', tx.meta.description);
  $('#limits').innerHTML = tx.results.limits.map((x) => `<li>${esc(x)}</li>`).join('');
  // each "?" says what it explains ("More" alone told a screen reader nothing: UAT finding 8)
  $('#answer button.q').setAttribute('aria-label', tx.ui.moreNumber);
  $('#sec-falls button.q').setAttribute('aria-label', `${tx.ui.more}: ${tx.falls.futuresTitle}`);
  $('#headline-help').innerHTML = rich(tx.results.headlineHelp);
  $('#futures-help').innerHTML = rich(tx.falls.futuresHelp);
  $('#questions').innerHTML = tx.falls.questions.map((x) => `<li>${esc(x)}</li>`).join('');
  $('#questions-title').textContent = t(state.mode === 'existing' ? 'falls.questionsTitleExisting' : 'falls.questionsTitle', { n: tx.falls.questions.length });
  // the embedded history is maintained by the weekly update; warn if it has not run for 45 days
  const oldest = Math.min(...Object.values(META.prices).map((m) => m.to));
  $('#data-old').hidden = !dataAge(oldest).stale;
  $('#data-old').textContent = t('ui.dataOld', { date: date(oldest) });
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
initShell({ getTerms: () => lastTerms, built: META.built, onLang: () => renderAll() });
document.addEventListener('input', onInput);
$('#form').addEventListener('submit', (e) => e.preventDefault()); // Enter in a field must not reload the page
document.addEventListener('click', onClick);
document.addEventListener('toggle', onToggle, true);
// "Start over and forget my inputs": deletes everything stored in this browser, ends a comparison,
// and shows the example again (with the live price, not a price typed in before)
$('#forget-btn').addEventListener('click', () => {
  try { for (const st of [localStorage, sessionStorage]) st.removeItem(STORE_KEY); localStorage.removeItem('btc-loan-risk:lang'); } catch { /* ignore */ }
  remember = false; try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
  setTheme(null); // back to the device's light or dark setting
  const typedPrice = state.priceManual;
  compare = null; undoState = null; lastRisk = null; barNow = null; barWas = null;
  state = { ...EXAMPLE_FORM, currency: state.currency, btcPrice: state.btcPrice, priceManual: false };
  $('#shared-note').hidden = true; $('#slider-undo').hidden = true;
  setTermsOpen(false);
  renderAll(); showEmbeddedExample();
  if (typedPrice) loadPrice(true);
  $('#forgotten').hidden = false;
});
if (state.priceManual && numOr(state.btcPrice, null) !== null) priceInfo = { source: 'manual' };
renderAll();
showEmbeddedExample();
// a share link that could not be read (or only in part): say so instead of silently showing something else (UAT finding 9)
if (/^#s=/.test(location.hash) && (!linkData || linkData.incomplete)) { $('#link-note').textContent = t(linkData ? 'results.linkPartly' : 'results.linkBroken'); $('#link-note').hidden = false; }
$('#top').classList.remove('boot'); // drawn: show it (until now invisible, so nothing jumps on slow phones: UAT finding 3)
// is the answer's number on screen? (decides whether the answer bar is needed)
if (window.visualViewport) window.visualViewport.addEventListener('resize', updateAnswerBar);
document.addEventListener('focusin', updateAnswerBar); document.addEventListener('focusout', () => setTimeout(updateAnswerBar, 0));
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { answerInView = e.isIntersecting; updateAnswerBar(); }).observe($('#headline-text'));
}
domReady.then(() => { if (!workers.length && !useInline) makeWorker(); });
const waitMax = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
// wait for the live price (at most 4 s)
waitMax(loadPrice(false), 4000).then(() => { started = true; update(); });
