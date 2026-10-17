// Builds the single-file page: docs/index.html (GitHub Pages serves the docs folder).
// Inlines the styles, the app code, the worker code and the compressed price history.
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import QRCode from 'qrcode';
import { SITE } from '../src/content/site.js';
import { gunzipSync } from 'node:zlib';
import { decodeHourly } from '../src/data/codec.js';
import { dailyFromHourly, dailyReturns } from '../src/engine/history.js';
import { fitGarchT } from '../src/engine/garch.js';
import { setData as jobSetData, run as jobRun } from '../src/app/riskjob.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';
import { toTerms, exampleKey } from '../src/app/terms.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

async function bundle(entry) {
  const r = await build({ entryPoints: [new URL(entry, root).pathname], bundle: true, write: false, format: 'iife', minify: true, target: ['es2020'], legalComments: 'none' });
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
  '/*WORKER*/': safe(await bundle('src/app/worker.js')),
  '/*APP*/': safe(await bundle('src/app/main.js')),
  '/*QR*/': qr,
};
for (const [k, v] of Object.entries(parts)) html = html.replace(k, () => v);
// Remind the owner while the legal templates still contain «placeholders».
for (const lang of ['de', 'en']) {
  const n = (read(`src/content/text.${lang}.js`).match(/«[^»]*»/g) || []).length;
  if (n) console.warn(`NOTE: src/content/text.${lang}.js still has ${n} «placeholders» in the Impressum / privacy notice`);
}
mkdirSync(new URL('docs/', root), { recursive: true });
writeFileSync(new URL('docs/index.html', root), html);
console.log(`docs/index.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
