// Test 7 — Completeness and wording of all explanation texts, in both languages.
// The lists below are the specification: the page's text files
// (src/content/text.en.js and text.de.js) must cover every item.
import { describe, it, expect } from 'vitest';
import { ERROR_CODES } from '../src/engine/validate.js';

const INPUTS = [
  'currency', 'btcPrice', 'loanAmount', 'initialLtv', 'marginCallLtv', 'liquidationLtv', 'durationMonths',
  'startDate', 'rateType', 'rateAnnual', 'ratePath', 'repayment', 'compounding', 'dayCount',
  'originationFee', 'liquidationFee', 'liquidationFeeBasis', 'earlyRepaymentFee', 'curePeriodHours',
  'marginCallConsequence', 'cureTargetLtv', 'reserveAmount', 'taxRateNow', 'taxRateAtMaturity', 'taxJurisdiction', 'notes',
  'simPaths', 'bootstrapBlockDays', 'assumedTrend',
];
// Inputs where a worked number example makes no sense (free text or a list choice).
const NO_NUMERIC_EXAMPLE = ['currency', 'taxJurisdiction', 'notes'];

const OUTPUTS = [
  'collateralBtc', 'amountReceived', 'liquidationPrice', 'marginCallPrice', 'dropToLiquidation',
  'totalInterest', 'totalPayback', 'interestShare', 'totalCost', 'effectiveApr', 'earlyRepaymentCost',
  'probLiquidation', 'probMarginCall', 'probByMonth', 'fanChart', 'modelComparison', 'barrierCheck',
  'replayShare', 'replayWorst', 'reserveNeeded', 'topUpToCure', 'costIfLiquidated', 'breakevenReturn',
  'whatIfTable', 'taxNote', 'livePrice',
];
const GLOSSARY = [
  'ltv', 'marginCall', 'liquidation', 'collateral', 'curePeriod', 'originationFee', 'aprVsRate',
  'drawdown', 'ohlc', 'interestOnly', 'bullet', 'amortizing', 'compounding', 'dayCount', 'priceIndex',
  'counterpartyRisk', 'rehypothecation', 'monteCarlo', 'blockBootstrap', 'garch', 'historicalReplay',
];
// Fixed page sections that must exist (not advice, risks, data sources...).
const LEGAL = ['impressumTitle', 'privacyTitle', 'templateNote'];
const SECTIONS = ['notAdvice', 'counterpartyRisk', 'priceMeasurement', 'lenderFiguresWin', 'exampleLabel', 'privacy', 'dataSources', 'staleWarning'];

// Phrases that claim what is "normal" in the market. Allowed only if the same text
// carries a [source: ...] marker. Plus advice and sales wording, never allowed.
const MARKET_CLAIMS = [/\btypical/i, /\busually\b/i, /\bnormally\b/i, /\bmostly\b/i, /\bcommon(ly)?\b/i, /\bmarket (rate|standard|value)/i, /\bmost lenders\b/i, /\bstandard rate\b/i,
  /\bmeist(ens)?\b/i, /üblich/i, /typisch/i, /normalerweise/i, /marktüblich/i, /die meisten (Anbieter|Kreditgeber)/i, /gängig/i, /in der Regel/i];
const ADVICE = [/\byou should\b/i, /\bwe recommend\b/i, /\bgreat deal\b/i, /\bbest (offer|lender)\b/i, /\bsollten Sie\b/i, /\bsolltest\b/i, /\bempfehlen\b/i, /\bempfehlung\b/i];
const LENDER_NAMES = [/nexo/i, /ledn/i, /celsius/i, /blockfi/i, /unchained/i, /firefish/i, /salt lending/i, /hodl ?hodl/i, /debifi/i, /bitpanda/i, /bison/i, /two ?prime/i, /\bmilo\b/i, /coinbase/i, /kraken/i, /binance/i, /crypto\.com/i, /\baave\b/i, /\bstrike\b/i];

const load = async (lang) => (await import(`../src/content/text.${lang}.js`)).default;

function allStrings(obj, path = '') {
  if (typeof obj === 'string') return [[path, obj]];
  return Object.entries(obj ?? {}).flatMap(([k, v]) => allStrings(v, path ? `${path}.${k}` : k));
}

for (const lang of ['en', 'de']) {
  describe(`texts (${lang})`, () => {
    it('every input has label, short hint, "where to find this", and a "?" text', async () => {
      const t = await load(lang);
      for (const id of INPUTS) {
        for (const part of ['label', 'hint', 'where', 'more']) {
          expect(t.inputs?.[id]?.[part], `inputs.${id}.${part}`).toEqual(expect.any(String));
          expect(t.inputs[id][part].trim().length, `inputs.${id}.${part}`).toBeGreaterThan(0);
        }
      }
    });
    it('every "?" text has a worked example with numbers', async () => {
      const t = await load(lang);
      for (const id of INPUTS.filter((i) => !NO_NUMERIC_EXAMPLE.includes(i))) {
        expect(t.inputs[id].more, `inputs.${id}.more`).toMatch(/\d/);
      }
    });
    it('every output has a label and a "What does this mean?" text', async () => {
      const t = await load(lang);
      for (const id of OUTPUTS) {
        expect(t.outputs?.[id]?.label, `outputs.${id}.label`).toEqual(expect.any(String));
        expect(t.outputs?.[id]?.meaning, `outputs.${id}.meaning`).toEqual(expect.any(String));
      }
    });
    it('the headline probability says what it does NOT capture (model, lender failure, price gaps)', async () => {
      const t = await load(lang);
      const nc = t.outputs.probLiquidation.notCaptured;
      expect(nc).toEqual(expect.any(Array));
      expect(nc.length).toBeGreaterThanOrEqual(3);
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
        expect(t.glossary?.[id]?.term, `glossary.${id}.term`).toEqual(expect.any(String));
        expect(t.glossary?.[id]?.text, `glossary.${id}.text`).toEqual(expect.any(String));
      }
      for (const [path, s] of allStrings(t)) {
        for (const [, id] of s.matchAll(/\[\[(\w+)\]\]/g)) expect(t.glossary[id], `${path} links to [[${id}]]`).toBeDefined();
      }
    });
    it('fixed sections exist (not advice, counterparty risk, price measurement, privacy...)', async () => {
      const t = await load(lang);
      for (const s of SECTIONS) expect(t.sections?.[s], `sections.${s}`).toEqual(expect.any(String));
    });
    it('Impressum and privacy notice exist, and the privacy notice names every outside service the page contacts', async () => {
      const t = await load(lang);
      for (const k of LEGAL) expect(t.legal?.[k], `legal.${k}`).toEqual(expect.any(String));
      expect(t.legal.impressum.length).toBeGreaterThan(2);
      const text = JSON.stringify(t.legal.privacy) + t.sections.privacy;
      for (const host of ['api.coinbase.com', 'api.kraken.com', 'api.binance.com', 'api.coingecko.com', 'www.bitstamp.net', 'GitHub']) {
        expect(text, host).toContain(host);
      }
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
    it('no lender or platform names in explanations and examples', async () => {
      const t = await load(lang);
      for (const [path, s] of allStrings({ inputs: t.inputs, outputs: t.outputs, glossary: t.glossary, errors: t.errors })) {
        for (const re of LENDER_NAMES) expect(s, `${path} matches ${re}`).not.toMatch(re);
      }
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
    for (const [path, s] of allStrings(await load('de'))) {
      if (s.length > 20) expect(s, path).not.toBe(en[path]);
    }
  });
});

describe('example values in the form', () => {
  it('every example value is marked as an example', async () => {
    const { EXAMPLE_TERMS } = await import('../src/content/examples.js');
    expect(EXAMPLE_TERMS.isExample).toBe(true);
  });
});

describe('every text the page code asks for exists', () => {
  it('all t("...") keys in src/app/*.js and data-t keys in index.html exist in both languages', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const dir = new URL('../src/app/', import.meta.url);
    const keys = new Set();
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      for (const [, k] of readFileSync(new URL(f, dir), 'utf8').matchAll(/\bt\('([\w.]+)'/g)) keys.add(k);
    }
    for (const [, k] of readFileSync(new URL('index.html', dir), 'utf8').matchAll(/data-t="([\w.]+)"/g)) keys.add(k);
    expect(keys.size).toBeGreaterThan(20);
    for (const lang of ['en', 'de']) {
      const tx = await load(lang);
      for (const k of keys) {
        const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), tx);
        expect(typeof v, `${lang}: ${k}`).toBe('string');
      }
    }
  });
});
