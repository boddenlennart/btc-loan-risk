// Builds the site: three single-file pages, each in two languages. The hosting service serves the docs folder.
//   docs/index.html, docs/de/index.html                    the check (styles, app and worker code, price history inlined)
//   docs/insights/index.html, docs/de/insights/index.html  what happened since 2014
//   docs/method/index.html, docs/de/method/index.html      how it works (the example loan's results, computed here)
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
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
import { computeInsights } from '../src/insights/compute.js';
import { methodData } from '../src/app/method-data.js';
import { HALF_LIFE_YEARS } from '../src/app/riskjob.js';
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
  pageMeta.example = { key: exampleKey(exState), result: { ...res, main: { ...res.main, samplePool: null } } };
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

// Shared by all pages: styles, header (name, navigation, language menu), footer, icon.
const style = read('src/app/style.css').replace('/*FONTS*/', () => fonts);
const forget = '<p class="buttons"><button type="button" id="forget-btn" class="secondary" data-t="ui.forgetInputs"></button></p><p id="forgotten" class="sub" role="status" data-t="ui.forgotten" hidden></p>';
const footer = (extra) => read('src/app/partials/footer.html').replace('/*FOOTER_EXTRA*/', () => extra).replace('/*QR*/', () => qr);
// "How it works" shows the example loan: its results without the price history
const ex = pageMeta.example;
const methodMeta = ex && {
  prices: pageMeta.prices, dataUpdated: pageMeta.dataUpdated, built: pageMeta.built,
  example: {
    terms: toTerms({ ...EXAMPLE_FORM, btcPrice: meta[EXAMPLE_FORM.currency].lastClose }).terms,
    result: {
      fanByMonth: ex.result.main.fanByMonth, cumulativeByMonth: ex.result.main.cumulativeByMonth, facts: ex.result.facts, history: ex.result.history, barrier: ex.result.barrier,
      bootstrap: ex.result.main.pLiquidation + (ex.result.main.pPartial || 0), garch: ex.result.garchMc.pLiquidation + (ex.result.garchMc.pPartial || 0),
      replay: ex.result.replay.liquidatedShare + (ex.result.replay.partialShare || 0), nPaths: toTerms(EXAMPLE_FORM).settings.nPaths, blockDays: toTerms(EXAMPLE_FORM).settings.blockDays,
    },
    // the figures that explain the simulation (one future, volatility per year, weighting, precision, …)
    method: methodData({
      hourly: decodeHourly(gunzipSync(readFileSync(file(EXAMPLE_FORM.currency)))), terms: toTerms({ ...EXAMPLE_FORM, btcPrice: meta[EXAMPLE_FORM.currency].lastClose }).terms,
      garch: garch[EXAMPLE_FORM.currency], settings: toTerms(EXAMPLE_FORM).settings, halfLifeYears: HALF_LIFE_YEARS,
    }),
  },
};
// "Insights": what happened to loans since 2014, on the real US-dollar history (src/insights/compute.js).
// Recomputed at every build, so the weekly data update refreshes it.
const insights = currencies.includes('USD') ? computeInsights(decodeHourly(gunzipSync(readFileSync(file('USD')))), { halfLifeYears: HALF_LIFE_YEARS }) : null;
if (!insights) console.warn('WARNING: no USD history: the insights page is empty');
const PAGES = [
  { dir: '', src: 'src/app/index.html', extra: forget, parts: {
    '/*META*/': JSON.stringify(pageMeta), '/*DATA_USD*/': b64('USD'), '/*DATA_EUR*/': b64('EUR'), '/*DATA_FX*/': fxB64,
    '/*WORKER*/': safe(await bundle('src/app/worker.js')), '/*APP*/': safe(await bundle('src/app/main.js')) } },
  { dir: 'insights/', src: 'src/pages/insights.html', extra: '', group: 'insights', parts: { '/*META*/': safe(JSON.stringify({ built: pageMeta.built, insights })), '/*APP*/': safe(await bundle('src/app/insights-page.js')) } },
  { dir: 'method/', src: 'src/pages/method.html', extra: '', group: 'method', parts: { '/*META*/': safe(JSON.stringify(methodMeta)), '/*APP*/': safe(await bundle('src/app/method-page.js')) } },
];
function assemble(page) {
  let html = read(page.src);
  const parts = { '/*THEME*/': read('src/app/partials/theme-early.html').trim(), '/*STYLE*/': style, '/*ICON*/': read('src/app/partials/icon.html').trim(), '/*HEADER*/': read('src/app/partials/header.html'), '/*FOOTER*/': footer(page.extra), ...page.parts };
  for (const [k, v] of Object.entries(parts)) html = html.replace(k, () => v);
  // Content Security Policy: only the page's own script may run, identified by its fingerprint
  // (SHA-256). Any other inline script, even an injected one, is refused by the browser.
  // Two scripts may run: the tiny one in <head> that applies a chosen light/dark mode before the page
  // is drawn (no flash of the wrong colours), and the page's own script.
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  return html.replace('/*SCRIPT_HASH*/', hashes.join(' '));
}
// Remind the owner while the legal templates still contain «placeholders».
for (const lang of ['de', 'en']) {
  const n = (read(`src/content/text.${lang}.js`).match(/«[^»]*»/g) || []).length;
  if (n) console.warn(`NOTE: src/content/text.${lang}.js still has ${n} «placeholders» in the Impressum / privacy notice`);
}
// Head per language: title and description for search, preview tags for messengers and X
// (ux/D-share-preview.md). The preview images and icons are made by tools/build-og.mjs.
const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const BASE = `https://${SITE.domain}/`;
function head(lang, page) {
  const all = { en, de }[lang]; const tx = all.meta; const own = page.group ? all[page.group] : null;
  const title = own ? own.metaTitle : tx.title; const description = own ? own.metaDescription : tx.description; const ogTitle = own ? own.metaTitle : tx.ogTitle;
  const url = `${BASE}${lang === 'de' ? 'de/' : ''}${page.dir}`; const up = '../'.repeat((lang === 'de' ? 1 : 0) + (page.dir ? 1 : 0));
  return [
    `<title>${attr(title)}</title>`,
    `<meta name="description" content="${attr(description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" hreflang="en" href="${BASE}${page.dir}">`,
    `<link rel="alternate" hreflang="de" href="${BASE}de/${page.dir}">`,
    `<link rel="alternate" hreflang="x-default" href="${BASE}${page.dir}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${attr(tx.name)}">`,
    `<meta property="og:title" content="${attr(ogTitle)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${BASE}og-${lang}.png?v=${ogVersion(lang)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${attr(ogTitle)}">`,
    `<meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_US'}">`,
    `<meta property="og:locale:alternate" content="${lang === 'de' ? 'en_US' : 'de_DE'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">`,
    '<meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#121210" media="(prefers-color-scheme: dark)">',
    `<script type="application/ld+json">${structuredData(lang, page, { title, description, url })}</script>`,
  ].join('\n');
}
// Structured data (JSON-LD, decision 025): tells search engines and AI assistants in a fixed vocabulary what each page is:
// a free web application (the check) or a page of the site, in which language, by whom, last changed when.
// It names nobody but the site and its maker (decision 002), and carries no number a reader could compare with the page.
function structuredData(lang, page, { title, description, url }) {
  const all = { en, de }[lang];
  const maker = { '@type': 'Person', '@id': `${BASE}#maker`, name: SITE.maker, url: SITE.makerUrl };
  const site = { '@type': 'WebSite', '@id': `${BASE}#site`, url: BASE, name: en.meta.name, alternateName: de.meta.name, inLanguage: ['en', 'de'], author: { '@id': maker['@id'] } };
  const common = { url, name: title, description, inLanguage: lang, isPartOf: { '@id': site['@id'] }, author: { '@id': maker['@id'] }, dateModified: meta.updated ? new Date(meta.updated * (meta.updated > 1e11 ? 1 : 1000)).toISOString().slice(0, 10) : undefined, license: `${SITE.codeUrl}/blob/main/LICENSE` };
  const self = page.group
    ? { '@type': 'WebPage', '@id': `${url}#page`, ...common }
    : { '@type': ['WebApplication', 'WebPage'], '@id': `${url}#page`, ...common, alternateName: all.meta.name, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, codeRepository: SITE.codeUrl };
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [self, site, maker] }).replace(/</g, '\\u003c');
}
// The preview image's address carries a stamp made from the image itself: LinkedIn and messengers keep an image
// by its address, so a new image needs a new address (they kept showing the old one after the logo changed, 21 Oct 2026).
function ogVersion(lang) {
  const f = new URL(`docs/og-${lang}.png`, root);
  return existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 8) : 'none';
}
mkdirSync(new URL(`${OUT}/de/`, root), { recursive: true });
// Security headers for the hosting service (Cloudflare Pages reads docs/_headers).
writeFileSync(new URL(`${OUT}/_headers`, root), read('src/app/_headers'));
// For search engines: robots.txt and a sitemap with both languages. A real "not found" page,
// so the hosting service answers unknown addresses with 404 instead of the whole page.
writeFileSync(new URL(`${OUT}/robots.txt`, root), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
const alt = (dir) => `<xhtml:link rel="alternate" hreflang="en" href="${BASE}${dir}"/><xhtml:link rel="alternate" hreflang="de" href="${BASE}de/${dir}"/>`;
writeFileSync(new URL(`${OUT}/sitemap.xml`, root), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGES.flatMap((p) => [`<url><loc>${BASE}${p.dir}</loc>${alt(p.dir)}</url>`, `<url><loc>${BASE}de/${p.dir}</loc>${alt(p.dir)}</url>`]).join('\n')}
</urlset>
`);
writeFileSync(new URL(`${OUT}/404.html`, root), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not found · ${attr(en.meta.name)}</title>
<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f5f1;color:#15140f;display:grid;place-items:center;min-height:100vh;padding:16px}a{color:#1f4e79}@media(prefers-color-scheme:dark){body{background:#121210;color:#f2f0ea}a{color:#9cc0e8}}</style></head>
<body><main><h1 style="font-size:24px">This page does not exist.</h1><p><a href="/">${attr(en.meta.name)}</a> · <a href="/de/" lang="de">${attr(de.meta.name)} (Deutsch)</a></p><p style="font-size:14px"><a href="/#impressum">Impressum (legal notice)</a> · <a href="/#privacy-notice">Privacy notice</a> · <a href="/de/#privacy-notice" lang="de">Datenschutzerklärung</a></p></main></body></html>
`);
// A summary for AI assistants (llms.txt, decision 025): what the site is and where its pages are, in plain text.
const exMain = pageMeta.example && pageMeta.example.result.main;
// the example's answer rounded exactly as the page shows it (splitTo100 in src/app/main.js: the four groups add up to 100)
function shownAnswer(m) {
  const marginOnly = m.pMarginCall === null ? 0 : Math.max(0, m.pMarginCall - m.pLiquidation - m.pPartial);
  const raw = [m.pLiquidation, m.pPartial, marginOnly, 1 - m.pLiquidation - m.pPartial - marginOnly].map((p) => Math.max(0, p) * 100); const fl = raw.map(Math.floor);
  let rest = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((r, k) => [r - fl[k], k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (rest > 0) { fl[k]++; rest--; } });
  return fl[0] + fl[1];
}
const llmsPart = (tx, dir) => {
  const exLine = exMain ? `- ${tx.llms.example.replace('{n}', String(shownAnswer(exMain))).replace('{date}', new Date(meta[EXAMPLE_FORM.currency].to * 1000).toISOString().slice(0, 10))}\n` : '';
  return `> ${tx.llms.summary}\n\n${tx.llms.facts.map((f) => `- ${f}`).join('\n')}\n${exLine}\n### ${tx.llms.pagesTitle}\n\n${PAGES.map((p) => `- [${p.group ? tx[p.group].metaTitle : tx.meta.title}](${BASE}${dir}${p.dir}): ${p.group ? tx[p.group].metaDescription : tx.meta.description}`).join('\n')}\n`;
};
writeFileSync(new URL(`${OUT}/llms.txt`, root), `# ${en.meta.name}\n\n${llmsPart(en, '')}\n## ${en.llms.germanTitle}\n\n${llmsPart(de, 'de/')}\n## ${en.llms.sourceTitle}\n\n- [${en.llms.sourceCode}](${SITE.codeUrl})\n`);

// For readers without scripts (search and AI crawlers, decision 025): each finished page is opened once here, in the
// project's own Chrome, exactly as a first-time visitor gets it, and what stands on the screen is written into the file.
// The empty original moves into a <template>; a one-line script in the page puts it back before the page's own script
// starts. So a visitor's browser runs the very same page as before, and a crawler reads the texts and the example's numbers.
let browser;
try { browser = await chromium.launch(); } catch (e) {
  throw new Error(`The build needs the project's Chrome to write the page texts into the files (decision 025).\nSet PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/ms-playwright" (see CLAUDE.md), or install it: npx playwright install chromium\n${e.message}`);
}
async function prerender(doc, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'UTC', locale: 'en-GB' });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  // no request leaves this computer: the page itself comes from memory, the price services answer "nothing new"
  // (the page then uses the last price of its own data, the same for every build of the same data)
  await page.route('**/*', (route) => (route.request().url() === url ? route.fulfill({ body: doc, contentType: 'text/html; charset=utf-8' }) : route.abort()));
  await page.goto(url);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
  // the check page recalculates the example once in the background: wait until nothing is marked as still computing
  await page.waitForFunction(() => !document.querySelector('.pending, .outdated') && (!document.querySelector('#progress') || document.querySelector('#progress').hidden), null, { timeout: 180000 });
  if (problems.length) throw new Error(`${url}: the page reported errors while it was written out: ${problems.join('; ')}`);
  const html = await page.evaluate(() => {
    // what the visitor typed or what stands in a field is a property, not markup: write it into the markup
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked);
      else if (el.tagName === 'SELECT') for (const o of el.options) o.toggleAttribute('selected', o.selected);
      else if (el.tagName === 'TEXTAREA') el.textContent = el.value;
      else el.setAttribute('value', el.value);
    }
    const t = document.getElementById('pristine-here');
    const out = []; for (let n = document.body.firstChild; n && n !== t; n = n.nextSibling) out.push(n.nodeType === 1 ? n.outerHTML : n.nodeType === 3 ? n.textContent : '');
    return out.join('');
  });
  await context.close();
  return html;
}
for (const page of PAGES) {
  const html = assemble(page);
  for (const lang of ['en', 'de']) {
    const out = `${OUT}/${lang === 'de' ? 'de/' : ''}${page.dir}index.html`;
    mkdirSync(new URL(out.replace(/index\.html$/, ''), root), { recursive: true });
    const plain = html.replace('<html lang="en">', `<html lang="${lang}">`).replace('/*HEAD*/', () => head(lang, page));
    // the part a visitor sees: from the start of <body> to the marker after </main>
    const from = plain.indexOf('<body>') + '<body>'.length; const to = plain.indexOf('/*PRISTINE*/');
    if (from < 6 || to < 0) throw new Error(`${page.src}: <body> or the /*PRISTINE*/ marker is missing`);
    const original = plain.slice(from, to);
    if (/<script|<template/i.test(original)) throw new Error(`${page.src}: the visible part must hold no script or template`);
    const written = await prerender(plain.replace('/*PRISTINE*/', '<i id="pristine-here" hidden></i>'), `${BASE}${lang === 'de' ? 'de/' : ''}${page.dir}`);
    if (/<script/i.test(written)) throw new Error(`${out}: the written-out page holds a script`);
    const doc = `${plain.slice(0, from)}${written}<template id="pristine">${original}</template>${plain.slice(to + '/*PRISTINE*/'.length)}`;
    writeFileSync(new URL(out, root), doc);
    console.log(`${out}: ${(doc.length / 1024 / 1024).toFixed(2)} MB`);
  }
}
await browser.close();
