// The finished page, used the way a visitor uses it. Outside price services are
// replaced by fixed answers (BTC = 60,000) so results are repeatable, and the
// headline is compared with the engine run directly in Node on the same data.
import { test, expect } from '@playwright/test';
import { openFolded } from './helpers.js';
import { readFileSync } from 'node:fs';
import * as job from '../src/app/riskjob.js';
import { encodeState } from '../src/app/share.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';
import { mkdirSync, writeFileSync } from 'node:fs';

// Coverage measurement (tools/coverage-e2e.mjs): with E2E_COVERAGE set, Chromium records which
// parts of the page's own script each test runs. Off in normal test runs.
if (process.env.E2E_COVERAGE) {
  test.beforeEach(async ({ page }) => { await page.coverage.startJSCoverage({ resetOnNavigation: false }); });
  test.afterEach(async ({ page }, info) => {
    const entries = (await page.coverage.stopJSCoverage()).filter((e) => e.url.startsWith('http://127.0.0.1') && e.source && e.source.length > 100000);
    mkdirSync(process.env.E2E_COVERAGE, { recursive: true });
    writeFileSync(`${process.env.E2E_COVERAGE}/${info.testId}.json`, JSON.stringify(entries.map((e) => ({ source: e.source, functions: e.functions }))));
  });
}

const ALLOWED = ['127.0.0.1', 'www.bitstamp.net', 'api.coinbase.com'];
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
  // any refusal by the page's security rule counts as an error in the tests
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP refused: ${e.violatedDirective} ${e.blockedURI || ''}`)));
  await page.addInitScript((l) => { try { if (!sessionStorage.getItem('set')) { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', l); sessionStorage.setItem('set', '1'); } } catch {} }, lang);
  await page.goto(`/${hash}`);
  await expect(page.locator('#headline-text')).toContainText(/\d+ (of|von) 100/);
  return { hosts, errors };
}
const headlineNumber = async (page) => Number((await page.locator('#headline-text em').textContent()).match(/\d+/)[0]);
// done = the full calculation for the current terms has arrived (also when the instant example was shown first)
const waitDone = async (page) => { await expect(page.locator('#progress')).toBeHidden(); await expect(page.locator('body')).toHaveAttribute('data-ready', '1'); };
// after typing: the answer is marked out of date at once; wait until the new one has fully arrived
const waitFresh = async (page) => { await expect(page.locator('body')).not.toHaveClass(/outdated/); await waitDone(page); };

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

test('"Example" only while every term is the example\'s; while calculating, the answer shows a placeholder, not an empty panel', async ({ page }) => {
  await open(page); await waitDone(page);
  await expect(page.locator('#ans-label')).toHaveText('Example');
  await page.locator('details.more[data-remember="more"] > summary').click();
  await page.locator('[data-set="repayment"][data-val="bullet"]').click(); // a term outside the five main fields
  await expect(page.locator('#ans-label')).toHaveText('Your terms');
  await expect(page.locator('#example-story')).toBeHidden();
  await expect(page.locator('.answer .meta').first()).not.toContainText('· ·');
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
  await page.keyboard.press('Home'); // slider to the lowest LTV; the browser itself sends "change"
  await expect(page.locator('#f-initialLtv')).toHaveValue('10');
});

// A real drag, released like a finger or a mouse lets go, with no help from the test. Safari (every
// browser on an iPhone) sent no "change" on release because the page set the value while dragging,
// so on phones nothing was recalculated; Chrome and Firefox did not show it.
test('LTV slider: dragging and letting go recalculates and sets the starting LTV (also in Safari)', { tag: '@phone' }, async ({ page }) => {
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  const slider = page.locator('#ltv-slider');
  await slider.scrollIntoViewIfNeeded();
  const b = await slider.boundingBox(); const y = b.y + b.height / 2;
  const x0 = b.x + b.width * (Number(await slider.inputValue()) / 1000);
  await page.mouse.move(x0, y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 - i * (b.width / 40), y);
  await page.mouse.up();
  // where the handle lands depends on the drag; what counts: a lower LTV is taken and matches the line
  await expect.poll(async () => Number(await page.locator('#f-initialLtv').inputValue())).toBeLessThan(50);
  await expect(page.locator('#slider-line')).toContainText(`Starting LTV ${await page.locator('#f-initialLtv').inputValue()}%`);
  await expect(page.locator('#slider-undo')).toBeVisible();
  await expect.poll(async () => headlineNumber(page)).toBeLessThan(before);
});

test('LTV slider on a phone: a finger drag recalculates and sets the starting LTV', { tag: '@phone' }, async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  const slider = page.locator('#ltv-slider');
  await slider.scrollIntoViewIfNeeded();
  const b = await slider.boundingBox(); const y = b.y + b.height / 2;
  const x0 = b.x + b.width * (Number(await slider.inputValue()) / 1000);
  const xs = Array.from({ length: 10 }, (_, i) => x0 - (i + 1) * (b.width / 40));
  if (browserName === 'chromium') { // real touch events (only Chrome's engine lets a test send them)
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (const x of xs) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await page.mouse.move(x0, y); await page.mouse.down(); for (const x of xs) await page.mouse.move(x, y); await page.mouse.up(); }
  await expect.poll(async () => Number(await page.locator('#f-initialLtv').inputValue())).toBeLessThan(50);
  await expect.poll(async () => headlineNumber(page)).toBeLessThan(before);
});

test('LTV slider: arrow keys set the starting LTV after a short pause and keep the focus on the slider', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#ltv-slider').focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); // 50% → 45% → 40%
  await expect(page.locator('#f-initialLtv')).toHaveValue('40');
  await waitDone(page);
  await expect(page.locator('#ltv-slider')).toBeFocused();
  await expect(page.locator('#slider-line')).toContainText('Starting LTV 40%');
});

test('LTV slider: each label sits exactly under the handle at its LTV; arrow keys move point by point', async ({ page }) => {
  await open(page); await waitDone(page);
  const slider = page.locator('#ltv-slider');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight'); // 10 → 15 → 20 → 25 → 30
  await expect(page.locator('#slider-line')).toContainText('Starting LTV 30%');
  const handleX = async () => {
    const b = await slider.boundingBox(); const v = Number(await slider.inputValue());
    return b.x + 11 + (v / 1000) * (b.width - 22); // 22 px handle (style.css)
  };
  const labelX = async (txt) => { const b = await page.locator('.ticks span', { hasText: new RegExp(`^${txt}$`) }).boundingBox(); return b.x + b.width / 2; };
  expect(Math.abs((await handleX()) - (await labelX('30%')))).toBeLessThan(1.5);
  await page.keyboard.press('ArrowLeft'); // 25%: exactly halfway between the 20% and 30% labels
  await expect(page.locator('#slider-line')).toContainText('Starting LTV 25%');
  const mid = ((await labelX('20%')) + (await labelX('30%'))) / 2;
  expect(Math.abs((await handleX()) - mid)).toBeLessThan(1.5);
});

test('payment plan: stays open when the terms change, and shows the new plan (interest paid at the end)', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#sec-cost > summary').click();
  await page.locator('#cost-body details summary').click();
  await expect(page.locator('#cost-body tbody tr').first()).toContainText('€83.33');
  await expect(page.locator('#cost-body tbody tr').first().locator('td').nth(4)).toHaveText('€83.33'); // paid every month
  await page.locator('details.more[data-remember="more"] > summary').click();
  await page.locator('[data-set="repayment"][data-val="bullet"]').click();
  await expect(page.locator('#cost-body details')).toHaveAttribute('open', '');
  await expect(page.locator('#cost-body tbody tr').first().locator('td').nth(4)).toHaveText('€0.00'); // nothing paid in month 1
  await expect(page.locator('#cost-body tbody tr').first().locator('td').nth(5)).toHaveText('€10,083.33'); // the debt grows
  // so the sale price rises too: said once, in "What happens when BTC falls"
  await page.locator('#sec-falls > summary').click();
  await expect(page.locator('#sale-line')).toContainText(/the liquidation price rises to €[\d,]+ by the end/);
});

test('impossible terms show a plain-language error and no result', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#f-liquidationLtv').fill('40');
  await expect(page.locator('[data-field="liquidationLtv"] .err')).toContainText('not higher than the starting LTV');
  await expect(page.locator('#error-banner')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/invalid/);
});

const chooseLang = async (page, l) => { await page.locator('#lang-btn').click(); await page.locator(`[data-lang="${l}"]`).click(); };

test('German: switch language, everything in German', async ({ page }) => {
  await open(page); await waitDone(page);
  await chooseLang(page, 'de');
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
  await expect(page.locator('#lev-sizes')).toContainText(/middle value of each group, in BTC compared with not borrowing: more BTC \+0\.\d{4} BTC, less but not liquidated −0\.\d{4} BTC, liquidated −0\.\d{4} BTC/);
});

test('history section: real history first, a sentence linking it to the answer, the trend table folded; trends also for the BTC result', async ({ page }) => {
  await open(page); await waitDone(page);
  const n = await headlineNumber(page);
  await page.locator('#sec-history > summary').click();
  await expect(page.locator('#history-text')).toContainText(/Started on any day since 2014, this exact loan would have been liquidated \d+ times in 100/);
  await expect(page.locator('#history-text')).toContainText(`The answer at the top says ${n}. The difference: real history includes BTC's strong rise`);
  await expect(page.locator('#trend-body')).toBeHidden(); // folded, one level deeper
  await page.locator('#trend-details > summary').click();
  await expect(page.locator('#trend-body .lv')).toHaveCount(5);
  await expect(page.locator('#trend-body .lv.base b')).toHaveText(String(n)); // "the answer above" really is the answer above
  await expect(page.locator('#trend-body')).toContainText(/even at \+100% a year, \d+ of 100 futures still end in liquidation/);
  // the method justification is on the "How it works" page (e2e/site.spec.js)
  await page.getByRole('button', { name: 'Buy more BTC' }).click();
  await waitDone(page);
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#leverage .lv')).toHaveCount(5);
});

test('partial sales count as liquidated: the big number counts every forced sale and says how many were full (UAT finding 1)', async ({ page }) => {
  test.setTimeout(240_000); // several 36-month calculations
  await open(page); await waitDone(page);
  await page.locator('details.more summary').first().click();
  await page.locator('#f-marginCallConsequence').selectOption('warningOnly');
  await openFolded(page, '#form'); // the form was rebuilt by the change
  await page.locator('#form [data-set="liquidationSale"][data-val="partial"]').click();
  await page.locator('[data-set="durationMonths"][data-val="36"]').click();
  await waitDone(page);
  await expect(page.locator('#headline-text')).toContainText(/liquidated in full or in part within 36 months; \d+ of them in full\./);
  // the big number = the red and the orange dots, never a big 0 next to many partial sales
  const big = Number(await page.locator('#headline-text em').textContent());
  const dots = await page.locator('#dots .dots i.d-liq').count() + await page.locator('#dots .dots i.d-part').count();
  expect(big).toBe(dots);
  expect(big).toBeGreaterThan(30);
  await expect(page.locator('#methods-line')).not.toContainText('real history since 2014 0 of 100');
  // the same number in a comparison and in "Make it safer" (your terms as they are)
  await expect(page.locator('#safer .lv.base b')).toHaveText(String(big));
  await page.locator('#compare-btn').click(); await waitDone(page);
  await expect(page.locator('#cmp tbody tr').first().locator('td').nth(0)).toContainText(String(big));
});

test('all sections open with their charts; donation QR, Impressum and privacy notice present', async ({ page }) => {
  const { errors } = await open(page); await waitDone(page);
  for (const id of ['sec-falls', 'sec-cost', 'sec-history', 'sec-feedback']) await page.locator(`#${id} > summary`).click();
  await expect(page.locator('#futures-chart path.path-kept, #futures-chart path.path-sold')).toHaveCount(20);
  await expect(page.locator('#stories-chart path.story')).toHaveCount(4);
  await expect(page.locator('footer .qr svg')).toHaveCount(1);
  await expect(page.locator('#impressum-body')).toContainText('§ 5 DDG');
  await expect(page.locator('#privacy-body')).toContainText('Cloudflare Pages');
  expect(errors).toEqual([]);
});

test('shared link restores the inputs, says it was shared, and opens on the answer (phone)', { tag: '@phone' }, async ({ page }) => {
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
  await chooseLang(page, 'en');
  await expect(page.locator('h1')).toHaveText('An independent check for any Bitcoin loan offer.');
  expect(new URL(page.url()).pathname).toBe('/');
  await chooseLang(page, 'de');
  expect(new URL(page.url()).pathname).toBe('/de/');
});

test('language menu: shows the current language, lists both with a tick, offers "Your language is missing?", closes with Escape', async ({ page }) => {
  await open(page);
  const btn = page.locator('#lang-btn');
  await expect(btn).toContainText('EN');
  await expect(page.locator('#lang-list')).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-lang="en"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-lang="de"]')).toHaveAttribute('aria-current', 'false');
  await expect(page.locator('#lang-missing')).toHaveAttribute('href', /^mailto:boddenlennart@proton\.me\?subject=Language%20request/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lang-list')).toBeHidden();
  await expect(btn).toBeFocused();
  // choosing the current language changes nothing; a click elsewhere closes the menu
  await btn.click(); await page.locator('h1').click();
  await expect(page.locator('#lang-list')).toBeHidden();
  await chooseLang(page, 'de');
  await expect(btn).toContainText('DE');
});

test('Share (desktop): copies a summary with the visitor\'s numbers and the link', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'reading the clipboard is only possible in Chromium\'s test mode');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page); await waitDone(page);
  const n = await headlineNumber(page);
  await page.locator('#share-btn').click();
  await expect(page.locator('#link-copied')).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain(`Loan offer checked: ${n} of 100 simulated futures end in liquidation within 12 months.`);
  expect(text).toMatch(/\nhttp:\/\/127\.0\.0\.1:\d+\/#s=/);
});

test('"Make it safer" shows exactly the headline number for your own terms, and the best option sits under the answer', async ({ page }) => {
  await open(page); await waitDone(page);
  const n = await headlineNumber(page);
  await expect(page.locator('#slider-line')).toContainText(`Starting LTV 50% → ${n} of 100`);
  await expect(page.locator('#safer .lv.base b')).toHaveText(String(n));
  const best = (await page.locator('#best-lever').textContent()).match(/One change lowers this: (.+) → (\d+) of 100/);
  expect(best).not.toBeNull();
  expect(Number(best[2])).toBeLessThan(n);
  // it is one of the options in "Make it safer", with the same number (the smallest step that clearly helps,
  // not necessarily the lowest one: owner, 21 Oct 2026)
  await expect(page.locator('#safer .lv:not(.base)').filter({ hasText: best[1] }).locator('b')).toHaveText(best[2]);
  const all = (await page.locator('#safer .lv:not(.base) b').allTextContents()).map(Number);
  expect(all).toEqual([...all].sort((a, b) => a - b)); // the list still goes from lowest to highest
  // fairness: the top-up assumption and the two other methods are shown with the answer
  await expect(page.locator('#assume-line')).toHaveText('Assumes you add no BTC or money after a margin call.');
  await expect(page.locator('#methods-line')).toContainText(/Other methods: real history since 2014 \d+ of 100, a volatility model \d+ of 100/);
  // what a sale leaves: not "everything lost"
  await expect(page.locator('#sold-line')).toContainText(/If liquidated: you get back about 0\.\d{4} of your 0\.\d{4} BTC/);
  await expect(page.locator('#tiles')).toContainText('Beats selling if');
  await expect(page.locator('#tiles')).toContainText('effective 11.6% a year');
});

test('feedback: the copied e-mail text contains the answers', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'reading the clipboard is only possible in Chromium\'s test mode');
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

test('first phone screen (375 x 812): name, headline, trust line and the answer with its number, in ink not red', { tag: '@phone' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page); await waitDone(page);
  for (const sel of ['.brand', 'h1', '.trust', '#headline-text .hero-n', '#headline-text .sentence', '#dots']) {
    const box = await page.locator(sel).boundingBox();
    expect(box, sel).not.toBeNull();
    expect(box.y + box.height, `${sel} ends below the first screen`).toBeLessThanOrEqual(812);
  }
  const [hero, text] = await page.evaluate(() => [getComputedStyle(document.querySelector('.hero-n')).color, getComputedStyle(document.body).color]);
  expect(hero).toBe(text);
});

test('Swiss francs: the answer is computed from the euro history converted with ECB rates', async ({ page }) => {
  const { hosts } = await open(page); await waitDone(page);
  const eur = await headlineNumber(page);
  await page.locator('select.cur').selectOption('CHF');
  await expect(page.locator('#price-line')).toContainText(/CHF\s[\d,]+ .*Coinbase \(EUR × ECB\)/); // the euro price × the ECB rate, like the history
  await waitDone(page);
  await expect(page.locator('#tiles')).toContainText('CHF');
  const chf = await headlineNumber(page);
  expect(Math.abs(chf - eur)).toBeLessThanOrEqual(3);
  // no new outside addresses: the rates are inside the page
  for (const h of hosts) expect(ALLOWED, h).toContain(h);
});

test('compare offers: B next to A on the same futures; each column equals that offer\'s own answer; no winner marked', async ({ page, browserName }) => {
  await open(page); await waitDone(page);
  const a = await headlineNumber(page);
  await page.locator('#compare-btn').click();
  await expect(page.locator('#ans-label')).toHaveText('Offer B');
  await page.locator('#f-initialLtv').fill('35');
  await page.locator('#f-liquidationLtv').fill('85');
  await waitDone(page);
  const b = await headlineNumber(page);
  expect(b).toBeLessThan(a);
  const cells = page.locator('#cmp tbody tr').first().locator('td .big');
  await expect(cells).toHaveText([String(a), String(b)]);
  await expect(page.locator('#cmp')).toContainText('No offer is marked as better');
  await expect(page.locator('#showing')).toContainText('Offer B');
  // selecting A shows A's full answer below, with the same number as in the table
  await page.locator('#cmp [data-offer="0"]').click();
  await waitDone(page);
  expect(await headlineNumber(page)).toBe(a);
  await expect(page.locator('#f-initialLtv')).toHaveValue('50');
  // a shared link brings the whole comparison back (clipboard readable only in Chromium's test mode)
  if (browserName !== 'chromium') return;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#share-btn').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain(`Loan offers compared, liquidated within the term, of 100: Offer A ${a}, Offer B ${b}.`);
  const link = text.split('\n').at(-1);
  const p2 = await page.context().newPage();
  await p2.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } }) : route.abort()));
  await p2.goto(link.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''));
  await expect(p2.locator('#cmp tbody tr').first().locator('td .big')).toHaveText([String(a), String(b)]);
});

test('refinancing: current loan vs. a cash-out offer, compared over the same months', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000');
  await page.locator('#f-collateralBtc').fill(String(+(10000 / (0.5 * PRICE)).toFixed(4)));
  await page.locator('[data-field="durationMonths"] input').fill('8');
  await waitDone(page);
  await expect(page.locator('#compare-btn')).toHaveText('+ Compare with a refinancing offer');
  const started = Date.now();
  await page.locator('#compare-btn').click();
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('2000');
  await page.locator('[data-set="durationMonths"][data-val="24"]').click();
  await expect(page.locator('#ltv-today')).toContainText('New loan: €12,000');
  await waitDone(page);
  expect(Date.now() - started, 'set up within 60 s (test plan T6) — here typed by the test, so far faster').toBeLessThan(60_000);
  const rows = page.locator('#cmp tbody tr');
  await expect(rows.nth(0)).toContainText('next 8 months, both');
  await expect(rows.nth(1)).toContainText('whole new term, 24 months');
  const [cur, refiSpan] = await rows.nth(0).locator('td .big').allTextContents();
  const whole = await rows.nth(1).locator('td .big').textContent();
  // more debt on the same BTC: never safer over the same months; a longer loan: never safer over its whole term
  expect(Number(refiSpan)).toBeGreaterThanOrEqual(Number(cur));
  expect(Number(whole)).toBeGreaterThanOrEqual(Number(refiSpan));
  expect(Number(whole)).toBe(await headlineNumber(page));
  await expect(rows.filter({ hasText: 'At the start' })).toContainText('You receive €2,000');
  // too much extra cash: the new loan would start in a margin call; the reason is shown at once
  await page.locator('#f-refiExtra').fill('5000');
  await expect(page.locator('#ltv-today')).toContainText('starting LTV');
  await expect(page.locator('#error-banner')).toBeVisible();
});

test('refinancing: switching costs, BTC taken back and different lengths are shown where the visitor looks', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000');
  await waitDone(page);
  await page.locator('#compare-btn').click();
  await expect(page.locator('#form')).toContainText('The terms below start as a copy of your current loan.');
  // the slider cannot change a refinancing: it is replaced by a pointer to "What changes?"
  await expect(page.locator('#ltv-slider')).toBeHidden();
  await expect(page.locator('#safer')).toContainText('Change this in your terms under "What changes?"');
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('2000');
  await page.locator('#form details[data-remember="switch"] summary').click();
  await page.locator('#f-refiExitFee').fill('200');
  await waitDone(page);
  const start = page.locator('#cmp tbody tr').filter({ hasText: 'At the start' });
  await expect(start).toContainText('You receive €1,800');
  // the cost of the refinancing includes the switching costs everywhere: table, tile and "What it costs"
  const cost = page.locator('#cmp tbody tr').filter({ hasText: 'Full cost' });
  await expect(cost).toContainText('€1,400');
  await expect(cost).toContainText('interest, 12 months left');
  await expect(page.locator('#tiles')).toContainText('€1,400');
  await expect(page.locator('#cost-body')).toContainText('Of the new loan of €12,000.00, €10,000.00 repays your current loan. At the start: you receive €1,800.00.');
  await expect(page.locator('#cost-body')).toContainText('The new loan costs €1,400.00 if nothing goes wrong, switching costs included');
  await expect(page.locator('#cost-body')).toContainText('Keeping the loan only beats selling BTC today');
  await expect(page.locator('#cmp tbody tr').filter({ hasText: 'Interest rate' })).toBeVisible();
  // BTC taken back is shown with the money paid at the start
  await page.locator('[data-set="refi.change"][data-val="back"]').click();
  await page.locator('#f-refiBack').fill('0.03');
  await expect(start).toContainText('You get 0.0300 BTC back, you pay €200');
  // a shorter new loan: its number is marked as covering only its own months
  await page.locator('[data-set="durationMonths"][data-val="6"]').click();
  await waitDone(page);
  await expect(page.locator('#cmp tbody tr').first()).toContainText('only its 6 months');
  await expect(page.locator('#cmp .meta')).toContainText('The new loan runs 6 months, 12 are left on the current one.');
  await page.locator('[data-set="durationMonths"][data-val="24"]').click();
  await expect(page.locator('#cmp .meta')).toContainText('Its full cost covers all 24 months, the current loan\'s only 12.');
});

test('phone: while typing the terms, a bar shows the answer and the number before the change; "See the answer" scrolls up', { tag: '@phone' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  await page.locator('#own-terms-link').click();
  await page.locator('#f-initialLtv').fill('35');
  await waitDone(page);
  const bar = page.locator('#answer-bar');
  await expect(bar).toBeVisible();
  const now = await headlineNumber(page);
  expect(now).toBeLessThan(before);
  await expect(bar).toContainText(`${now} of 100 liquidated (was ${before})`);
  await page.locator('#answer-bar-btn').click();
  await expect(page.locator('#headline-text')).toBeInViewport();
  await expect(bar).toBeHidden(); // the answer is in view again
});

test('slider: releasing it says what changed, and Undo brings the old terms back', { tag: '@phone' }, async ({ page }) => {
  await open(page); await waitDone(page);
  const slider = page.locator('#ltv-slider');
  await slider.focus();
  await page.keyboard.press('Home'); // the browser itself sends "change", as for a real visitor
  await expect(page.locator('#slider-undo')).toContainText('Your starting LTV is now 10%.');
  await expect(page.locator('#f-initialLtv')).toHaveValue('10');
  await page.locator('#slider-undo-btn').click();
  await expect(page.locator('#f-initialLtv')).toHaveValue('50');
  await expect(page.locator('#slider-undo')).toBeHidden();
});

test('phone width 375 px: no sideways scrolling', { tag: '@phone' }, async ({ page }) => {
  await open(page, { width: 375 }); await waitDone(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('offline: the stored price is used and a clear warning shown', async ({ page }) => {
  await open(page, { offline: true });
  await expect(page.locator('#stale-banner')).toBeVisible();
  await expect(page.locator('#price-line')).toContainText('not current');
});


// ------------------------------------------------------------------ hostile input and broken environments

test('a manipulated share link cannot inject code: offer names with HTML are shown as plain text', async ({ page }) => {
  const evil = '<img src=x onerror="window.__hacked=1">';
  const hash = encodeState(EXAMPLE_FORM, { kind: 'offers', active: 0, names: [evil, '<b>B</b>'], offers: [EXAMPLE_FORM, { ...EXAMPLE_FORM, initialLtv: 35 }] });
  const { errors } = await open(page, { hash });
  await expect(page.locator('#cmp')).toContainText('<img src=x');
  expect(await page.locator('#cmp img, #answer img').count()).toBe(0);
  expect(await page.evaluate(() => window.__hacked)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('a share link with nonsense values opens the page with an explanation, not a crash', async ({ page }) => {
  const hash = encodeState({ ...EXAMPLE_FORM, initialLtv: -5, loanAmount: 'abc', durationMonths: 9999, currency: 'XYZ' });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } }) : route.abort()));
  await page.goto(`/${hash}`);
  // the page stays usable: currency falls back to a known one, impossible terms are explained at the fields
  await expect(page.locator('select.cur')).not.toHaveValue('XYZ');
  await expect(page.locator('#error-banner')).toBeVisible();
  await expect(page.locator('[data-field="initialLtv"] .err')).toBeVisible();
  expect(errors).toEqual([]);
});

test('corrupted saved inputs: the page starts from the example instead of breaking', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('btc-loan-risk:remember', '1'); localStorage.setItem('btc-loan-risk:form', '{"state": "nonsense", "compare": {"kind": 7}}'); localStorage.setItem('btc-loan-risk:lang', 'en'); } catch {} });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } }) : route.abort()));
  await page.goto('/');
  await expect(page.locator('#headline-text')).toContainText(/\d+ of 100/);
  expect(errors).toEqual([]);
});

test('browser storage blocked (private mode): the page still works', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } }) : route.abort()));
  await page.goto('/');
  await expect(page.locator('#headline-text')).toContainText(/\d+ of 100/);
  await page.locator('#own-terms-link').click();
  await page.locator('#f-initialLtv').fill('35');
  await waitDone(page);
  expect(errors).toEqual([]);
});

test('background calculation blocked: the page calculates directly and shows the same answer', async ({ page }) => {
  await open(page, { hash: '#no-worker' }); await waitDone(page);
  const direct = await headlineNumber(page);
  const p2 = await page.context().newPage();
  await p2.route(/^https:\/\//, (route) => (route.request().url().includes('api.coinbase.com') ? route.fulfill({ json: { data: { amount: String(PRICE) } } }) : route.abort()));
  await p2.goto('/');
  await expect(p2.locator('#progress')).toBeHidden();
  expect(Number((await p2.locator('#headline-text em').textContent()).match(/\d+/)[0])).toBe(direct);
});

test('garbled recent price hours from the exchange are ignored', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', 'en'); } catch {} });
  await page.route(/^https:\/\//, (route) => {
    const u = route.request().url();
    if (u.includes('api.coinbase.com')) return route.fulfill({ json: { data: { amount: String(PRICE) } } });
    if (u.includes('www.bitstamp.net')) return route.fulfill({ json: { data: { ohlc: [{ timestamp: 'x', open: -1, high: 'NaN', low: 0, close: 1e30 }, { nonsense: true }] } } });
    return route.abort();
  });
  await page.goto('/');
  await expect(page.locator('#headline-text')).toContainText(/\d+ of 100/);
  await waitDone(page);
  expect(errors).toEqual([]);
});

test('comparison: a third offer, removing one, ending it; a refinancing offer kept on its own becomes a normal loan', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#compare-btn').click();
  await page.locator('[data-compare-add]').click();
  await expect(page.locator('#cmp thead button.col')).toHaveText(['Offer A', 'Offer B', 'Offer C']);
  await page.locator('#f-loanAmount').fill('15000'); // C differs from A
  await page.locator('[data-compare-remove]').click(); // removes the selected one (C)
  await expect(page.locator('#cmp thead button.col')).toHaveText(['Offer A', 'Offer B']);
  await expect(page.locator('#f-loanAmount')).toHaveValue('10000'); // A keeps its own terms, not C's
  await page.locator('[data-compare-keep="0"]').click();
  await expect(page.locator('#cmp')).toBeHidden();
  await expect(page.locator('#compare-btn')).toBeVisible();
  // refinancing: end the comparison while the refinancing offer is selected
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000');
  await page.locator('#f-collateralBtc').fill('0.4');
  await waitDone(page);
  await page.locator('#compare-btn').click();
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('1000');
  await page.locator('[data-compare-keep="1"]').click(); // keep the refinanced loan
  // kept on its own, the refinancing becomes a new loan entered by BTC: 10,000 + 1,000 against 0.4 BTC
  await expect(page.locator('#f-loanAmount')).toHaveValue('11000');
  await expect(page.locator('#f-collateralBtc')).toHaveValue('0.4');
  await expect(page.locator('#tiles')).toContainText('Liquidated at');
});

test('a loan already running: past its margin call, only what the borrower can do, no "buy more BTC"', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await expect(page.locator('#form')).not.toContainText('What will you do with the money?');
  await page.locator('#f-loanAmount').fill('15000'); // against 0.3333 BTC at 60,000: LTV 75%, margin call at 70%
  await waitDone(page);
  await expect(page.locator('#now-note')).toContainText('Your LTV today (75%) is already above the margin call at 70%.');
  await expect(page.locator('#tiles')).toContainText('already reached today');
  await page.locator('#sec-falls > summary').click();
  await expect(page.locator('#falls-text')).toContainText('Your loan is already past its margin call: at today\'s price');
  await expect(page.locator('#falls-text')).not.toContainText('−-');
  await expect(page.locator('#safer')).toContainText('add BTC or repay part');
  await expect(page.locator('#safer')).not.toContainText('Liquidation LTV 90%');
  await expect(page.locator('#safer')).not.toContainText('Starting LTV');
  await expect(page.locator('#questions-title')).not.toContainText('Before you sign');
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#cost-body')).toContainText('Keeping the loan only beats selling BTC today');
  await expect(page.locator('#cost-body')).not.toContainText('The yearly rate including fees');
  await page.locator('#f-loanAmount').fill('10000');
  await expect(page.locator('#now-note')).toBeHidden();
});

test('edge cases: one month, a very long loan, too little BTC, a higher tax today, nothing left after a liquidation, an absurd fee', async ({ page }) => {
  test.setTimeout(300_000); // a 10- and a 17-year loan take about 25 and 35 seconds to calculate
  const { errors } = await open(page); await waitDone(page);
  await page.locator('[data-field="durationMonths"] input').fill('1');
  await expect(page.locator('#headline-text')).toContainText('within 1 month.');
  // longer than the real prices since 2014 allow for the four real years: a note, no broken chart
  await page.locator('[data-field="durationMonths"] input').fill('120');
  await expect(page.locator('#progress')).toBeHidden({ timeout: 180_000 });
  await page.locator('#sec-history > summary').click();
  await expect(page.locator('#stories-legend')).toContainText('none of these real years can be followed to its end');
  await expect(page.locator('#history-text')).toContainText('rests on few separate periods');
  await page.locator('[data-field="durationMonths"] input').fill('200'); // longer than all the data
  await expect(page.locator('#progress')).toBeHidden({ timeout: 180_000 });
  await expect(page.locator('#history-text')).toContainText('cannot be replayed on them');
  await expect(page.locator('#methods-line')).toContainText('Other method: a volatility model');
  await page.locator('[data-set="durationMonths"][data-val="12"]').click();
  await waitDone(page);
  // too little BTC: the real reason, once
  await page.locator('[data-set="ltvInput"][data-val="btc"]').click();
  await page.locator('#f-collateralBtc').fill('0.01');
  await expect(page.locator('[data-field="collateralBtc"] .err')).toHaveText(/^With this little BTC, the loan is larger than the value of the BTC/);
  await page.locator('#f-collateralBtc').fill('');
  await expect(page.locator('[data-field="collateralBtc"] .err')).toHaveText(/^The amount of BTC pledged must be a number above zero\. Enter the BTC amount, for example 0\.25\.\s*$/);
  await page.locator('#f-collateralBtc').fill('0.3333');
  await waitDone(page);
  // a higher tax today than later: BTC may even fall
  await page.locator('#sec-cost > summary').click();
  await page.locator('#cost-body [data-k="taxRateNow"]').fill('40');
  await expect(page.locator('#breakeven-line')).toContainText('BTC may be up to 33.3% lower at the end');
  await page.locator('#cost-body [data-k="taxRateNow"]').fill('0');
  // a liquidation fee that leaves nothing; an absurd origination fee
  await page.locator('#form details[data-remember="more"] summary').click();
  await page.locator('#form [data-k="liquidationFeeBasis"]').selectOption('collateralSold');
  await page.locator('#f-liquidationFee').fill('20');
  await expect(page.locator('#sold-line')).toContainText('you get nothing back');
  await page.locator('#f-originationFee').fill('99');
  await expect(page.locator('#tiles')).toContainText('effective > 1,000% a year');
  expect(errors).toEqual([]);
});

test('cost including the risk: in "What it costs", in the comparison of offers and of a refinancing, in both languages', async ({ page }) => {
  const { errors } = await open(page); await waitDone(page);
  // the "Full cost" tile shows the same with the liquidation risk; a tap opens the explanation
  const tileLine = page.locator('#tiles a.tile-risk');
  await expect(tileLine).toHaveText(/^with the liquidation risk:\s*about €[\d,]+ · [\d.]+%\sa\syear$/);
  const tileTotal = (await tileLine.textContent()).match(/about (€[\d,]+)/)[1];
  await tileLine.click();
  await expect(page.locator('#sec-cost')).toHaveAttribute('open', '');
  await expect(page.locator('#risk-cost h4')).toBeInViewport();
  // the heading lands below the sticky top bar, not hidden behind it
  const below = await page.evaluate(() => document.querySelector('#risk-cost h4').getBoundingClientRect().top - document.querySelector('.top').getBoundingClientRect().bottom);
  expect(below).toBeGreaterThanOrEqual(4);
  const block = page.locator('#risk-cost');
  await expect(block).toContainText(`Including the liquidation risk: about ${tileTotal} (`);
  await expect(block).toContainText(/Including the liquidation risk: about €[\d,]+ \(about [\d.]+% a year instead of 11\.6%\)\./);
  await expect(block).toContainText(/In \d+ of 100 futures it is zero/);
  await expect(block.locator('a')).toHaveAttribute('href', /method\/#risk-cost$/);
  // a comparison of offers: one row with a value and a yearly figure per offer
  await page.locator('#compare-btn').click();
  await page.locator('#f-rateAnnual').fill('6');
  await waitDone(page);
  const row = page.locator('#cmp tbody tr').filter({ hasText: 'Cost incl. liquidation risk' });
  await expect(row.locator('td')).toHaveCount(2);
  await expect(row.locator('td').nth(0)).toContainText(/€[\d,]+about [\d.]+% a year/);
  await expect(row.locator('td').nth(1)).toContainText(/€[\d,]+about [\d.]+% a year/);
  // the same loan at a lower rate: the same risk, so less in total
  const val = async (i) => Number((await row.locator('td').nth(i).evaluate((el) => el.firstChild.textContent)).replace(/[^\d]/g, ''));
  expect(await val(1)).toBeLessThan(await val(0));
  await page.locator('[data-compare-keep="0"]').click();
  // a refinancing: the current loan over its months left, the new loan over its term
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000');
  await waitDone(page);
  await expect(block).toContainText(/Including the liquidation risk: about €[\d,]+ for the 12 months left, instead of €999\.96 interest\./);
  await expect(tileLine).toHaveText(/^with the liquidation risk:\s*about €[\d,]+$/); // no yearly rate for a loan already running
  await page.locator('#compare-btn').click();
  await waitDone(page);
  await expect(page.locator('#cmp tbody tr').filter({ hasText: 'Cost incl. liquidation risk' }).locator('td')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('refinancing to buy more BTC: the extra cash is compared, future by future, with the same refinancing without it', async ({ page }) => {
  const { errors } = await open(page); await waitDone(page);
  // a loan taken when BTC was at 30,000 (LTV 40%), two months left; BTC has doubled to 60,000
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#form [data-k="currency"]').selectOption('USD');
  await page.locator('#f-loanAmount').fill('10000');
  await page.locator('#f-collateralBtc').fill('0.8333');
  await page.locator('[data-field="durationMonths"] input').fill('2');
  await waitDone(page);
  await page.locator('#compare-btn').click();
  await expect(page.locator('#form')).not.toContainText('What will you do with the extra cash?'); // only when borrowing more
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('5000');
  await expect(page.locator('#refi-note')).toContainText('Starting LTV 30%, up from 20% today. Check that this is within your lender\'s maximum starting LTV.');
  await page.locator('[data-set="durationMonths"][data-val="12"]').click();
  await page.locator('[data-set="purpose"][data-val="buy"]').click();
  await waitDone(page);
  // the extra US$5,000 buys 0.0833 BTC and costs US$500 interest a year: it pays off above +10%
  await expect(page.locator('#tiles')).toContainText(/PAYS OFF IF\s*BTC \+10%/i);
  await page.locator('#sec-cost > summary').click();
  const lev = page.locator('#leverage');
  await expect(lev).toContainText('With the extra US$5,000 you buy 0.0833 BTC today. Compared below: the same refinancing without the extra cash.');
  await expect(lev).toContainText(/In \d+ of 100 futures you end with more BTC than without the extra cash\./);
  await expect(lev).toContainText('Breakeven: BTC must be 10.0% higher at the end');
  await expect(lev).not.toContainText('Does the price trend matter here?');
  // back to the same amount: the question and the leverage view go away
  await page.locator('[data-set="refi.change"][data-val="same"]').click();
  await expect(page.locator('#form')).not.toContainText('What will you do with the extra cash?');
  await waitDone(page);
  await expect(page.locator('#sec-cost-title')).toContainText('Borrow or sell?');
  expect(errors).toEqual([]);
});

test('"Compare an offer" scrolls up to the table once; while the new offer is calculated, nothing moves (computer and phone)', { tag: '@phone' }, async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page); await waitDone(page);
    const btn = page.locator('#compare-btn');
    await btn.scrollIntoViewIfNeeded();
    // record the table's position from the click until the new offer's answer has arrived
    await page.evaluate(() => {
      window.rec = [];
      window.sampler = setInterval(() => { const c = document.querySelector('#cmp'); if (!c.hidden) window.rec.push([performance.now(), Math.round(c.getBoundingClientRect().top), Math.round(window.scrollY)]); }, 20);
    });
    await btn.click();
    // the one wanted scroll: the table's top lands just below the sticky top bar
    await expect.poll(async () => page.evaluate(() => document.querySelector('#cmp').getBoundingClientRect().top - document.querySelector('.top').getBoundingClientRect().bottom), { timeout: 5000 }).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => page.evaluate(() => document.querySelector('#cmp').getBoundingClientRect().top - document.querySelector('.top').getBoundingClientRect().bottom), { timeout: 5000 }).toBeLessThanOrEqual(30);
    await expect(page.locator('#cmp')).toBeFocused();
    // the smooth scroll has ended once the table stood still for 300 ms (slower computers need longer)
    await expect.poll(() => page.evaluate(() => { const r = window.rec.slice(-15); return r.length === 15 && r.every((x) => x[1] === r[0][1]); }), { timeout: 10000 }).toBe(true);
    const settled = await page.evaluate(() => window.rec[window.rec.length - 15][0]);
    await waitDone(page);
    await expect(page.locator('#cmp tbody tr').filter({ hasText: 'Cost incl. liquidation risk' }).locator('td').nth(1)).toContainText('€');
    const rec = await page.evaluate(() => { clearInterval(window.sampler); return window.rec; });
    const after = rec.filter(([t]) => t > settled).map((r) => r[1]);
    expect(after.length).toBeGreaterThan(3);
    expect(Math.max(...after) - Math.min(...after), `${width} px: table top after the scroll at ${[...new Set(after)].join(', ')}`).toBeLessThanOrEqual(2);
    if (width === 1280) await expect(page.locator('#f-loanAmount')).toBeInViewport(); // the terms stay beside the table
    await page.locator('[data-compare-keep="0"]').click();
  }
});

test('opening on a slow phone: nothing jumps while a page is drawn, on all three pages (layout shift below 0.1, UAT finding 3, go/no-go G2)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'slowing the processor needs Chromium');
  await page.setViewportSize({ width: 375, height: 812 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await open(page); await waitDone(page);
  await expect(page.locator('main')).toBeVisible();
  expect(await page.evaluate(() => window.__cls), '/').toBeLessThan(0.1);
  for (const path of ['/method/', '/insights/']) {
    await page.goto(path); await expect(page.locator('body')).toHaveAttribute('data-ready', '1'); await page.waitForTimeout(300);
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => window.__cls), path).toBeLessThan(0.1);
  }
});

test('a slow connection: the example answer shows before the price history has arrived, and the first calculation waits for it (go/no-go G1)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'controlling the connection needs Chromium');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // about 1.6 Mbit/s, as Lighthouse's slow mobile connection: the page (1.7 MB) takes several seconds
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 });
  await page.route(/^https:\/\//, (r) => (r.request().url().includes('coinbase') ? r.fulfill({ json: { data: { amount: '60000' } } }) : r.request().url().includes('bitstamp') ? r.fulfill({ json: { data: { ohlc: [] } } }) : r.abort()));
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#headline-text em')).toHaveText('54', { timeout: 20_000 });
  const answerAfter = Date.now() - t0;
  const dataThere = await page.evaluate(() => !!document.getElementById('data-FX'));
  expect(dataThere, 'the answer showed before the history had arrived').toBe(false);
  // the history arrives, then the page confirms the example with today's price, without errors
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 60_000 });
  expect(errors).toEqual([]);
  expect(answerAfter).toBeLessThan(5_000);
});

test('a share link that cannot be read says so instead of silently showing the example (UAT finding 9)', async ({ page }) => {
  await open(page, { hash: '#s=%%%broken' }); await waitDone(page);
  await expect(page.locator('#link-note')).toHaveText('This link could not be read, so the example is shown. Ask for a new link, or enter the terms yourself.');
  await page.locator('#own-terms-link').click(); await page.locator('#f-loanAmount').fill('12000');
  await expect(page.locator('#link-note')).toBeHidden(); // the visitor's own terms now
  const fourOffers = '#s=' + Buffer.from(JSON.stringify({ v: 1, loanAmount: '20000', compare: { kind: 'offers', active: 0, names: [], offers: [{}, {}, {}, {}] } })).toString('base64url');
  await page.goto('about:blank'); await open(page, { hash: fourOffers }); await waitDone(page);
  await expect(page.locator('#link-note')).toHaveText('The comparison in this link could not be read, so only one offer is shown.');
  await expect(page.locator('#f-loanAmount')).toHaveValue('20000');
  const fine = '#s=' + Buffer.from(JSON.stringify({ v: 1, loanAmount: '20000' })).toString('base64url');
  await page.goto('about:blank'); await open(page, { hash: fine }); await waitDone(page);
  await expect(page.locator('#link-note')).toBeHidden();
});

test('screen readers: the tiles are a list, every "?" says what it explains, the tile link moves the focus (UAT finding 8)', async ({ page }) => {
  await open(page); await waitDone(page);
  const items = page.locator('#tiles[role="list"] > [role="listitem"]');
  expect(await items.count()).toBe(await page.locator('#tiles .tile').count());
  await expect(page.locator('#answer button.q')).toHaveAttribute('aria-label', 'More about this number');
  await expect(page.locator('#sec-falls button.q')).toHaveAttribute('aria-label', 'More: 20 possible futures');
  for (const b of await page.locator('main button.q').all()) expect(await b.getAttribute('aria-label')).not.toBe('More');
  await page.locator('#tiles a.tile-risk').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#risk-cost h4')).toBeFocused();
});

test('small details: the currency sits beside the amount, one precision for an existing loan\'s interest, the LTV hint (UAT findings 6 and 12)', { tag: '@phone' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page); await waitDone(page);
  await page.locator('#own-terms-link').click();
  await expect(page.locator('#ltv-interest-hint')).toContainText('Some lenders count the interest for the whole term in the starting LTV.');
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000'); await waitDone(page);
  // beside the input: both centred on the same line (Safari draws the menu a little shorter)
  const mid = async (sel) => page.locator(sel).evaluate((e) => { const b = e.getBoundingClientRect(); return Math.round(b.top + b.height / 2); });
  expect(Math.abs((await mid('#f-loanAmount')) - (await mid('#form [data-k="currency"]')))).toBeLessThanOrEqual(2);
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#cost-body')).toContainText('of which €999.96 is interest');
  await expect(page.locator('#risk-cost')).toContainText('instead of €999.96 interest');
});

test('the same terms give the same number all week: the example does not change when it is confirmed, no recent hours are fetched', async ({ page }) => {
  const asked = [];
  // Bitstamp would offer new hours since the weekly update; the page must not use (or even ask for) them
  await page.route(/^https:\/\//, (r) => {
    const u = r.request().url(); asked.push(u);
    if (u.includes('api.coinbase.com')) return r.fulfill({ json: { data: { amount: '60000' } } });
    if (u.includes('www.bitstamp.net')) return r.fulfill({ json: { data: { ohlc: [{ timestamp: String(Math.floor(Date.now() / 1000) - 7200), open: '60000', high: '61000', low: '30000', close: '60000', volume: '1' }] } } });
    return r.abort();
  });
  // every number the headline shows from the first moment on, sampled every 20 ms
  await page.addInitScript(() => { window.__shown = new Set(); setInterval(() => { const e = document.querySelector('#headline-text em'); if (e && /^\d+$/.test(e.textContent)) window.__shown.add(e.textContent); }, 20); });
  await page.goto('/'); await waitDone(page); await page.waitForTimeout(500);
  expect(await page.evaluate(() => [...window.__shown])).toEqual(['54']); // never another number, also not after the quiet confirmation
  expect(asked.filter((u) => u.includes('step=3600'))).toEqual([]);
});

test('"load current price": a new price from Bitstamp updates the price line and the prices, and recalculates', async ({ page }) => {
  let price = 60000; const asked = [];
  await page.route(/^https:\/\//, (r) => {
    const u = r.request().url(); asked.push(u);
    if (u.includes('www.bitstamp.net')) return r.fulfill({ json: { data: { ohlc: [{ timestamp: String(Math.floor(Date.now() / 1000)), open: String(price), high: String(price), low: String(price), close: String(price), volume: '1' }] } } });
    return r.abort();
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('set')) { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', 'en'); sessionStorage.setItem('set', '1'); } } catch {} });
  await page.goto('/'); await waitDone(page);
  await expect(page.locator('#price-line')).toContainText('€60,000 · Bitstamp');
  await expect(page.locator('#tiles .tile').first()).toContainText('€37,500');
  // a loan entered with its LTV: the prices move with BTC, the chance of liquidation stays the same
  price = 90000; const before = asked.length;
  await page.locator('#own-terms-link').click();
  await page.locator('[data-reload-price]').click();
  await expect(page.locator('#price-line')).toContainText('€90,000 · Bitstamp');
  await waitDone(page);
  expect(asked.slice(before).some((u) => u.includes('www.bitstamp.net') && u.includes('step=60&limit=1'))).toBe(true); // asked again
  await expect(page.locator('#tiles .tile').first()).toContainText('€56,250'); // 62.5% of the new price
  expect(await headlineNumber(page)).toBe(54);
  // a loan entered with its BTC: a higher price lowers the LTV, so the number is recalculated and falls
  await page.locator('[data-set="ltvInput"][data-val="btc"]').click();
  await page.locator('#f-collateralBtc').fill('0.2222'); // about LTV 50% at 90,000
  await waitDone(page);
  const at90 = await headlineNumber(page);
  price = 120000;
  await page.locator('[data-reload-price]').click();
  await expect(page.locator('#price-line')).toContainText('€120,000 · Bitstamp');
  await expect(page.locator('#ltv-today')).toContainText('LTV 37.5%');
  await waitDone(page);
  expect(await headlineNumber(page)).toBeLessThan(at90);
});

test('German: Kosten inklusive Liquidationsrisiko', async ({ page }) => {
  await open(page, { lang: 'de' }); await waitDone(page);
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#risk-cost')).toContainText(/Inklusive Liquidationsrisiko: etwa [\d.]+\s€ \(etwa [\d,]+\s% pro Jahr statt 11,6\s%\)\./);
});

test('a share link pasted into a tab where the page is already open loads its terms', async ({ page }) => {
  await open(page); await waitDone(page);
  const hash = encodeState({ ...EXAMPLE_FORM, isExample: false, loanAmount: 20000, initialLtv: 40 });
  await page.evaluate((h) => { location.hash = h.slice(1); }, hash);
  await expect(page.locator('#f-loanAmount')).toHaveValue('20000');
});

test('chart tooltips: moving over a chart shows the values at that point', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#sec-falls > summary').click();
  const chart = page.locator('#futures-chart svg');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.locator('#futures-chart .tip')).toBeVisible();
  await expect(page.locator('#futures-chart .tip')).toContainText(/month \d+/);
});

test('security rule: a script smuggled into the page is refused; normal use causes no refusals', async ({ page }) => {
  const { errors } = await open(page); await waitDone(page);
  await page.locator('#own-terms-link').click();
  await page.locator('#f-initialLtv').fill('40');
  await waitDone(page);
  expect(errors).toEqual([]); // normal use: no refusals, no errors in any browser
  // inject script the way an attack would (the test can insert it, the browser must not run it)
  await page.evaluate(() => { const sc = document.createElement('script'); sc.textContent = 'window.__ran = 1'; document.body.append(sc); });
  await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = '<img src=x onerror="window.__ran2 = 1">'; document.body.append(d); });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [window.__ran, window.__ran2])).toEqual([undefined, undefined]);
  expect(errors.length).toBeGreaterThan(0); // the browser reported the refusals
});

test('partial sales: how much BTC the lender sells and what you keep, in the answer and in "What happens when BTC falls"', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('details.more[data-remember="more"] > summary').click();
  await page.locator('[data-set="liquidationSale"][data-val="partial"]').click();
  await expect(page.locator('#sold-line')).toContainText(/the lender sells about 0\.\d{4} of your 0\.\d{4} BTC to bring the LTV back to \d+%\. You keep 0\.\d{4} BTC/);
  const [sold, btc, left] = (await page.locator('#sold-line').textContent()).match(/0\.\d{4}/g).map(Number);
  expect(sold + left).toBeCloseTo(btc, 3); // sold + kept = all the BTC pledged
  await page.locator('#sec-falls > summary').click();
  await expect(page.locator('#falls-text')).toContainText(/\(liquidation\): the lender sells about 0\.\d{4} BTC, just enough to bring the LTV back to \d+%\. You keep 0\.\d{4} of your 0\.\d{4} BTC/);
});

test('"Show 20 other futures" goes through five different sets and says which one is next', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#sec-falls > summary').click();
  const btn = page.locator('#other-paths');
  await expect(btn).toHaveText('Show the next 20 futures (set 2 of 5)');
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    seen.add(await page.locator('#futures-chart svg').innerHTML());
    await btn.click();
  }
  expect(seen.size).toBe(5); // five different sets
  await expect(btn).toHaveText('Show the next 20 futures (set 2 of 5)'); // back to the first set
});

// The owner counted the ✕ in all five sets and got 13 while the answer said 15 (21 Oct 2026): the chart
// showed the first 100 simulated futures, a random draw. Now they are picked to match the answer.
test('"What happens when BTC falls": the five sets of 20 futures together have exactly the answer\'s number of liquidations', async ({ page }) => {
  await open(page); await waitDone(page);
  for (const ltv of ['30', '50']) {
    await page.locator('#f-initialLtv').fill(ltv); await waitFresh(page);
    const n = await headlineNumber(page);
    const summary = page.locator('#sec-falls > summary');
    if (!(await page.locator('#sec-falls').getAttribute('open') !== null)) await summary.click();
    let total = 0;
    for (let set = 0; set < 5; set++) {
      await expect(page.locator('#futures-line')).toContainText('of these 20'); // drawn a moment after opening
      total += Number((await page.locator('#futures-line').textContent()).match(/(\d+) of these 20/)[1]);
      await page.locator('#other-paths').click();
    }
    expect(total, `starting LTV ${ltv}%`).toBe(n);
    await expect(page.locator('#futures-line')).toContainText(`so that ${n} of them end in a liquidation, as in the answer`);
  }
});

// The example showed "54 of 100" liquidated and "in 47 of 100 futures it is zero" (owner, 21 Oct 2026):
// 53.5 and 46.5, each rounded up. The futures without a sale are now 100 minus the answer's number.
test('cost of the risk: "zero in X of 100 futures" and the answer add up to 100, also on How it works', async ({ page }) => {
  await open(page); await waitDone(page);
  const example = await headlineNumber(page);
  for (const ltv of ['50', '30', '62']) {
    if (ltv !== '50') { await page.locator('#f-initialLtv').fill(ltv); await waitFresh(page); }
    const n = await headlineNumber(page);
    const none = Number((await page.locator('#risk-cost').textContent()).match(/In (\d+) of 100 futures it is zero/)[1]);
    expect(none + n, `starting LTV ${ltv}%`).toBe(100);
  }
  await page.goto('/method/'); // How it works explains the example
  const zero = Number((await page.locator('#risk-read').textContent()).match(/Zero in (\d+) of 100 futures/)[1]);
  expect(zero + example).toBe(100);
});

// Owner, 21 Oct 2026: a loan at 25% got "Starting LTV 5% → 0 of 100" (five times the BTC). Now the smallest step
// that clearly helps is suggested; the slider below shows the rest.
test('"One change lowers this": the smallest starting-LTV step that clearly helps, not the biggest', async ({ page }) => {
  await open(page, { hash: encodeState({ ...EXAMPLE_FORM, isExample: false, currency: 'USD', initialLtv: 25 }) }); await waitDone(page);
  await expect(page.locator('#best-lever')).toHaveText(/^One change lowers this: Starting LTV 20% → \d+ of 100\.$/);
  const n = await headlineNumber(page);
  const p = Number((await page.locator('#best-lever').textContent()).match(/→ (\d+) of 100/)[1]);
  expect(p).toBeLessThanOrEqual(n - Math.max(1, Math.ceil(n / 4))); // clearly lower
  await expect(page.locator('#safer .lv').filter({ hasText: 'Starting LTV 5%' })).toHaveCount(1); // the bigger steps stay in the list
});

test('questions to ask the lender: a folded checklist tile after "Make it safer"; the closed line says what is inside', async ({ page }) => {
  await open(page); await waitDone(page);
  const block = page.locator('#questions-block');
  await expect(block).toBeVisible();
  await expect(block).not.toHaveAttribute('open', ''); // folded by default
  await expect(block.locator('summary')).toContainText('Before you sign: 8 questions to ask your lender');
  await expect(block.locator('summary')).toContainText('What happens after a margin call');
  await expect(block.locator('li').first()).toBeHidden();
  await block.locator('summary').click();
  await expect(block.locator('li')).toHaveCount(8);
  await expect(block.locator('li').first()).toBeVisible();
  // it sits right after "Make it safer", above the folded sections
  const order = await page.evaluate(() => ['#safer', '#questions-block', '#sec-falls'].map((s) => document.querySelector(s).getBoundingClientRect().top));
  expect(order[0]).toBeLessThan(order[1]); expect(order[1]).toBeLessThan(order[2]);
});

test('switching between starting LTV and BTC pledged converts the current values both ways', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#f-loanAmount').fill('15000');
  await page.locator('#f-initialLtv').fill('25');
  await page.getByRole('button', { name: 'or enter the BTC you pledge' }).click();
  // 15,000 / (25% × 60,000) = 1 BTC (the test price is 60,000); before the fix the old 0.3333 stayed
  await expect(page.locator('#f-collateralBtc')).toHaveValue('1');
  await expect(page.locator('#ltv-today')).toContainText('LTV 25.0%');
  await page.locator('#f-collateralBtc').fill('0.5');
  await page.getByRole('button', { name: 'or enter the LTV' }).click();
  await expect(page.locator('#f-initialLtv')).toHaveValue('50'); // 15,000 / (0.5 × 60,000)
});

test('"Start over and forget my inputs": deletes what the browser stored, ends a comparison, shows the example again', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#f-initialLtv').fill('35');
  await page.locator('#compare-btn').click();
  await waitDone(page);
  expect(await page.evaluate(() => sessionStorage.getItem('btc-loan-risk:form'))).not.toBeNull();
  await page.locator('#forget-btn').click();
  await expect(page.locator('#forgotten')).toBeVisible();
  await expect(page.locator('#cmp')).toBeHidden();
  await expect(page.locator('#ans-label')).toHaveText('Example');
  await expect(page.locator('#f-initialLtv')).toHaveValue('50');
  expect(await page.evaluate(() => [localStorage.getItem('btc-loan-risk:form'), sessionStorage.getItem('btc-loan-risk:form'), localStorage.getItem('btc-loan-risk:lang'), localStorage.getItem('btc-loan-risk:remember')])).toEqual([null, null, null, null]);
  await expect(page.locator('#reset-btn')).toHaveCount(0); // one button, not two
});

test('phone: the answer bar waits while the on-screen keyboard is open, and comes back when it closes', { tag: '@phone' }, async ({ page }) => {
  // a stand-in for the phone's "visual viewport", which shrinks when the keyboard opens
  await page.addInitScript(() => {
    const vv = new EventTarget(); vv.height = window.innerHeight; vv.scale = 1;
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.setKeyboard = (open) => { vv.height = open ? window.innerHeight - 330 : window.innerHeight; vv.dispatchEvent(new Event('resize')); };
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page); await waitDone(page);
  await page.locator('#own-terms-link').click();
  const field = page.locator('#f-initialLtv');
  await field.fill('35'); await waitDone(page);
  const bar = page.locator('#answer-bar');
  await expect(bar).toBeVisible(); // focused, but no keyboard (as on a computer)
  await field.focus(); await page.evaluate(() => window.setKeyboard(true));
  await expect(bar).toBeHidden(); // the keyboard is open: the bar would cover the field
  await page.evaluate(() => { document.activeElement.blur(); window.setKeyboard(false); });
  await expect(bar).toBeVisible();
});

test('phone: while the answer is recalculated, the field being typed in stays where it is on screen', { tag: '@phone' }, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page); await waitDone(page);
  await page.locator('#own-terms-link').click();
  const field = page.locator('#f-loanAmount');
  await field.scrollIntoViewIfNeeded();
  // record the field's position on screen every 20 ms during a whole recalculation
  await page.evaluate(() => {
    window.tops = [];
    const el = document.querySelector('#f-loanAmount');
    window.sampler = setInterval(() => window.tops.push(el.getBoundingClientRect().top), 20);
  });
  await field.fill('12000');
  await waitDone(page);
  const tops = await page.evaluate(() => { clearInterval(window.sampler); return window.tops; });
  expect(tops.length).toBeGreaterThan(10);
  expect(Math.max(...tops) - Math.min(...tops), `positions: ${[...new Set(tops.map(Math.round))].join(', ')}`).toBeLessThanOrEqual(2);
});

test('inputs stay for this tab only, unless "Remember my inputs" is ticked (privacy by default)', async ({ page, context }) => {
  await open(page); await waitDone(page);
  await page.locator('#f-initialLtv').fill('35');
  await page.reload(); // same tab: kept
  await expect(page.locator('#f-initialLtv')).toHaveValue('35');
  expect(await page.evaluate(() => localStorage.getItem('btc-loan-risk:form'))).toBeNull(); // nothing kept beyond the visit
  const other = await context.newPage(); // a new tab = a later visit
  await other.route(/^https:\/\//, (r) => r.abort());
  await other.goto('/');
  await expect(other.locator('#f-initialLtv')).toHaveValue('50');
  await other.close();
  await page.locator('[data-remember-inputs]').check();
  const later = await context.newPage();
  await later.route(/^https:\/\//, (r) => r.abort());
  await later.goto('/');
  await expect(later.locator('#f-initialLtv')).toHaveValue('35');
  await expect(later.locator('[data-remember-inputs]')).toBeChecked();
  await later.locator('[data-remember-inputs]').uncheck(); // untick: deleted from the browser at once
  expect(await later.evaluate(() => [localStorage.getItem('btc-loan-risk:form'), localStorage.getItem('btc-loan-risk:remember')])).toEqual([null, null]);
});

test('ending a comparison: the visitor chooses which offer stays; nothing is dropped by surprise', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#compare-btn').click(); // B is a copy of A and selected
  await page.locator('#f-offerName').fill('Bank X');
  await page.locator('#f-initialLtv').fill('35'); // B changed; A stays at 50
  await waitDone(page);
  const row = page.locator('#cmp .end-row');
  await expect(row).toContainText('End the comparison and keep:');
  await expect(row.locator('button')).toHaveText(['Offer A', 'Bank X']); // the visitor's own names
  const bNumber = await headlineNumber(page);
  // the original offer (A) is kept although B was the one selected and edited last
  await expect(row.locator('button').first()).toHaveText('Offer A');
  // B is recalculated while A is chosen. The page itself clicks "Offer A" at the moment B's first new
  // number is shown and the rest of its calculation is still running (the moment the old bug showed B's
  // number under A), and records every headline from then on.
  await page.evaluate(() => {
    window.heads = []; window.bNumber36 = null;
    window.clickA = () => {
      window.bNumber36 = Number(document.querySelector('#headline-text em').textContent.match(/\d+/)[0]);
      document.querySelector('#cmp .end-row button').click();
      window.heads.push(document.querySelector('#headline-text').textContent);
      window.sampler = setInterval(() => window.heads.push(document.querySelector('#headline-text').textContent), 20);
    };
    window.mo = new MutationObserver(() => {
      if (document.body.classList.contains('outdated') || document.querySelector('#progress').hidden) return;
      if (document.querySelector('#f-initialLtv').value !== '36') return;
      window.mo.disconnect(); window.clickA();
    });
    window.mo.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
  });
  await page.locator('#f-initialLtv').fill('36');
  const caught = await page.waitForFunction(() => window.bNumber36 !== null, null, { timeout: 20000 }).then(() => true, () => false);
  if (!caught) {
    // Safari's engine on GitHub's computers showed no such moment (20/21 Oct). Then A is chosen once B
    // has finished, and a note on the GitHub run says so, with what the browser reported.
    const info = await page.evaluate(() => { window.mo.disconnect(); window.clickA(); return `cores ${navigator.hardwareConcurrency}, worker ${typeof Worker}`; });
    console.log(`::warning title=Moment not reached::ending a comparison (${test.info().project.name}): B's answer arrived in one piece; ${info}`);
  }
  const bNumber36 = await page.evaluate(() => window.bNumber36);
  await waitDone(page);
  const heads = await page.evaluate(() => { clearInterval(window.sampler); return window.heads; });
  // A's answer, never B's number from the calculation that was still running
  for (const h of heads) for (const n of new Set([bNumber, bNumber36])) expect(h).not.toMatch(new RegExp(`^${n}\\b`));
  await expect(page.locator('#ans-label')).toHaveText('Example');
  await expect(page.locator('#cmp')).toBeHidden();
  await expect(page.locator('#f-initialLtv')).toHaveValue('50');
  await expect(page.locator('#ended-note')).toHaveText('Offer A is now in your terms. The comparison has ended.');
  await waitDone(page);
  await page.locator('#f-initialLtv').fill('45');
  await expect(page.locator('#ended-note')).toBeHidden(); // the note goes once the visitor changes something
  // refinancing: keep the current loan
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000');
  await page.locator('#f-collateralBtc').fill('0.4');
  await waitDone(page);
  await page.locator('#compare-btn').click();
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('1000');
  await expect(page.locator('#cmp .end-row button')).toHaveText(['Current loan', 'Refinancing']);
  await page.locator('#cmp .end-row button').first().click();
  await expect(page.locator('#f-loanAmount')).toHaveValue('10000');
  await expect(page.locator('#f-collateralBtc')).toHaveValue('0.4');
  await expect(page.getByRole('button', { name: 'A loan I already have' })).toHaveAttribute('aria-pressed', 'true');
});

test('typing into a field that changes the form (margin call empty → 70): the cursor stays, nothing jumps (desktop and phone)', { tag: '@phone' }, async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page); await waitDone(page);
    if (width < 1024) await page.locator('#own-terms-link').click();
    await page.locator('details.more[data-remember="more"] > summary').click();
    await expect(page.locator('details.more[data-remember="more"]')).toHaveAttribute('open', '');
    await page.waitForTimeout(100); // as a person: the section is open before typing starts
    const f = page.locator('#f-marginCallLtv');
    await f.fill(''); // the margin-call options disappear: the form is rebuilt
    // mid-screen (at the very bottom, under the answer bar, browsers scroll a field into view while typing, as they should)
    await f.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const pos = () => page.evaluate(() => ({ panel: document.querySelector('#terms').scrollTop, page: window.scrollY, field: Math.round(document.querySelector('#f-marginCallLtv').getBoundingClientRect().top) }));
    const before = await pos();
    await f.focus();
    await page.keyboard.type('70'); // after the "7" the margin-call options appear: rebuilt again
    await expect(f).toHaveValue('70');
    await expect(f).toBeFocused();
    const after = await pos();
    expect(Math.abs(after.field - before.field), `${width}px: the field moved on screen`).toBeLessThanOrEqual(2);
    await expect(page.locator('#f-marginCallConsequence')).toBeVisible(); // the new options are there
  }
});

test('computer: while the answer is recalculated, the left side does not jump ("Make it safer" keeps its height)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page); await waitDone(page);
  for (const y of [0, 700, 1400]) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.evaluate(() => {
      window.rec = [];
      window.sampler = setInterval(() => window.rec.push([Math.round(document.querySelector('#questions-block').getBoundingClientRect().top), Math.round(window.scrollY)]), 20);
    });
    await page.locator('#f-loanAmount').fill(String(11000 + y));
    await waitDone(page);
    const rec = await page.evaluate(() => { clearInterval(window.sampler); return window.rec; });
    const tops = rec.map((r) => r[0]);
    expect(Math.max(...tops) - Math.min(...tops), `scrolled to ${y}: block below "Make it safer" at ${[...new Set(tops)].join(', ')}`).toBeLessThanOrEqual(2);
    await expect(page.locator('#safer-body')).not.toHaveClass(/pending/); // active again afterwards
  }
});

test('refinancing: today\'s LTV, when borrowing more or taking back BTC is possible, and the limit right under the input', async ({ page }) => {
  await open(page); await waitDone(page);
  await page.getByRole('button', { name: 'A loan I already have' }).click();
  await page.locator('#f-loanAmount').fill('10000');
  await waitDone(page);
  await page.locator('#compare-btn').click();
  await expect(page.locator('#form')).toContainText(/Its LTV today: 50%/);
  const note = page.locator('#refi-note');
  await page.locator('[data-set="refi.change"][data-val="back"]').click();
  await expect(page.locator('#form')).toContainText('Possible when BTC has risen since you took the loan');
  await page.locator('#f-refiBack').fill('0.1');
  await expect(note).toBeVisible();
  await expect(note).toContainText(/would reach the margin call at 70%.*at most 0\.0\d{3} BTC can be taken back/);
  // the stated maximum really keeps the new LTV below the margin call
  const max = (await note.textContent()).match(/at most (0\.\d+) BTC/)[1];
  await page.locator('#f-refiBack').fill(max);
  await expect(note).not.toHaveClass(/err/); // possible now, but much higher than today: the neutral note
  await expect(note).toContainText(/Starting LTV \d+%, up from 50% today\. Check that this is within your lender's maximum starting LTV\./);
  await expect(page.locator('#ltv-today')).toContainText(/starting LTV 69\.\d%/);
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('3000');
  await expect(note).toContainText(/Starting LTV \d+%, up from 50% today\. Check that this is within your lender's maximum starting LTV\./);
  await page.locator('#f-refiExtra').fill('5000');
  await expect(note).toContainText(/at most €3,\d{3} more can be borrowed/);
  await page.locator('[data-set="refi.change"][data-val="same"]').click();
  await expect(note).toBeHidden();
});
