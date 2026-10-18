// Builds the single-file page in two languages: docs/index.html (English) and docs/de/index.html
// (German, starts in German). The hosting service serves the docs folder.
// Inlines the styles, the app code, the worker code and the compressed price history.
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import QRCode from 'qrcode';
import { SITE } from '../src/content/site.js';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeHourly } from '../src/data/codec.js';
import { dailyFromHourly, dailyReturns } from '../src/engine/history.js';
import { fitGarchT } from '../src/engine/garch.js';
import { setData as jobSetData, run as jobRun } from '../src/app/riskjob.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';
import { toTerms, exampleKey } from '../src/app/terms.js';
import { parseEcbCsv, checkFx, convertHourly, lastRate, FX_CURRENCIES } from '../src/data/fx.js';
import en from '../src/content/text.en.js';
import de from '../src/content/text.de.js';

const root = new URL('../', import.meta.url);
// BUILD_OUT: another output folder (used only for the coverage measurement, with BUILD_MINIFY=0)
const OUT = (process.env.BUILD_OUT || 'docs').replace(/\/$/, '');
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

async function bundle(entry) {
  const r = await build({ entryPoints: [new URL(entry, root).pathname], bundle: true, write: false, format: 'iife', minify: process.env.BUILD_MINIFY !== '0', target: ['es2020'], legalComments: 'none' });
  return r.outputFiles[0].text;
}

const meta = JSON.parse(read('data/meta.json'));
const file = (cur) => new URL(`data/btc-${cur.toLowerCase()}-1h.bin.gz`, root);
const currencies = ['EUR', 'USD'].filter((c) => existsSync(file(c)) && meta[c]);
if (currencies.length < 2) console.warn(`WARNING: only ${currencies.join(', ')} price history available`);
const b64 = (cur) => (currencies.includes(cur) ? readFileSync(file(cur)).toString('base64') : '');
// The GARCH model is fitted here once on the embedded history, so visitors' browsers don't
// have to (it is the slowest step). The few recent hours added on load barely change it.
const garch = Object.fromEntries(currencies.map((c) => [c, fitGarchT(dailyReturns(dailyFromHourly(decodeHourly(gunzipSync(readFileSync(file(c)))))).returns)]));
const pageMeta = { prices: Object.fromEntries(currencies.map((c) => [c, meta[c]])), garch, dataUpdated: meta.updated, built: Math.floor(Date.now() / 1000) };

// Six more currencies: hourly BTC/EUR × the ECB's daily rate (src/data/fx.js). The page gets the
// rates table (small) and converts the euro history itself; the GARCH model is fitted here.
const fx = parseEcbCsv(read('data/fx-ecb.csv'), { fromIso: '1999-01-01' });
const fxProblems = checkFx(fx);
if (fxProblems.length) throw new Error(`data/fx-ecb.csv: ${fxProblems.join('; ')}`);
let fxB64 = '';
if (currencies.includes('EUR')) {
  const eurHourly = decodeHourly(gunzipSync(readFileSync(file('EUR'))));
  for (const c of FX_CURRENCIES) {
    garch[c] = fitGarchT(dailyReturns(dailyFromHourly(convertHourly(eurHourly, fx, c))).returns);
    pageMeta.prices[c] = { ...meta.EUR, lastClose: Math.round(meta.EUR.lastClose * lastRate(fx, c) * 100) / 100, sources: ['bitstamp', 'kraken', 'ecb'], fromEur: true, fxTo: fx.days.at(-1) * 86400 };
  }
  fxB64 = gzipSync(JSON.stringify(fx)).toString('base64');
}

// The example answer, computed here with the page's own calculation on the embedded history,
// so a first-time visitor sees it at once (0 s). With the LTV fixed, the liquidation chance does
// not depend on the BTC price; the page recomputes it with the live price and recent hours anyway.
// The 40 sample paths are left out (they are only drawn when "What happens when BTC falls" opens),
// and so is the replay's list per start day (not shown).
if (currencies.includes(EXAMPLE_FORM.currency)) {
  const cur = EXAMPLE_FORM.currency;
  const exState = { ...EXAMPLE_FORM, btcPrice: meta[cur].lastClose };
  jobSetData(cur, b64(cur));
  const { terms, settings } = toTerms(exState);
  const res = await jobRun(0, terms, settings, garch[cur], () => {});
  const { perStart, ...replay } = res.replay; // the per-start-day list is not shown on the page
  pageMeta.example = { key: exampleKey(exState), result: { ...res, main: { ...res.main, samplePaths: null }, replay } };
}

// Donation QR code: made here at build time and stored in the page as an SVG picture.
const qr = (await QRCode.toString(`bitcoin:${SITE.donationAddress}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 }))
  .replace('<svg ', `<svg role="img" aria-label="QR: bitcoin:${SITE.donationAddress}" `);

// Source Serif 4 (SIL Open Font License, see licenses/OFL-source-serif-4.txt), weight 600,
// embedded so the page makes no font request. Two character sets: Latin and extended Latin (zł, Kč).
const fontDir = new URL('node_modules/@fontsource/source-serif-4/files/', root);
const fontFace = (set, range) => `@font-face{font-family:"Source Serif 4";font-style:normal;font-weight:600;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(new URL(`source-serif-4-${set}-600-normal.woff2`, fontDir)).toString('base64')}) format("woff2");unicode-range:${range}}`;
const fonts = fontFace('latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')
  + fontFace('latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+20A0-20AB,U+20AD-20C4,U+2C60-2C7F,U+A720-A7FF');

let html = read('src/app/index.html');
const parts = {
  '/*STYLE*/': read('src/app/style.css').replace('/*FONTS*/', () => fonts),
  '/*META*/': JSON.stringify(pageMeta),
  '/*DATA_USD*/': b64('USD'),
  '/*DATA_EUR*/': b64('EUR'),
  '/*DATA_FX*/': fxB64,
  '/*WORKER*/': safe(await bundle('src/app/worker.js')),
  '/*APP*/': safe(await bundle('src/app/main.js')),
  '/*QR*/': qr,
};
for (const [k, v] of Object.entries(parts)) html = html.replace(k, () => v);
// Content Security Policy: only the page's own script may run, identified by its fingerprint
// (SHA-256). Any other inline script, even an injected one, is refused by the browser.
const appScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];
html = html.replace('/*SCRIPT_HASH*/', `'sha256-${createHash('sha256').update(appScript).digest('base64')}'`);
// Remind the owner while the legal templates still contain «placeholders».
for (const lang of ['de', 'en']) {
  const n = (read(`src/content/text.${lang}.js`).match(/«[^»]*»/g) || []).length;
  if (n) console.warn(`NOTE: src/content/text.${lang}.js still has ${n} «placeholders» in the Impressum / privacy notice`);
}
// Head per language: title and description for search, preview tags for messengers and X
// (ux/D-share-preview.md). The preview images and icons are made by tools/build-og.mjs.
const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const BASE = `https://${SITE.domain}/`;
function head(lang) {
  const tx = { en, de }[lang].meta; const url = lang === 'de' ? `${BASE}de/` : BASE; const up = lang === 'de' ? '../' : '';
  return [
    `<title>${attr(tx.title)}</title>`,
    `<meta name="description" content="${attr(tx.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" hreflang="en" href="${BASE}">`,
    `<link rel="alternate" hreflang="de" href="${BASE}de/">`,
    `<link rel="alternate" hreflang="x-default" href="${BASE}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${attr(tx.name)}">`,
    `<meta property="og:title" content="${attr(tx.ogTitle)}">`,
    `<meta property="og:description" content="${attr(tx.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${BASE}og-${lang}.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${attr(tx.ogTitle)}">`,
    `<meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_US'}">`,
    `<meta property="og:locale:alternate" content="${lang === 'de' ? 'en_US' : 'de_DE'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">`,
    '<meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#121210" media="(prefers-color-scheme: dark)">',
  ].join('\n');
}
mkdirSync(new URL(`${OUT}/de/`, root), { recursive: true });
// Security headers for the hosting service (Cloudflare Pages reads docs/_headers).
writeFileSync(new URL(`${OUT}/_headers`, root), read('src/app/_headers'));
// For search engines: robots.txt and a sitemap with both languages. A real "not found" page,
// so the hosting service answers unknown addresses with 404 instead of the whole page.
writeFileSync(new URL(`${OUT}/robots.txt`, root), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
const alt = `<xhtml:link rel="alternate" hreflang="en" href="${BASE}"/><xhtml:link rel="alternate" hreflang="de" href="${BASE}de/"/>`;
writeFileSync(new URL(`${OUT}/sitemap.xml`, root), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${BASE}</loc>${alt}</url>
<url><loc>${BASE}de/</loc>${alt}</url>
</urlset>
`);
writeFileSync(new URL(`${OUT}/404.html`, root), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not found · ${attr(en.meta.name)}</title>
<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f5f1;color:#15140f;display:grid;place-items:center;min-height:100vh;padding:16px}a{color:#1f4e79}@media(prefers-color-scheme:dark){body{background:#121210;color:#f2f0ea}a{color:#9cc0e8}}</style></head>
<body><main><h1 style="font-size:24px">This page does not exist.</h1><p><a href="/">${attr(en.meta.name)}</a> · <a href="/de/" lang="de">${attr(de.meta.name)} (Deutsch)</a></p></main></body></html>
`);
for (const [lang, out] of [['en', `${OUT}/index.html`], ['de', `${OUT}/de/index.html`]]) {
  const page = html.replace('<html lang="en">', `<html lang="${lang}">`).replace('/*HEAD*/', () => head(lang));
  writeFileSync(new URL(out, root), page);
  console.log(`${out}: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
}
