// Makes the link-preview images and icons in docs/: og-en.png, og-de.png (1200 x 630, with the example's
// answer read from the built pages: run tools/build.mjs first),
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

// The logo: the Bitcoin logo (orange coin with ₿; public domain), as a vector, the same on every device.
const MARK = '<g transform="scale(.5)"><path fill="#F7931A" d="m63.04 39.741c-4.274 17.143-21.638 27.575-38.783 23.301-17.138-4.274-27.571-21.638-23.295-38.78 4.272-17.145 21.636-27.579 38.775-23.305 17.143 4.274 27.575 21.64 23.301 38.784z"/><path fill="#fff" d="m46.11 27.441c0.637-4.258-2.605-6.547-7.038-8.074l1.438-5.768-3.511-0.875-1.4 5.616c-0.923-0.23-1.871-0.447-2.813-0.662l1.41-5.653-3.509-0.875-1.439 5.766c-0.764-0.174-1.514-0.346-2.242-0.527l0.004-0.018-4.842-1.209-0.934 3.75s2.605 0.597 2.55 0.634c1.422 0.355 1.679 1.296 1.636 2.042l-1.638 6.571c0.098 0.025 0.225 0.061 0.365 0.117-0.117-0.029-0.242-0.061-0.371-0.092l-2.296 9.205c-0.174 0.432-0.615 1.08-1.609 0.834 0.035 0.051-2.552-0.637-2.552-0.637l-1.743 4.019 4.569 1.139c0.85 0.213 1.683 0.436 2.503 0.646l-1.453 5.834 3.507 0.875 1.439-5.772c0.958 0.26 1.888 0.5 2.798 0.726l-1.434 5.745 3.511 0.875 1.453-5.823c5.987 1.133 10.489 0.676 12.384-4.739 1.527-4.36-0.076-6.875-3.226-8.515 2.294-0.529 4.022-2.038 4.483-5.155zm-8.022 11.249c-1.085 4.36-8.426 2.003-10.806 1.412l1.928-7.729c2.38 0.594 10.012 1.77 8.878 6.317zm1.086-11.312c-0.99 3.966-7.1 1.951-9.082 1.457l1.748-7.007c1.982 0.494 8.365 1.416 7.334 5.55z"/></g>';
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${MARK}</svg>\n`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, tx] of [['en', en], ['de', de]]) {
  // the example's answer exactly as the built page shows it (run tools/build.mjs first)
  const site = await browser.newPage();
  await site.goto(new URL(`docs/${lang === 'en' ? '' : 'de/'}index.html`, root).href);
  await site.waitForSelector('#dots .dots i');
  const ex = await site.evaluate(() => ({
    label: document.querySelector('#ans-label').textContent.trim(), n: document.querySelector('#headline-text em').textContent.trim(),
    of: document.querySelector('#headline-text .of').textContent.trim(), sent: document.querySelector('#headline-text .sentence').textContent.trim(),
    dots: [...document.querySelectorAll('#dots .dots i')].map((i) => i.className),
  }));
  await site.close();
  await page.setContent(template, { waitUntil: 'load' });
  await page.evaluate(({ m, ex, mark }) => {
    document.getElementById('name').textContent = m.name;
    document.getElementById('head').textContent = m.headline;
    document.getElementById('facts').innerHTML = m.facts;
    document.getElementById('trust').textContent = m.trust;
    document.getElementById('mark').innerHTML = mark;
    document.getElementById('label').textContent = ex.label;
    document.getElementById('n').textContent = ex.n;
    document.getElementById('of').textContent = ex.of;
    document.getElementById('sent').textContent = ex.sent;
    document.getElementById('dots').innerHTML = ex.dots.map((c) => `<i class="${c}"></i>`).join('');
  }, { m: { name: tx.meta.name, headline: tx.ui.headline, facts: tx.meta.ogFacts, trust: tx.meta.ogTrust }, ex, mark: MARK });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL(`docs/og-${lang}.png`, root).pathname });
  if (ex.dots.length !== 100) throw new Error(`og-${lang}: ${ex.dots.length} dots instead of 100`);
  console.log(`docs/og-${lang}.png: ${ex.n} ${ex.of}`);
}
writeFileSync(new URL('docs/favicon.svg', root), favicon);
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 38 38" width="180" height="180"><rect x="-3" y="-3" width="38" height="38" fill="#f6f5f1"/>${MARK}</svg></body></html>`);
await page.screenshot({ path: new URL('docs/apple-touch-icon.png', root).pathname });
console.log('docs/favicon.svg, docs/apple-touch-icon.png');
await browser.close();
