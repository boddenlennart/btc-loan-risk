// What a crawler sees (decision 025, issue #18). The crawlers of the large AI assistants run no scripts:
// on 27 Oct 2026 they found 19 words on the check page and 9 on Insights, because the page's script wrote
// all text. These tests open the built pages with scripts switched off and look for what a visitor reads.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { exampleAnswer } from './helpers.js';

// The crawler's view does not depend on a browser engine: Chrome's engine only.
test.beforeEach(({ browserName }) => { test.skip(browserName !== 'chromium', 'the page files are the same for every engine'); });

const SITE = 'https://bitcoinloancheck.com';
const PAGES = [
  { path: '/', lang: 'en', kind: 'check', h1: 'An independent check for any Bitcoin loan offer.' },
  { path: '/de/', lang: 'de', kind: 'check', h1: 'Ein unabhängiger Check für jedes Bitcoin-Kreditangebot.' },
  { path: '/insights/', lang: 'en', kind: 'insights', h1: 'Insights' },
  { path: '/de/insights/', lang: 'de', kind: 'insights', h1: 'Erkenntnisse' },
  { path: '/method/', lang: 'en', kind: 'method', h1: 'How it works' },
  { path: '/de/method/', lang: 'de', kind: 'method', h1: 'So funktioniert es' },
];
const of100 = (lang, n) => (lang === 'de' ? `${n} von 100` : `${n} of 100`);

async function withoutScripts(browser, baseURL, path) {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.route(/^https:\/\//, (route) => route.abort()); // a crawler's view of our own files only
  await page.goto(path);
  return { page, context };
}
const words = (s) => s.split(/\s+/).filter(Boolean).length;

for (const p of PAGES) {
  test(`without scripts: ${p.path} shows its title, its text and its numbers`, async ({ browser, baseURL }) => {
    const { page, context } = await withoutScripts(browser, baseURL, p.path);
    await expect(page.locator('h1')).toHaveText(p.h1);
    const main = await page.locator('main').innerText(); // what is visible, as a reader of the plain file gets it
    const n = exampleAnswer(p.lang);
    if (p.kind === 'check') {
      expect(words(main), 'words in the page').toBeGreaterThan(300);
      // the example's answer and the sentence around it
      await expect(page.locator('#headline-text')).toContainText(of100(p.lang, n));
      // the parts a reader would quote: the dots' legend, the four tiles, the questions for the lender
      expect(await page.locator('#dots .legend span').count(), 'legend entries').toBeGreaterThanOrEqual(3);
      expect(await page.locator('#tiles .tile').count(), 'tiles').toBeGreaterThanOrEqual(3);
      expect(await page.locator('#questions li').count(), 'questions to ask the lender').toBe(8);
      expect(main).toMatch(p.lang === 'de' ? /Keine Vorhersage/ : /Not a forecast/);
    }
    if (p.kind === 'insights') {
      expect(words(main), 'words in the page').toBeGreaterThan(800);
      expect(await page.locator('main table').count(), 'tables').toBeGreaterThanOrEqual(8);
      expect(await page.locator('main table tbody tr').count(), 'table rows').toBeGreaterThanOrEqual(40);
      expect(main).toMatch(p.lang === 'de' ? /von 100/ : /of 100/);
    }
    if (p.kind === 'method') {
      expect(words(main), 'words in the page').toBeGreaterThan(800);
      expect(main, 'the example\'s answer, as on the check page').toContain(p.lang === 'de' ? `von 100, angezeigt als ${n}.` : `of 100, shown as ${n}.`);
    }
    await context.close();
  });
}

test('without scripts: the folded parts of the check page can be read (history, cost, what is not included, glossary)', async ({ browser, baseURL }) => {
  const { page, context } = await withoutScripts(browser, baseURL, '/');
  // folded parts are in the file; a crawler reads their text whether they are open or not
  const all = await page.locator('body').evaluate((b) => { const c = b.cloneNode(true); c.querySelectorAll('script, style, template').forEach((e) => e.remove()); return c.textContent.replace(/\s+/g, ' '); }); // text in the page, not the script's stored texts
  for (const s of ['Your loan in real history', 'What this does not include', 'The lender itself could fail', 'LTV (loan-to-value)', 'Block bootstrap', 'Privacy notice'])
    expect(all, `"${s}"`).toContain(s);
  await context.close();
});

test('structured data: every page says what it is, in its language, with its own address; the check page is a web application', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length, `${p.path}: structured data present`).toBeGreaterThan(0);
    const items = blocks.flatMap((b) => { const j = JSON.parse(b); return j['@graph'] || [j]; }); // must be valid JSON
    const types = items.flatMap((i) => [].concat(i['@type']));
    const self = items.find((i) => i.url === `${SITE}${p.path}`);
    expect(self, `${p.path}: an entry with the page's own address`).toBeTruthy();
    expect(self.inLanguage, `${p.path}: language`).toBe(p.lang);
    if (p.kind === 'check') {
      expect(types, `${p.path}: web application`).toContain('WebApplication');
      const app = items.find((i) => [].concat(i['@type']).includes('WebApplication'));
      expect(app.isAccessibleForFree, 'free').toBe(true);
      expect(app.offers?.price ?? '0', 'price 0').toMatch(/^0/);
    }
    // independence (decision 002): the data names no organisation other than the site and its author
    const text = blocks.join(' ');
    expect(text).toContain('Lennart Bodden');
    expect(text).not.toMatch(/"(sponsor|funder|brand|provider)"/);
  }
});

test('search results: the description names "crypto loan" once (German: "Krypto-Kredit"); the page itself does not', async ({ page }) => {
  for (const [path, re] of [['/', /crypto loan/gi], ['/de/', /Krypto-Kredit/gi]]) {
    await page.goto(path);
    const d = await page.locator('meta[name="description"]').getAttribute('content');
    expect((d.match(re) || []).length, `${path}: once in the description`).toBe(1);
    expect(d.length, `${path}: description length`).toBeLessThanOrEqual(160);
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
    expect((await page.locator('main').innerText()).match(re), `${path}: not in the page's own text`).toBeNull();
  }
});

test('llms.txt: a plain summary for AI assistants that lists all six pages and names no lender', async ({ request }) => {
  const r = await request.get('/llms.txt');
  expect(r.status()).toBe(200);
  const body = await r.text();
  expect(body.startsWith('# Bitcoin Loan Check')).toBe(true);
  for (const p of PAGES) expect(body, p.path).toContain(`${SITE}${p.path}`);
  expect(body).toMatch(/not a forecast/i);
  expect(body).toMatch(/no lender/i);
  // the example's answer, as on the check page (numbers that can be compared agree, decision 007)
  expect(body).toContain(`liquidated in ${exampleAnswer('en')} of 100 simulated price paths`);
  expect(body).toContain(`Liquidation in ${exampleAnswer('de')} von 100 simulierten Zukünften`);
});

// Google reads only the first 2 MB of a page file; the check page is larger. A guard, not a fix: it holds today
// (checked by hand on 27 Oct 2026) and must keep holding when the file grows.
test('the first 2 MB are enough: cut there, the check page still shows the example\'s answer, with scripts and without', async ({ page, browser, baseURL }) => {
  const file = readFileSync(new URL(`../${process.env.E2E_DIR || 'docs'}/index.html`, import.meta.url));
  const cut = file.subarray(0, 2 * 1024 * 1024);
  const n = exampleAnswer('en');
  const serveCut = (pg) => pg.route('**/*', (route) => (new URL(route.request().url()).pathname === '/' ? route.fulfill({ body: cut, contentType: 'text/html; charset=utf-8' }) : route.abort()));
  await serveCut(page);
  await page.goto('/');
  await expect(page.locator('#headline-text em')).toHaveText(String(n)); // as Google sees it: scripts run
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const plain = await context.newPage();
  await serveCut(plain);
  await plain.goto('/');
  await expect(plain.locator('#headline-text')).toContainText(of100('en', n)); // and as a crawler without scripts sees it
  await context.close();
});
