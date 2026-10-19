// Test 7 (revised in the UX redesign, approved in ux/A3 and ux/A4):
// completeness, wording and readability of all page texts, in both languages.
//   - a "?" help text exactly at the six agreed places, each with a worked number example
//   - every input and every result explained somewhere (help, hint, glossary or its section)
//   - no "typical / market" claims without a source, no advice wording, no lender names
//   - readable: short sentences (criterion D3)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { ERROR_CODES } from '../src/engine/validate.js';

const load = async (lang) => (await import(`../src/content/text.${lang}.js`)).default;
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function allStrings(obj, path = '') {
  if (typeof obj === 'string') return [[path, obj]];
  return Object.entries(obj ?? {}).flatMap(([k, v]) => allStrings(v, path ? `${path}.${k}` : k));
}

// The six "?" places (ux/A3, section 6).
const HELP = ['form.help.initialLtv', 'form.help.liquidationLtv', 'form.help.repayment', 'form.help.marginCall', 'results.headlineHelp', 'falls.futuresHelp'];

// Every input, and where it is explained (a "?" text, a hint under it, or a glossary entry).
const INPUTS = {
  loanAmount: 'glossary.terms.collateral', initialLtv: 'form.help.initialLtv', collateralBtc: 'glossary.terms.collateral',
  liquidationLtv: 'form.help.liquidationLtv', durationMonths: 'form.fields.durationMonths.label', rateAnnual: 'glossary.terms.aprVsRate',
  purpose: 'form.fields.purpose.label', repayment: 'form.help.repayment', compounding: 'glossary.terms.compounding',
  originationFee: 'glossary.terms.originationFee', marginCall: 'form.help.marginCall', marginCallLtv: 'form.fields.marginCallLtv.hint',
  marginCallConsequence: 'form.help.marginCall', curePeriodHours: 'glossary.terms.curePeriod', liquidationSale: 'glossary.terms.partialLiquidation',
  cureTargetLtv: 'form.fields.cureTargetLtv.hint', liquidationFee: 'glossary.terms.liquidation', repayWith: 'cost.levCash',
  currency: 'form.fields.currency.label', startDate: 'form.fields.startDate.hint', dayCount: 'glossary.terms.dayCount',
};
// Every result, and where it is explained.
const OUTPUTS = {
  headline: 'results.headlineHelp', dots: 'results.legendLiquidated', saleLine: 'method.measure', limits: 'results.limits',
  slider: 'results.sliderNote', levers: 'results.otherOptions', trend: 'history.trendIntro', leverageTrend: 'cost.levTrendUnit', ladder: 'falls.marginCure',
  futures: 'falls.futuresHelp', cost: 'glossary.terms.aprVsRate', breakeven: 'cost.sellIntro', leverage: 'cost.levIntro',
  replay: 'glossary.terms.historicalReplay', stories: 'history.storiesLine', method: 'method.oneSteps', fan: 'method.fanNote',
  compare: 'method.methodsWhy', feedback: 'feedback.intro', donate: 'donate.public',
};
const GLOSSARY = ['ltv', 'marginCall', 'liquidation', 'partialLiquidation', 'collateral', 'curePeriod', 'originationFee', 'aprVsRate',
  'drawdown', 'ohlc', 'compounding', 'dayCount', 'priceIndex', 'counterpartyRisk', 'rehypothecation', 'simulatedFuture',
  'blockBootstrap', 'garch', 'historicalReplay', 'priceTrend'];

const MARKET_CLAIMS = [/\btypical/i, /\busually\b/i, /\bnormally\b/i, /\bmostly\b/i, /\bcommon(ly)?\b/i, /\bmarket (rate|standard|value)/i, /\bmost lenders\b/i, /\bstandard rate\b/i,
  /\bmeist(ens)?\b/i, /üblich/i, /typisch/i, /normalerweise/i, /marktüblich/i, /die meisten (Anbieter|Kreditgeber)/i, /\bgängig/i, /in der Regel/i];
const ADVICE = [/\byou should\b/i, /\bwe recommend\b/i, /\bgreat deal\b/i, /\bbest (offer|lender)\b/i, /\bsollten Sie\b/i, /\bsolltest\b/i, /\bempfehlen\b/i, /\bempfehlung\b/i];
const LENDER_NAMES = [/nexo/i, /ledn/i, /celsius/i, /blockfi/i, /unchained/i, /firefish/i, /salt lending/i, /hodl ?hodl/i, /debifi/i, /bitpanda/i, /bison/i, /two ?prime/i, /\bmilo\b/i, /coinbase/i, /kraken/i, /binance/i, /crypto\.com/i, /\baave\b/i, /\bstrike\b/i];
// Parts where exchanges may be named because they are the data sources (and the privacy texts).
const NAMES_ALLOWED_IN = ['method', 'footer', 'legal', 'form.priceLine', 'ui.dataAppended'];

for (const lang of ['en', 'de']) {
  describe(`texts (${lang})`, () => {
    it('a "?" help text exists at exactly the six agreed places, each with a worked number example', async () => {
      const t = await load(lang);
      for (const p of HELP) {
        expect(get(t, p), p).toEqual(expect.any(String));
        expect(get(t, p), p).toMatch(/\d/);
      }
      expect(Object.keys(t.form.help).sort()).toEqual(['initialLtv', 'liquidationLtv', 'marginCall', 'repayment']);
    });
    it('every input has a label and is explained somewhere', async () => {
      const t = await load(lang);
      for (const [id, where] of Object.entries(INPUTS)) {
        if (t.form.fields[id]) expect(t.form.fields[id].label, `form.fields.${id}.label`).toEqual(expect.any(String));
        expect(get(t, where), `${id} → ${where}`).toBeTruthy();
      }
    });
    it('every result is explained somewhere', async () => {
      const t = await load(lang);
      for (const [id, where] of Object.entries(OUTPUTS)) expect(get(t, where), `${id} → ${where}`).toBeTruthy();
    });
    it('the headline says what it does NOT include (model, lender failure, price gaps, price measurement)', async () => {
      const t = await load(lang);
      expect(t.results.limits.length).toBeGreaterThanOrEqual(4);
    });
    it('every validation error says what is wrong AND how to fix it', async () => {
      const t = await load(lang);
      for (const code of ERROR_CODES) {
        expect(t.errors?.[code]?.problem, `errors.${code}.problem`).toEqual(expect.any(String));
        expect(t.errors?.[code]?.fix, `errors.${code}.fix`).toEqual(expect.any(String));
      }
    });
    it('glossary has every required term, and every [[term]] link points to an entry', async () => {
      const t = await load(lang);
      for (const id of GLOSSARY) {
        expect(t.glossary.terms[id]?.term, `glossary.${id}.term`).toEqual(expect.any(String));
        expect(t.glossary.terms[id]?.text, `glossary.${id}.text`).toEqual(expect.any(String));
      }
      for (const [path, s] of allStrings(t)) {
        for (const [, id] of s.matchAll(/\[\[(\w+)\]\]/g)) expect(t.glossary.terms[id], `${path} links to [[${id}]]`).toBeDefined();
      }
    });
    it('Impressum and privacy notice exist, and the privacy texts name every outside service the page contacts', async () => {
      const t = await load(lang);
      for (const k of ['impressumTitle', 'privacyTitle', 'templateNote']) expect(t.legal[k], `legal.${k}`).toEqual(expect.any(String));
      expect(t.legal.impressum.length).toBeGreaterThan(2);
      const text = JSON.stringify(t.legal.privacy);
      for (const host of ['www.bitstamp.net', 'api.coinbase.com', 'Cloudflare', 'Proton', 'GitHub']) expect(text, host).toContain(host);
      expect(text, 'no placeholders left').not.toMatch(/«/);
      expect(text, 'every stored item is named').toMatch(/session storage|Session Storage/);
      expect(JSON.stringify(t.legal.privacy)).toMatch(/E-Mail|e-mail/); // section on feedback e-mails
    });
    it('no "typical / market" value claims without a [source: ...]', async () => {
      const t = await load(lang);
      for (const [path, s] of allStrings(t)) {
        if (s.includes('[source:')) continue;
        for (const re of MARKET_CLAIMS) expect(s, `${path} matches ${re}`).not.toMatch(re);
      }
    });
    it('no advice or sales wording', async () => {
      const t = await load(lang);
      for (const [path, s] of allStrings(t)) for (const re of ADVICE) expect(s, `${path} matches ${re}`).not.toMatch(re);
    });
    it('no lender or platform names outside the data-source and privacy texts', async () => {
      const t = await load(lang);
      for (const [path, s] of allStrings(t)) {
        if (NAMES_ALLOWED_IN.some((p) => path === p || path.startsWith(`${p}.`))) continue;
        for (const re of LENDER_NAMES) expect(s, `${path} matches ${re}`).not.toMatch(re);
      }
    });
    it('readable (D3): short sentences in all explanations', async () => {
      const t = await load(lang);
      const texts = allStrings(t).filter(([p]) => !p.startsWith('legal') && !p.startsWith('footer.privacy')).map(([, s]) => s.replace(/\[\[\w+\]\]/g, 'X'));
      const sentences = texts.flatMap((s) => s.split(/(?<=[.!?])\s+/)).filter((s) => /\p{L}/u.test(s));
      const words = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%€$-]*/gu) || []).length;
      const long = sentences.filter((s) => words(s) > 30);
      expect(long, long.join('\n')).toEqual([]);
      const avg = sentences.reduce((a, s) => a + words(s), 0) / sentences.length;
      expect(avg).toBeLessThanOrEqual(14);
    });
  });
}

describe('German and English cover exactly the same texts', () => {
  it('same keys', async () => {
    const keys = (t) => allStrings(t).map(([p]) => p).sort();
    expect(keys(await load('de'))).toEqual(keys(await load('en')));
  });
  it('German is actually translated (no long English sentence copied over)', async () => {
    const en = Object.fromEntries(allStrings(await load('en')));
    // names are the same in every language (site and owner name in the Impressum)
    const SAME_ON_PURPOSE = ['legal.impressum.1'];
    for (const [path, s] of allStrings(await load('de'))) if (s.length > 20 && !SAME_ON_PURPOSE.includes(path)) expect(s, path).not.toBe(en[path]);
  });
});

describe('example values in the form', () => {
  it('the example values are marked as such', async () => {
    const { EXAMPLE_FORM } = await import('../src/content/examples.js');
    expect(EXAMPLE_FORM.isExample).toBe(true);
  });
});

describe('every text the page code asks for exists', () => {
  it('all t("...") keys in src/app/*.js and data-t keys in index.html exist in both languages', async () => {
    const dir = new URL('../src/app/', import.meta.url);
    const keys = new Set();
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      for (const [, k] of readFileSync(new URL(f, dir), 'utf8').matchAll(/\bt\('([\w.]+)'/g)) keys.add(k);
    }
    for (const [, k] of readFileSync(new URL('index.html', dir), 'utf8').matchAll(/data-t="([\w.]+)"/g)) keys.add(k);
    expect(keys.size).toBeGreaterThan(40);
    for (const lang of ['en', 'de']) {
      const tx = await load(lang);
      for (const k of keys) expect(typeof get(tx, k), `${lang}: ${k}`).toBe('string');
    }
  });
});

describe('glossary links', () => {
  it('every [[term]] in the texts names a glossary entry, and the page turns it into a link with the term', async () => {
    globalThis.document ??= { documentElement: {} }; // setLang marks the page language
    const { rich, setLang } = await import('../src/app/i18n.js');
    for (const lang of ['en', 'de']) {
      const tx = await load(lang);
      setLang(lang);
      for (const [path, s] of allStrings(tx)) {
        for (const [, id] of s.matchAll(/\[\[(\w+)\]\]/g)) {
          expect(tx.glossary.terms[id], `${lang} ${path}: [[${id}]]`).toBeDefined();
          expect(rich(`[[${id}]]`)).toBe(`<a href="#g-${id}" class="gloss">${tx.glossary.terms[id].term}</a>`);
        }
      }
    }
  });
});
