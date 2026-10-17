// Makes the link-preview images and icons in docs/: og-en.png, og-de.png (1200 x 630),
// favicon.svg and apple-touch-icon.png (180 x 180). Rendered with the same browser the tests
// use and the embedded Source Serif 4. Run when the name, headline or logo changes:
//   node tools/build-og.mjs     (needs PLAYWRIGHT_BROWSERS_PATH=.tools/ms-playwright)
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import en from '../src/content/text.en.js';
import de from '../src/content/text.de.js';

const root = new URL('../', import.meta.url);
const font = readFileSync(new URL('node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2', root)).toString('base64');
const face = `@font-face{font-family:"Source Serif 4";font-weight:600;src:url(data:font/woff2;base64,${font}) format("woff2")}`;
const template = readFileSync(new URL('tools/og-template.html', root), 'utf8').replace('/*FONTS*/', face);

// Logo B: the price (dot) above the line at which BTC is sold.
const MARK = '<circle cx="16" cy="9" r="5" fill="#1f4e79"/><path d="M16 15.5v6" stroke="#1f4e79" stroke-width="2.2" stroke-dasharray="2 2"/><path d="M4 26h24" stroke="#15140f" stroke-width="2.6" stroke-linecap="round"/>';
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f6f5f1"/>${MARK}</svg>\n`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, tx] of [['en', en], ['de', de]]) {
  await page.setContent(template, { waitUntil: 'load' });
  await page.evaluate((m) => {
    document.getElementById('name').textContent = m.name;
    document.getElementById('head').textContent = m.headline;
    document.getElementById('facts').innerHTML = m.facts;
    document.getElementById('trust').textContent = m.trust;
  }, { name: tx.meta.name, headline: tx.ui.headline, facts: tx.meta.ogFacts, trust: tx.meta.ogTrust });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL(`docs/og-${lang}.png`, root).pathname });
  console.log(`docs/og-${lang}.png`);
}
writeFileSync(new URL('docs/favicon.svg', root), favicon);
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="180" height="180"><rect width="32" height="32" fill="#f6f5f1"/>${MARK}</svg></body></html>`);
await page.screenshot({ path: new URL('docs/apple-touch-icon.png', root).pathname });
console.log('docs/favicon.svg, docs/apple-touch-icon.png');
await browser.close();
