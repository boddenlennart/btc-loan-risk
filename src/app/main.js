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
import { encodeState, decodeState } from './share.js';
import { feedbackText, mailtoLink } from './feedback.js';
import { dataAge } from '../data/candles.js';

const META = JSON.parse(document.getElementById('meta').textContent);
const STORE_KEY = 'btc-loan-risk:form';
const $ = (sel, root = document) => root.querySelector(sel);
const today = () => new Date().toISOString().slice(0, 10);
const PRESETS = { bear: -30, none: 0, moderate: 20, bull: 50, run: 100 };
const STORY_COLORS = ['var(--story-1)', 'var(--story-2)', 'var(--story-3)', 'var(--story-4)'];
const SOURCE_NAMES = { coinbase: 'Coinbase', kraken: 'Kraken', binance: 'Binance', coingecko: 'CoinGecko', embedded: '' };
const MAIN_FIELDS = ['loanAmount', 'initialLtv', 'liquidationLtv', 'durationMonths', 'rateAnnual'];

// ------------------------------------------------------------------ state
let state = loadState();
let priceInfo = null; // { source, time, stale } | { source: 'manual' }
const feedback = { use: '', meaning: '', useful: 0, easy: 0, missing: '', attach: false };
let lastTerms = null; let lastSettings = null; let lastRisk = null; let timer = null; let started = false;
// the terms and settings the current risk results were calculated for (charts must use these, not newer inputs)
let riskTerms = null; let riskSettings = null; const pending = {};
let showOtherPaths = false;

function loadState() {
  const fromLink = decodeState(location.hash);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { /* storage blocked */ }
  const s = { ...EXAMPLE_FORM, ...(saved && saved.state), ...(fromLink || {}) };
  if (fromLink) s.priceManual = false;
  if (!META.prices[s.currency]) s.currency = Object.keys(META.prices)[0];
  return s;
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ state })); } catch { /* ignore */ }
}

const numOr = (v, d = NaN) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
const pctOrNull = (v) => { const n = numOr(v, null); return n === null ? null : n / 100; };

/** Form state -> engine terms (fractions) and simulation settings. */
function toTerms(s) {
  const price = numOr(s.btcPrice);
  const existing = s.mode === 'existing';
  const amount = numOr(s.loanAmount);
  const byBtc = existing || s.ltvInput === 'btc';
  const collateralInput = numOr(s.collateralBtc);
  const fee = s.originationFee;
  const terms = {
    mode: s.mode, ltvInput: s.ltvInput, collateralInput,
    currency: s.currency, btcPrice: price, loanAmount: amount, startDate: existing ? today() : (s.startDate || today()),
    durationMonths: numOr(s.durationMonths),
    initialLtv: byBtc ? amount / (collateralInput * price) : numOr(s.initialLtv) / 100,
    marginCallLtv: pctOrNull(s.marginCallLtv),
    liquidationLtv: numOr(s.liquidationLtv) / 100,
    rate: s.rateType === 'variable'
      ? { type: 'variable', path: s.ratePath.map((r) => ({ fromMonth: numOr(r.fromMonth), annual: numOr(r.rate) / 100 })) }
      : { type: 'fixed', annual: numOr(s.rateAnnual) / 100 },
    repayment: s.repayment, compounding: s.repayment === 'bullet' ? s.compounding : 'none', dayCount: s.dayCount,
    originationFee: existing ? { type: 'percent', value: 0 } : { type: fee.type, value: fee.type === 'percent' ? numOr(fee.value) / 100 : numOr(fee.value) },
    liquidationFee: { value: numOr(s.liquidationFee) / 100, basis: s.liquidationFeeBasis },
    earlyRepaymentFee: 0,
    curePeriodHours: numOr(s.curePeriodHours, 0), marginCallConsequence: s.marginCallConsequence, liquidationSale: s.liquidationSale,
    cureTargetLtv: pctOrNull(s.cureTargetLtv) ?? (existing ? 0.5 : null), reserveAmount: numOr(s.reserveAmount, 0),
    taxRateNow: (pctOrNull(s.taxRateNow) ?? 0), taxRateAtMaturity: (pctOrNull(s.taxRateAtMaturity) ?? 0),
    purpose: s.purpose, repayWith: s.repayWith,
  };
  const settings = {
    nPaths: Number(s.simPaths) || 10000,
    blockDays: Math.max(1, Math.round(numOr(s.bootstrapBlockDays, 30))),
    trend: numOr(s.outlook, 0) / 100,
  };
  return { terms, settings };
}

// ------------------------------------------------------------------ small HTML helpers
const F = () => texts().form.fields;
const helpBtn = (id, label) => `<button type="button" class="q" aria-expanded="false" aria-controls="help-${id}" aria-label="${esc(t('ui.more'))}: ${esc(label)}">?</button>`;
const helpBox = (id, text) => `<div class="help" id="help-${id}" hidden>${rich(text)}</div>`;
function numField(key, label, unit, { help, hint, step = 'any', id = key } = {}) {
  return `<div class="field" data-field="${id}">
    <div class="label-row"><label for="f-${id}">${esc(label)}</label>${help ? helpBtn(id, label) : ''}</div>
    ${help ? helpBox(id, help) : ''}
    <div class="with-unit"><input id="f-${id}" data-k="${key}" type="number" inputmode="decimal" step="${step}" value="${esc(state[key] ?? '')}">${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    <p class="err" role="alert" hidden></p></div>`;
}
function seg(key, options, label, { help, id = key } = {}) {
  const btns = options.map(([v, l]) => `<button type="button" data-set="${key}" data-val="${esc(v)}" aria-pressed="${String(state[key]) === String(v)}">${esc(l)}</button>`).join('');
  return `<div class="field" data-field="${id}">${label ? `<div class="label-row"><span class="label" id="l-${id}">${esc(label)}</span>${help ? helpBtn(id, label) : ''}</div>` : ''}
    ${help ? helpBox(id, help) : ''}<div class="seg" role="group"${label ? ` aria-labelledby="l-${id}"` : ''}>${btns}</div><p class="err" role="alert" hidden></p></div>`;
}
function select(key, options, label, { id = key } = {}) {
  const opts = options.map(([v, l]) => `<option value="${esc(v)}"${String(state[key]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return `<div class="field" data-field="${id}"><label for="f-${id}">${esc(label)}</label><select id="f-${id}" data-k="${key}">${opts}</select><p class="err" role="alert" hidden></p></div>`;
}

// ------------------------------------------------------------------ form
function isExample() {
  return state.mode === 'new' && MAIN_FIELDS.every((k) => String(state[k]) === String(EXAMPLE_FORM[k]));
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

  $('#form').innerHTML = `
    ${seg('mode', [['new', fm.modeNew], ['existing', fm.modeExisting]], '', { id: 'mode' })}
    ${isExample() ? `<p class="banner">${esc(t('ui.exampleBanner'))} <button type="button" class="link" aria-expanded="false" aria-controls="where">${esc(t('ui.whereLink'))}</button></p>` : `<p class="hint"><button type="button" class="link" aria-expanded="false" aria-controls="where">${esc(t('ui.whereLink'))}</button></p>`}
    <div id="where" class="where" hidden>${whereHtml()}</div>
    <div class="amount-row">${numField('loanAmount', existing ? f.loanAmount.labelExisting : f.loanAmount.label, '', { hint: existing ? f.loanAmount.hintExisting : '' })}${currencySel}</div>
    ${ltvBlock}
    ${numField('liquidationLtv', f.liquidationLtv.label, '%', { help: fm.help.liquidationLtv })}
    <div class="field" data-field="durationMonths"><span class="label" id="l-dur">${esc(existing ? f.durationMonths.labelExisting : f.durationMonths.label)}</span>
      <div class="chips" role="group" aria-labelledby="l-dur">${durChips}<span class="with-unit other"><input type="number" step="1" min="1" inputmode="numeric" data-k="durationMonths" aria-label="${esc(fm.otherDuration)}" placeholder="${esc(fm.otherDuration)}" value="${other ? esc(state.durationMonths) : ''}"><span class="unit">${esc(t('ui.months'))}</span></span></div><p class="err" role="alert" hidden></p></div>
    ${rate}
    ${seg('purpose', [['spend', f.purpose.spend], ['buy', f.purpose.buy]], f.purpose.label)}
    <p class="price-line" id="price-line" aria-live="polite"></p>
    <div class="field" data-field="btcPrice" id="price-edit" hidden><span class="with-unit"><input type="number" step="any" inputmode="decimal" data-k="btcPrice" aria-label="BTC ${esc(cur)}" value="${esc(state.btcPrice ?? '')}"><span class="unit">${esc(cur)}</span></span><p class="err" role="alert" hidden></p></div>
    <details class="more" data-remember="more"><summary>${esc(existing ? fm.moreTermsExisting : fm.moreTerms)} <span class="sum" id="more-sum"></span></summary>${more}</details>
    <details class="more" data-remember="expert"><summary>${esc(fm.expert)}</summary>${expert}</details>
    <details class="more" data-remember="note"><summary>${esc(fm.note)}</summary><textarea data-k="notes" rows="3" aria-label="${esc(f.notes.label)}">${esc(state.notes || '')}</textarea></details>`;
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
  if (rerenderForm) renderForm();
  update();
}

function onInput(e) {
  const k = e.target.dataset.k;
  if (!k) {
    if (e.target.dataset.fb) feedback[e.target.dataset.fb] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    return;
  }
  const v = e.target.value;
  if (k === 'currency') { lastRisk = null; change((s) => { s.currency = v; }, { rerenderForm: true }); loadPrice(true); ensureRecent(v); return; }
  if (k === 'btcPrice') { priceInfo = { source: 'manual' }; change((s) => { s.btcPrice = v; s.priceManual = true; }); renderPriceLine(); return; }
  if (k === 'outlook') { change((s) => { s.outlook = Number(v); }); renderOutlook(); return; }
  if (k === 'marginCallLtv') { const wasEmpty = state.marginCallLtv === '' || state.marginCallLtv === null; change((s) => { s.marginCallLtv = v; }, { rerenderForm: wasEmpty !== (v === '') }); return; }
  if (k === 'marginCallConsequence') { change((s) => { s.marginCallConsequence = v; }, { rerenderForm: true }); return; }
  change((s) => setPath(s, k, v));
}

function onClick(e) {
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
      s[k] = v;
    }, { rerenderForm: true });
    return;
  }
  const preset = e.target.closest('[data-preset]');
  if (preset) { change((s) => { s.outlook = PRESETS[preset.dataset.preset]; }); renderOutlook(); return; }
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
  } else if (tgt.matches('[data-copy-link]')) {
    const url = `${location.origin}${location.pathname}${encodeState(state)}`;
    navigator.clipboard?.writeText(url).then(() => { $('#link-copied').hidden = false; });
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
  const candles = await fetchRecentCandles(cur);
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
function sendData(cur) {
  if (sentData.has(cur)) return;
  const base64 = document.getElementById(`data-${cur}`).textContent.trim();
  if (useInline) jobSetData(cur, base64, appended[cur]); else worker.postMessage({ type: 'data', currency: cur, base64, appended: appended[cur] });
  sentData.add(cur);
}
function onWorkerMessage(m) {
  if (m.id !== runId) return;
  if (m.type === 'progress') {
    $('#progress').hidden = false; $('#progress').textContent = t('ui.computing', { done: m.done, total: m.total });
  } else if (m.type === 'partial' || m.type === 'result') {
    garchCache[m.result.currency] = m.result.garch;
    lastRisk = m.result; [riskTerms, riskSettings] = pending[m.id];
    if (m.type === 'result') { busy = false; $('#progress').hidden = true; }
    renderRisk();
  } else if (m.type === 'error') {
    busy = false; $('#progress').textContent = m.message;
  }
}
function requestRisk(terms, settings) {
  runId++;
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
  const fieldFor = (f) => (f === 'rate' ? (state.rateType === 'variable' ? 'ratePath' : 'rateAnnual') : f === 'marginCallConsequence' ? 'marginCallLtv' : f);
  for (const e of errors) {
    if (e.field === 'btcPrice' && !priceInfo) continue; // the price is still loading
    const el = $(`[data-field="${fieldFor(e.field)}"] .err`);
    if (!el) continue;
    const tx = texts().errors[e.code];
    el.hidden = false; el.textContent += `${tx.problem} ${tx.fix} `;
    if (e.field === 'btcPrice' && priceInfo) $('#price-edit').hidden = false; // not while the price is still loading
    const det = el.closest('details'); if (det && !det.open) det.open = true;
  }
  $('#error-banner').hidden = errors.filter((e) => !(e.field === 'btcPrice' && !priceInfo)).length === 0;
}

function update() {
  const { terms, settings } = toTerms(state);
  const v = validateTerms(terms);
  showErrors(v.errors);
  const ltvToday = $('#ltv-today');
  if (ltvToday) ltvToday.textContent = Number.isFinite(terms.initialLtv) ? `LTV ${pct(terms.initialLtv, 1)}` : '';
  if (!v.ok) { $('#results').classList.add('invalid'); return; }
  $('#results').classList.remove('invalid');
  lastTerms = terms; lastSettings = settings;
  moreSummary(terms);
  renderLoan();
  clearTimeout(timer);
  if (lastRisk) $('#risk').classList.add('outdated');
  if (!started) return;
  $('#progress').hidden = false; $('#progress').textContent = t('ui.computing', { done: 0, total: '…' });
  timer = setTimeout(() => requestRisk(terms, settings), 300);
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
  renderFallsText();
  renderCost();
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
    <details class="table-details"><summary>${esc(C.schedule)}</summary><div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t('ui.showTable'))}"><table><thead><tr>${C.scheduleHead.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></details>`;
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
  $('#risk').classList.remove('outdated');
  const R = texts().results; const cur = tm.currency; const months = tm.durationMonths;
  const m = r.main;
  const pMarginOnly = m.pMarginCall === null ? 0 : Math.max(0, m.pMarginCall - m.pLiquidation - m.pPartial);
  const [nLiq, nPart, nMargin, nNone] = splitTo100([m.pLiquidation, m.pPartial, pMarginOnly, 1 - m.pLiquidation - m.pPartial - pMarginOnly]);
  const headline = m.pPartial >= 0.005 ? t('results.headlinePartial', { n: nLiq, m: nPart, months })
    : t(tm.mode === 'existing' ? 'results.headlineLiqExisting' : 'results.headlineLiq', { n: nLiq, months });
  $('#headline-text').innerHTML = esc(headline).replace(/(\d+) (of|von) 100/, '<em>$1 $2 100</em>');
  $('#dots').innerHTML = dotsHtml([[nLiq, 'd-liq'], [nPart, 'd-part'], [nMargin, 'd-margin'], [nNone, 'd-none']], headline)
    + legendHtml([[nLiq, 'd-liq', R.legendLiquidated], [nPart, 'd-part', R.legendPartial], [nMargin, 'd-margin', R.legendMargin], [nNone, 'd-none', R.legendNothing]]);
  $('#kept-line').textContent = m.keptAfterSale && m.pPartial >= 0.005 ? t('results.kept', { kept: pct(m.keptAfterSale.q50, 0) }) : '';
  $('#outlook-line').textContent = r.outlook ? t('results.outlookLine', { trend: signedPct(riskSettings.trend), n: of100(r.outlook.pLiquidation + r.outlook.pPartial) }) : '';
  const lastHour = Math.max(META.prices[cur].to, appended[cur] && appended[cur].length ? appended[cur].at(-1).time : 0);
  $('#basis-line').textContent = `${t('results.basis', { g: of100(r.garchMc.pLiquidation + r.garchMc.pPartial) })}`;
  // the whole period the results are based on, and when the stored data was last updated
  $('#data-period').textContent = t('ui.dataThrough', { from: date(META.prices[cur].from), to: date(lastHour), updated: date(META.dataUpdated || META.prices[cur].to) });
  renderSafer(); renderOutlook();
  if (tm.purpose === 'buy') renderLeverage();
  $('#history-text').innerHTML = historyText();
  if ($('#sec-falls').open) renderFutures();
  if ($('#sec-history').open) renderStories();
  if ($('#method').open) renderExpertCharts();
  $('#data-range').textContent = `${t('ui.dataUntil', { from: date(META.prices[cur].from), to: date(META.prices[cur].to) })}${appended[cur] && appended[cur].length ? ` ${t('ui.dataAppended', { to: dateTime(appended[cur].at(-1).time) })}` : ''}`;
}

function renderSafer() {
  const r = lastRisk; const tm = riskTerms; const R = texts().results; const cur = tm.currency;
  const el = $('#safer-body');
  if (!r.slider) { el.innerHTML = `<p class="progress">${esc(t('ui.computing', { done: '…', total: '…' }))}</p>`; return; }
  const grid = r.slider;
  if (!grid.length) { el.innerHTML = ''; return; }
  const idx = grid.reduce((best, g, i) => (Math.abs(g.ltv - tm.initialLtv) < Math.abs(grid[best].ltv - tm.initialLtv) ? i : best), 0);
  const line = (i) => {
    const g = grid[i];
    if (tm.mode === 'existing') {
      const btcNeeded = tm.loanAmount / (g.ltv * tm.btcPrice);
      const add = btcNeeded - tm.collateralInput;
      return add > 0.00005 ? t('results.sliderLineExisting', { ltv: pct(g.ltv, 0), p: of100(g.p), btc: btc(btcNeeded), add: btc(add) })
        : t('results.sliderLineExistingNow', { ltv: pct(g.ltv, 0), p: of100(g.p), btc: btc(btcNeeded) });
    }
    return t('results.sliderLine', { ltv: pct(g.ltv, 0), p: of100(g.p), btc: btc(g.btc) });
  };
  const levers = r.levers || [];
  const label = (l) => t(`results.levers.${l.id}`, {
    value: l.id === 'reserve' ? money0(l.value, cur) : l.id === 'shorter' ? l.value : l.value !== null ? pct(l.value, 0) : '', months: tm.durationMonths,
  });
  const row = (text, p, base) => `<div class="lv${base ? ' base' : ''}"><span>${esc(text)}</span><span class="b"><i style="width:${p * 100}%"></i></span><b>${of100(p)}</b></div>`;
  const higher = levers.find((l) => l.id === 'higherLiq');
  el.innerHTML = `<div class="slider"><label for="ltv-slider" id="slider-line">${esc(line(idx))}</label>
    <input id="ltv-slider" type="range" min="0" max="${grid.length - 1}" step="1" value="${idx}">
    <div class="ticks" aria-hidden="true">${grid.filter((_, i) => i % 2 === 0).map((g) => `<span>${pct(g.ltv, 0)}</span>`).join('')}</div>
    <p class="hint">${esc(R.sliderNote)}</p></div>
    <p class="sub">${esc(R.otherOptions)}</p>
    <div class="levers">${row(R.yourTerms, r.leverBase, true)}${levers.map((l) => row(label(l), l.p)).join('')}</div>
    ${higher && Math.abs(higher.p - r.leverBase) < 0.05 ? `<p class="hint">${esc(R.higherLiqNote)}</p>` : ''}`;
  const slider = $('#ltv-slider');
  slider.addEventListener('input', () => { $('#slider-line').textContent = line(Number(slider.value)); });
  slider.addEventListener('change', () => {
    const g = grid[Number(slider.value)];
    change((s) => {
      if (s.mode === 'existing' || s.ltvInput === 'btc') s.collateralBtc = String(+(numOr(s.loanAmount) / (g.ltv * numOr(s.btcPrice))).toFixed(6));
      else s.initialLtv = Math.round(g.ltv * 100);
    }, { rerenderForm: true });
  });
}

function renderOutlook() {
  const r = lastRisk; const R = texts().results;
  const trend = numOr(state.outlook, 0);
  const presetOf = Object.entries(PRESETS).find(([, v]) => v === trend);
  const chips = Object.entries(PRESETS).map(([k, v]) => `<button type="button" data-preset="${k}" aria-pressed="${v === trend}">${esc(R.presets[k])} <span class="sub">${signedPct(v / 100)}</span></button>`).join('');
  let anchor = '';
  if (r && r.facts) {
    const f = r.facts.fourYear; const by = r.facts.fourYearByStart; const a = by[0]; const z = by[by.length - 1];
    anchor = `<p class="hint">${esc(t('results.outlookAnchor', { worst: signedPct(f.worst), median: signedPct(f.median), best: signedPct(f.best), firstFrom: a.from, firstTo: a.to, firstRate: signedPct(a.perYear), lastFrom: z.from, lastTo: z.to, lastRate: signedPct(z.perYear) }))}</p>
      <p class="hint">${esc(t('results.outlookSwings', { deep: r.facts.deepYears, years: r.facts.years }))}</p>`;
  }
  const active = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k === 'outlook';
  if (active) { // keep the slider under the finger; only update the label
    $('#outlook-value').textContent = presetOf ? `${R.presets[presetOf[0]]}: ${signedPct(trend / 100)} ${t('ui.perYear')}` : t('results.outlookCustom', { trend: signedPct(trend / 100) });
    for (const b of document.querySelectorAll('[data-preset]')) b.setAttribute('aria-pressed', String(PRESETS[b.dataset.preset] === trend));
    renderOutlookResult();
    return;
  }
  $('#outlook-body').innerHTML = `<p class="hint">${esc(R.outlookIntro)}</p><div class="chips" role="group" aria-label="${esc(R.outlookTitle)}">${chips}</div>
    <label class="range-label"><span id="outlook-value">${esc(presetOf ? `${R.presets[presetOf[0]]}: ${signedPct(trend / 100)} ${t('ui.perYear')}` : t('results.outlookCustom', { trend: signedPct(trend / 100) }))}</span>
    <input type="range" min="-50" max="150" step="5" data-k="outlook" value="${trend}"></label>
    <div id="outlook-result" aria-live="polite"></div>${anchor}`;
  renderOutlookResult();
}

// The effect of the chosen outlook, shown right where it is chosen.
function renderOutlookResult() {
  const el = $('#outlook-result'); const r = lastRisk; const R = texts().results;
  if (!el || !r || !riskSettings) return;
  const chosen = numOr(state.outlook, 0);
  const shownFor = Math.round(riskSettings.trend * 100);
  const base = r.main.pLiquidation + r.main.pPartial;
  const bar = (label, p, cls) => `<div class="lv${cls}"><span>${esc(label)}</span><span class="b"><i style="width:${p * 100}%"></i></span><b>${of100(p)}</b></div>`;
  let html = `<div class="levers">${bar(R.outlookBarNone, base, ' base')}`;
  if (chosen === 0) html += `</div><p class="hint">${esc(R.outlookPick)}</p>`;
  else if (shownFor !== chosen || !r.outlook) html += `</div><p class="progress">${esc(t('ui.computing', { done: '…', total: '…' }))}</p>`;
  else {
    const p = r.outlook.pLiquidation + r.outlook.pPartial;
    html += `${bar(t('results.outlookBarYours', { trend: signedPct(chosen / 100) }), p, '')}</div><p class="big-line">${esc(t('results.outlookDiff', { m: of100(p), n: of100(base) }))}</p>`;
  }
  el.innerHTML = `${html}<p class="hint">${esc(R.outlookAffects)}</p>`;
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
    if (r.outlook && r.outlook.leverage) html += `<p class="hint">${esc(t('results.outlookLine', { trend: signedPct(riskSettings.trend), n: of100(r.outlook.leverage.more) }))} (${esc(C.levLegendMore)})</p>`;
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

function historyText() {
  const r = lastRisk; const rp = r.replay;
  const partial = rp.partialShare >= 0.005 ? t('history.replayPartial', { m: of100(rp.partialShare) }) : '';
  let html = `<p class="big-line">${esc(t('history.replay', { n: of100(rp.liquidatedShare), partial }))}</p>`;
  const cum = r.main.cumulativeByMonth; const total = cum.at(-1);
  if (total > 0.02) {
    const half = cum.findIndex((x) => x >= total / 2) + 1;
    if (half > 0 && half < cum.length) html += `<p>${esc(t('history.byMonth', { months: half }))}</p>`;
  }
  return html;
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
  const r = lastRisk; if (!r || !r.main.samplePaths) return;
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
  $('meta[name="description"]').setAttribute('content', tx.meta.description);
  for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = rich(t(el.dataset.t));
  $('#lang-btn').textContent = tx.ui.language;
  $('#lang-btn').setAttribute('lang', getLang() === 'de' ? 'en' : 'de');
  $('#lang-btn').setAttribute('aria-label', `${tx.ui.languageSwitch}: ${tx.ui.language}`);
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
    <label class="check"><input type="checkbox" data-fb="attach"${feedback.attach ? ' checked' : ''}> ${esc(Fb.attach)}</label>
    <p class="buttons"><button type="button" class="primary" data-fb-send>${esc(Fb.write)}</button><button type="button" class="secondary" data-fb-copy>${esc(Fb.copy)}</button></p>
    <p class="hint" id="fb-copied" hidden>${esc(t('feedback.copied', { email: SITE.feedbackEmail }))}</p>`;
}

function renderAll() {
  renderStatic();
  renderForm();
  update();
  if (lastRisk) renderRisk(); else renderOutlook();
}

// ------------------------------------------------------------------ start
initLang();
document.addEventListener('input', onInput);
document.addEventListener('click', onClick);
document.addEventListener('toggle', onToggle, true);
$('#lang-btn').addEventListener('click', () => { setLang(getLang() === 'de' ? 'en' : 'de'); renderAll(); });
$('#reset-btn').addEventListener('click', () => { state = { ...EXAMPLE_FORM, currency: state.currency, btcPrice: state.btcPrice, priceManual: state.priceManual }; saveState(); renderAll(); });
$('#forget-btn').addEventListener('click', () => {
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem('btc-loan-risk:lang'); } catch { /* ignore */ }
  state = { ...EXAMPLE_FORM, currency: state.currency, btcPrice: state.btcPrice, priceManual: false };
  renderAll(); $('#forgotten').hidden = false;
});
if (state.priceManual && numOr(state.btcPrice, null) !== null) priceInfo = { source: 'manual' };
renderAll();
makeWorker();
const waitMax = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
// wait for the live price (at most 4 s) and the recent hours (at most 1.5 s); later candles are used in the next recalculation
Promise.all([waitMax(loadPrice(false), 4000), waitMax(ensureRecent(state.currency), 1500)]).then(() => { started = true; update(); });
