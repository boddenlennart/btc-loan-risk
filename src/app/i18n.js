// Language handling: picks German or English, fills {placeholders}, turns
// [[term]] glossary links into links. All wording lives in src/content/text.*.js.
import en from '../content/text.en.js';
import de from '../content/text.de.js';

const TEXTS = { en, de };
let lang = 'en';

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('btc-loan-risk:lang'); } catch { /* storage may be blocked */ }
  lang = saved === 'de' || saved === 'en' ? saved : (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  document.documentElement.lang = lang;
  return lang;
}

export function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('btc-loan-risk:lang', l); } catch { /* ignore */ }
}

export const getLang = () => lang;
export const texts = () => TEXTS[lang];

/** Look up "a.b.c" and fill {name} placeholders. */
export function t(path, vars = {}) {
  const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), TEXTS[lang]);
  if (typeof v !== 'string') return v ?? path;
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Escaped HTML with [[term]] turned into glossary links. */
export function rich(s) {
  return esc(s).replace(/\[\[(\w+)\]\]/g, (_, id) => {
    const g = TEXTS[lang].glossary[id];
    return g ? `<a href="#g-${id}" class="gloss">${esc(g.term)}</a>` : id;
  });
}
export { esc };
