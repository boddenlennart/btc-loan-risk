// Language handling: picks German or English, fills {placeholders}, turns
// [[term]] glossary links into links. All wording lives in src/content/text.*.js.
import en from '../content/text.en.js';
import de from '../content/text.de.js';

const TEXTS = { en, de };
let lang = 'en';

// The site has three pages, each with an English address (/, /insights/, /method/) and a German
// one (/de/, /de/insights/, /de/method/), so links and search results carry the language.
// Other paths (a test copy elsewhere) keep their address.
export const PAGES = ['', 'insights/', 'method/'];
const SITE_PATH = /^(.*?\/)(de\/)?((?:insights|method)\/)?(index\.html)?$/;
const parsePath = () => (typeof location === 'undefined' ? null : location.pathname.match(SITE_PATH));
/** The address of one of the three pages (`page`: '', 'insights/' or 'method/') in a language. */
export function pageHref(page, l = lang) {
  const m = parsePath();
  // a copy opened from the disk (file://) has no server to add "index.html" to folder addresses
  const file = typeof location !== 'undefined' && location.protocol === 'file:' ? 'index.html' : '';
  return `${m ? m[1] : '/'}${l === 'de' ? 'de/' : ''}${page}${file}`;
}
/** Which of the three pages this is ('', 'insights/' or 'method/'). */
export function currentPage() { const m = parsePath(); return (m && m[3]) || ''; }
function syncPath() {
  if (typeof location === 'undefined' || typeof history === 'undefined') return; // not in a browser (tests)
  if (!parsePath()) return;
  const path = pageHref(currentPage());
  if (path !== location.pathname) history.replaceState(null, '', `${path}${location.search}${location.hash}`);
}

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('btc-loan-risk:lang'); } catch { /* storage may be blocked */ }
  const fromPath = /\/de\/((insights|method)\/)?(index\.html)?$/.test(location.pathname) ? 'de' : null;
  lang = fromPath || (saved === 'de' || saved === 'en' ? saved : (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en');
  document.documentElement.lang = lang;
  syncPath();
  return lang;
}

export function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('btc-loan-risk:lang', l); } catch { /* ignore */ }
  syncPath();
}

export const getLang = () => lang;
export const texts = () => TEXTS[lang];

/** Look up "a.b.c" and fill {name} placeholders. */
export function t(path, vars = {}) {
  const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), TEXTS[lang]);
  if (typeof v !== 'string') return v ?? path;
  // one month, not "1 months" / "1 Monaten"
  const one = Object.keys(vars).filter((k) => Number(vars[k]) === 1 && typeof vars[k] !== 'boolean');
  const s = one.reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\} (months|Monaten|Monate)\\b`, 'g'), (_, w) => `{${k}} ${w.startsWith('m') ? 'month' : 'Monat'}`), v);
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Escaped HTML with [[term]] turned into glossary links. */
export function rich(s) {
  return esc(s).replace(/\[\[(\w+)\]\]/g, (_, id, offset, src) => {
    const g = TEXTS[lang].glossary.terms[id];
    if (!g) return id;
    // inside an English sentence a glossary word is lower-case ("the price trend"); abbreviations (LTV, GARCH)
    // and German nouns keep their capital letter
    const start = offset === 0 || /[.!?:]\s*$/.test(src.slice(0, offset));
    const term = lang === 'en' && !start && !/^[A-Z]{2}/.test(g.term) ? g.term[0].toLowerCase() + g.term.slice(1) : g.term;
    return `<a href="#g-${id}" class="gloss">${esc(term)}</a>`;
  });
}
export { esc };
