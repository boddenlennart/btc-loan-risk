// What all three pages share: the header (name, navigation, language menu) and the footer
// (maker, glossary, Impressum, privacy notice, feedback form, donation). No wording lives here.
import { setLang, getLang, t, texts, rich, esc, pageHref, currentPage } from './i18n.js';
import { SITE } from '../content/site.js';
import { feedbackText, mailtoLink } from './feedback.js';

const $ = (sel) => document.querySelector(sel);
const feedback = { use: '', meaning: '', useful: 0, easy: 0, missing: '', language: '', attach: false };
let opts = { getTerms: null, built: 0, onLang: null };

/** Fills every [data-t] element, the navigation and the footer in the current language. */
export function renderShell() {
  const tx = texts();
  for (const el of document.querySelectorAll('[data-t]')) el.innerHTML = rich(t(el.dataset.t));
  for (const el of document.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', t(el.dataset.tLabel));
  const here = currentPage();
  for (const a of document.querySelectorAll('a[data-page]')) {
    a.href = pageHref(a.dataset.page);
    if (a.closest('.site-nav')) { if (a.dataset.page === here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }
  $('#maker').textContent = t('footer.maker', { name: SITE.maker });
  $('#lang-missing').textContent = tx.feedback.languageMissing;
  $('#lang-missing').href = mailtoLink(SITE.feedbackEmail, tx.feedback.languageSubject, `${tx.feedback.language}\n\n`);
  $('#lang-code').textContent = getLang().toUpperCase();
  $('#lang-btn').setAttribute('aria-label', `${getLang().toUpperCase()}, ${tx.ui.languageSwitch}: ${tx.ui.languageName}`); // starts with the visible text
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-current', String(b.dataset.lang === getLang()));
  $('#glossary-list').innerHTML = Object.entries(tx.glossary.terms).map(([id, g]) => `<dt id="g-${id}">${esc(g.term)}</dt><dd>${rich(g.text)}</dd>`).join('');
  const em = (s) => esc(s).replace('{email}', `<a href="mailto:${SITE.feedbackEmail}">${SITE.feedbackEmail}</a>`);
  $('#impressum-body').innerHTML = tx.legal.impressum.map((x) => `<p>${em(x)}</p>`).join('');
  $('#privacy-body').innerHTML = tx.legal.privacy.map((sec) => `<h3>${esc(sec.h)}</h3>${sec.p.map((x) => `<p>${em(x)}</p>`).join('')}`).join('');
  for (const n of document.querySelectorAll('.template-note')) n.hidden = !JSON.stringify(tx.legal).includes('«');
  $('#donate-address').textContent = SITE.donationAddress;
  renderThemeBtn();
  renderFeedbackForm();
}

function renderFeedbackForm() {
  const Fb = texts().feedback;
  const scale = (key) => `<div class="chips scale" role="group" aria-label="${esc(Fb[key])}"><span class="sub">${esc(Fb.scaleLow)}</span>${[1, 2, 3, 4, 5, 6, 7].map((n) => `<label class="chip"><input type="radio" name="fb-${key}" value="${n}" data-fb="${key}"${Number(feedback[key]) === n ? ' checked' : ''}><span>${n}</span></label>`).join('')}<span class="sub">${esc(Fb.scaleHigh)}</span></div>`;
  const attach = opts.getTerms ? `<label class="check"><input type="checkbox" data-fb="attach"${feedback.attach ? ' checked' : ''}> ${esc(Fb.attach)}</label>` : '';
  $('#feedback-body').innerHTML = `<p class="hint">${esc(Fb.intro)}</p>
    <fieldset><legend>${esc(Fb.use)}</legend><div class="chips">${Object.entries(Fb.useOptions).map(([k, l]) => `<label class="chip"><input type="radio" name="fb-use" value="${k}" data-fb="use"${feedback.use === k ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
    <label class="block">${esc(Fb.meaning)}<textarea rows="2" data-fb="meaning">${esc(feedback.meaning)}</textarea></label>
    <fieldset><legend>${esc(Fb.useful)}</legend>${scale('useful')}</fieldset>
    <fieldset><legend>${esc(Fb.easy)}</legend>${scale('easy')}</fieldset>
    <label class="block">${esc(Fb.missing)}<textarea rows="2" data-fb="missing">${esc(feedback.missing)}</textarea></label>
    <label class="block">${esc(Fb.language)}<input type="text" data-fb="language" value="${esc(feedback.language)}"></label>
    ${attach}
    <p class="buttons"><button type="button" class="primary" data-fb-send>${esc(Fb.write)}</button><button type="button" class="secondary" data-fb-copy>${esc(Fb.copy)}</button></p>
    <p class="hint" id="fb-copied" hidden>${esc(t('feedback.copied', { email: SITE.feedbackEmail }))}</p>`;
}

// Light or dark: follows the device until the visitor chooses; the choice is remembered in this browser
// (applied before the page is drawn by the small script in src/app/partials/theme-early.html).
const THEME_KEY = 'btc-loan-risk:theme';
const darkNow = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
function renderThemeBtn() {
  const b = $('#theme-btn'); if (!b) return;
  const dark = darkNow();
  b.dataset.mode = dark ? 'dark' : 'light'; // the icon shows the mode a tap switches to
  b.setAttribute('aria-label', t(dark ? 'ui.themeToLight' : 'ui.themeToDark'));
  b.title = b.getAttribute('aria-label');
  // the browser's own bar follows the chosen colours
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', dark ? '#121210' : '#f6f5f1');
}
export function setTheme(mode) {
  if (mode) document.documentElement.dataset.theme = mode; else delete document.documentElement.dataset.theme;
  try { if (mode) localStorage.setItem(THEME_KEY, mode); else localStorage.removeItem(THEME_KEY); } catch { /* storage blocked: for this visit only */ }
  renderThemeBtn();
}

const closeLangMenu = () => { $('#lang-list').hidden = true; $('#lang-btn').setAttribute('aria-expanded', 'false'); };

/**
 * Starts the shared parts. `getTerms`: the loan terms to attach to feedback (check page only),
 * `onLang`: re-renders the page after a language change (check page only: the other pages
 * load the address of the other language instead).
 */
export function initShell(o = {}) {
  opts = { ...opts, ...o };
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.fb;
    if (k) feedback[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  });
  document.addEventListener('click', (e) => {
    const tgt = e.target;
    const choice = tgt.closest('[data-lang]');
    if (choice) {
      closeLangMenu();
      if (choice.dataset.lang !== getLang()) {
        if (opts.onLang) { setLang(choice.dataset.lang); opts.onLang(); } else { const page = currentPage(); setLang(choice.dataset.lang); location.href = pageHref(page); return; }
      }
      $('#lang-btn').focus();
      return;
    }
    if (tgt.closest('#theme-btn')) { setTheme(darkNow() ? 'light' : 'dark'); return; }
    if (tgt.closest('#lang-btn')) {
      const open = $('#lang-btn').getAttribute('aria-expanded') !== 'true';
      $('#lang-btn').setAttribute('aria-expanded', String(open)); $('#lang-list').hidden = !open;
      return;
    }
    if (!tgt.closest('.lang-menu')) closeLangMenu();
    if (tgt.matches('[data-fb-send], [data-fb-copy]')) {
      const body = feedbackText({
        ...feedback, use: feedback.use ? texts().feedback.useOptions[feedback.use] : '', terms: feedback.attach && opts.getTerms ? { ...opts.getTerms() } : null,
        version: new Date(opts.built * 1000).toISOString().slice(0, 10), lang: getLang(), device: matchMedia('(max-width: 600px)').matches ? 'phone' : 'desktop',
      });
      if (tgt.matches('[data-fb-send]')) location.href = mailtoLink(SITE.feedbackEmail, texts().feedback.subject, body);
      else navigator.clipboard?.writeText(body).then(() => { $('#fb-copied').hidden = false; });
    } else if (tgt.matches('[data-copy-address]')) {
      navigator.clipboard?.writeText(SITE.donationAddress).then(() => { tgt.textContent = t('donate.copied'); });
    } else if (tgt.closest('a.gloss')) {
      $('#glossary').open = true;
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#lang-list').hidden) { closeLangMenu(); $('#lang-btn').focus(); } });
  // /#impressum or /#privacy-notice (links from the "not found" page) open that part of the footer
  const legal = ['#impressum', '#privacy-notice'].includes(location.hash) && document.querySelector(location.hash);
  if (legal) { legal.open = true; setTimeout(() => legal.scrollIntoView(), 0); }
}
