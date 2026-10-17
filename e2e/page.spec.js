// The finished page, used the way a visitor uses it. Outside price services are
// replaced by fixed answers (BTC = 60,000) so results are repeatable, and the
// headline is compared with the engine run directly in Node on the same data.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as job from '../src/app/riskjob.js';
import { encodeState } from '../src/app/share.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';

const ALLOWED = ['127.0.0.1', 'api.coinbase.com', 'api.kraken.com', 'api.binance.com', 'api.coingecko.com', 'www.bitstamp.net'];
const PRICE = 60000;

async function open(page, { lang = 'en', hash = '', offline = false, width } = {}) {
  const hosts = new Set(); const errors = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http')) hosts.add(u.hostname); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https:\/\//, (route) => {
    if (offline) return route.abort();
    const u = route.request().url();
    if (u.includes('api.coinbase.com')) return route.fulfill({ json: { data: { amount: String(PRICE) } } });
    if (u.includes('www.bitstamp.net')) return route.fulfill({ json: { data: { ohlc: [] } } });
    return route.abort();
  });
  if (width) await page.setViewportSize({ width, height: 812 });
  await page.addInitScript((l) => { try { if (!sessionStorage.getItem('set')) { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', l); sessionStorage.setItem('set', '1'); } } catch {} }, lang);
  await page.goto(`/${hash}`);
  await expect(page.locator('#headline-text')).toContainText(/\d+ (of|von) 100/);
  return { hosts, errors };
}
const headlineNumber = async (page) => Number((await page.locator('#headline-text em').textContent()).match(/\d+/)[0]);
const waitDone = (page) => expect(page.locator('#progress')).toBeHidden();

test('loads, shows the answer, and the answer equals the engine run directly (same data, same inputs)', async ({ page }) => {
  const { hosts, errors } = await open(page);
  await waitDone(page);
  const n = await headlineNumber(page);
  // the same example loan, computed in Node with the page's own calculation and the embedded data
  for (const cur of ['EUR']) job.setData(cur, readFileSync(new URL(`../data/btc-${cur.toLowerCase()}-1h.bin.gz`, import.meta.url)).toString('base64'));
  const e = EXAMPLE_FORM;
  const terms = {
    mode: 'new', ltvInput: 'ltv', collateralInput: NaN, currency: 'EUR', btcPrice: PRICE, loanAmount: e.loanAmount, startDate: new Date().toISOString().slice(0, 10),
    durationMonths: e.durationMonths, initialLtv: e.initialLtv / 100, marginCallLtv: e.marginCallLtv / 100, liquidationLtv: e.liquidationLtv / 100,
    rate: { type: 'fixed', annual: e.rateAnnual / 100 }, repayment: e.repayment, compounding: 'none', dayCount: e.dayCount,
    originationFee: { type: 'percent', value: e.originationFee.value / 100 }, liquidationFee: { value: e.liquidationFee / 100, basis: e.liquidationFeeBasis },
    earlyRepaymentFee: 0, curePeriodHours: e.curePeriodHours, marginCallConsequence: e.marginCallConsequence, liquidationSale: e.liquidationSale,
    cureTargetLtv: null, reserveAmount: 0, taxRateNow: 0, taxRateAtMaturity: 0, purpose: 'spend', repayWith: 'sell',
  };
  const meta = JSON.parse((await page.locator('#meta').textContent()));
  const r = await job.run(0, terms, { nPaths: 10000, blockDays: 30, trend: 0 }, meta.garch.EUR, () => {});
  expect(Math.abs(n - Math.round(r.main.pLiquidation * 100))).toBeLessThanOrEqual(1);
  await expect(page.locator('#dots .dots i')).toHaveCount(100);
  await expect(page.locator('#data-period')).toContainText(/Price data: 1 Jan 2014 to \d+ \w+ 20\d\d · last updated/);
  await expect(page.locator('#price-line')).toContainText('Coinbase');
  expect([...hosts].filter((h) => !ALLOWED.includes(h))).toEqual([]);
  expect(errors).toEqual([]);
});

test('the example answer is there the moment the page opens, and the live calculation confirms it', async ({ page }) => {
  await page.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } })
    : route.request().url().includes('www.bitstamp.net') ? route.fulfill({ json: { data: { ohlc: [] } } }) : route.abort()));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', 'en'); } catch {} });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const atOnce = await page.evaluate(() => document.querySelector('#headline-text').textContent);
  expect(atOnce).toMatch(/^\d+ of 100 simulated futures/);
  await waitDone(page);
  expect(await page.locator('#headline-text').textContent()).toBe(atOnce);
  await expect(page.locator('#ans-label')).toHaveText('Example');
  await expect(page.locator('#example-story')).toContainText('Borrow €10,000 for 12 months');
});

test('a lower starting LTV gives a lower answer', async ({ page }) => {
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  await page.locator('#f-initialLtv').fill('30');
  await expect.poll(async () => headlineNumber(page)).toBeLessThan(before);
});

test('the LTV slider changes the starting LTV', async ({ page }) => {
  await open(page); await waitDone(page);
  const slider = page.locator('#ltv-slider');
  await slider.focus();
  await page.keyboard.press('Home'); // slider to the lowest LTV; "change" fires on release
  await slider.dispatchEvent('change');
  await expect(page.locator('#f-initialLtv')).toHaveValue('10');
});

test('impossible terms show a plain-language error and no result', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#f-liquidationLtv').fill('40');
  await expect(page.locator('[data-field="liquidationLtv"] .err')).toContainText('not higher than the starting LTV');
  await expect(page.locator('#error-banner')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/invalid/);
});

test('German: switch language, everything in German', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#lang-btn').click();
  await expect(page.locator('#headline-text')).toContainText('von 100');
  await expect(page.locator('.brand')).toHaveText('Bitcoin-Kredit-Check');
  await expect(page.locator('h1')).toHaveText('Ein unabhängiger Check für jedes Bitcoin-Kreditangebot.');
  await expect(page.locator('#data-period')).toContainText('Kursdaten: 1. Jan. 2014 bis');
});

test('"a loan I already have": LTV today and months left', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await expect(page.locator('#ltv-today')).toContainText('LTV');
  await expect(page.locator('#headline-text')).toContainText('months left');
});

test('"buy more BTC": the result counted in BTC appears', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.getByRole('button', { name: 'Buy more BTC' }).click();
  await waitDone(page);
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#leverage')).toContainText(/In \d+ of 100 futures you end with more BTC/);
});

test('price trend: five fixed trends in "What history says" and in the BTC result', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#sec-history > summary').click();
  await expect(page.locator('#trend-body .lv')).toHaveCount(5);
  await expect(page.locator('#trend-body')).toContainText('+100% a year');
  await expect(page.locator('#trend-body')).toContainText(/With no trend, \d+ of 100 futures end in a sale/);
  await page.getByRole('button', { name: 'Buy more BTC' }).click();
  await waitDone(page);
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#leverage .lv')).toHaveCount(5);
});

test('margin-call rule "sells part at once": the answer mentions partial sales', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('details.more summary').first().click();
  await page.locator('#f-marginCallConsequence').selectOption('autoPartial');
  await expect(page.locator('#headline-text')).toContainText('sells part of it');
});

test('all sections open with their charts; donation QR, Impressum and privacy notice present', async ({ page }) => {
  const { errors } = await open(page); await waitDone(page);
  for (const id of ['sec-falls', 'sec-cost', 'sec-history', 'method', 'sec-feedback']) await page.locator(`#${id} > summary`).click();
  await expect(page.locator('#futures-chart path.path-kept, #futures-chart path.path-sold')).toHaveCount(20);
  await expect(page.locator('#stories-chart path.story')).toHaveCount(4);
  await expect(page.locator('#fan-chart path.band-outer')).toHaveCount(1);
  await expect(page.locator('footer .qr svg')).toHaveCount(1);
  await expect(page.locator('#impressum-body')).toContainText('§ 5 DDG');
  await expect(page.locator('#privacy-body')).toContainText('GitHub Pages');
  expect(errors).toEqual([]);
});

test('shared link restores the inputs, says it was shared, and opens on the answer (phone)', async ({ page }) => {
  await open(page, { width: 375, hash: encodeState({ ...EXAMPLE_FORM, initialLtv: 35, durationMonths: 24 }) });
  await expect(page.locator('#f-initialLtv')).toHaveValue('35');
  await expect(page.locator('#headline-text')).toContainText('24 months');
  await expect(page.locator('#shared-note')).toBeVisible();
  await expect(page.locator('#headline-text')).toBeInViewport();
  await expect(page.locator('#ans-label')).toHaveText('Shared with you');
  // on a phone the terms are folded into a short summary; "Change" opens the form
  await expect(page.locator('#terms-chips')).toContainText('LTV 35%');
  await expect(page.locator('#f-initialLtv')).toBeHidden();
  await page.locator('#terms-toggle').click();
  // once the visitor changes a term, the numbers are their own
  await page.locator('#f-initialLtv').fill('40');
  await expect(page.locator('#shared-note')).toBeHidden();
});

test('without a shared link the page opens at the top, with no "shared" note', async ({ page }) => {
  await open(page); await waitDone(page);
  await expect(page.locator('#shared-note')).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('German address /de/ starts in German; the language button switches the address', async ({ page }) => {
  await page.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } }) : route.abort()));
  await page.goto('/de/');
  await expect(page.locator('h1')).toHaveText('Ein unabhängiger Check für jedes Bitcoin-Kreditangebot.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.locator('#lang-btn').click();
  await expect(page.locator('h1')).toHaveText('An independent check for any Bitcoin loan offer.');
  expect(new URL(page.url()).pathname).toBe('/');
  await page.locator('#lang-btn').click();
  expect(new URL(page.url()).pathname).toBe('/de/');
});

test('Share (desktop): copies a summary with the visitor\'s numbers and the link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page); await waitDone(page);
  const n = await headlineNumber(page);
  await page.locator('#share-btn').click();
  await expect(page.locator('#link-copied')).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain(`Loan offer checked: ${n} of 100 simulated futures end in liquidation within 12 months.`);
  expect(text).toMatch(/\nhttp:\/\/127\.0\.0\.1:8799\/#s=/);
});

test('"Make it safer" shows exactly the headline number for your own terms, and the best option sits under the answer', async ({ page }) => {
  await open(page); await waitDone(page);
  const n = await headlineNumber(page);
  await expect(page.locator('#slider-line')).toContainText(`Starting LTV 50% → ${n} of 100`);
  await expect(page.locator('#safer .lv.base b')).toHaveText(String(n));
  const best = (await page.locator('#best-lever').textContent()).match(/→ (\d+) of 100/);
  expect(best).not.toBeNull();
  expect(Number(best[1])).toBeLessThan(n);
  // it is the first (lowest) option in "Make it safer"
  await expect(page.locator('#safer .lv:not(.base) b').first()).toHaveText(best[1]);
});

test('feedback: the copied e-mail text contains the answers', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page); await waitDone(page);
  await page.locator('#sec-feedback > summary').click();
  await page.locator('label.chip', { hasText: 'Buy more BTC' }).click();
  await page.locator('textarea[data-fb="meaning"]').fill('chance my BTC gets sold');
  await page.locator('[data-fb-copy]').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Use: Buy more BTC');
  expect(text).toContain('Big number means: chance my BTC gets sold');
  expect(text).toContain('(no loan terms attached)');
});

test('phone width 375 px: no sideways scrolling', async ({ page }) => {
  await open(page, { width: 375 }); await waitDone(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('offline: the stored price is used and a clear warning shown', async ({ page }) => {
  await open(page, { offline: true });
  await expect(page.locator('#stale-banner')).toBeVisible();
  await expect(page.locator('#price-line')).toContainText('not current');
});
