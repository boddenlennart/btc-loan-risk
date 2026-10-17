// The finished page, used the way a visitor uses it. Outside price services are
// replaced by fixed answers (BTC = 60,000) so results are repeatable, and the
// headline is compared with the engine run directly in Node on the same data.
import { test, expect } from '@playwright/test';
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
// done = the full calculation for the current terms has arrived (also when the instant example was shown first)
const waitDone = async (page) => { await expect(page.locator('#progress')).toBeHidden(); await expect(page.locator('body')).toHaveAttribute('data-ready', '1'); };

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
  await page.keyboard.press('Home'); // slider to the lowest LTV; "change" fires on release
  await slider.dispatchEvent('change');
  await expect(page.locator('#f-initialLtv')).toHaveValue('10');
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
  // the method justification moved to "How these numbers are made"
  await page.locator('#method > summary').click();
  await expect(page.locator('#trend-facts')).toContainText('Why the page assumes no trend');
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
  const best = (await page.locator('#best-lever').textContent()).match(/→ (\d+) of 100/);
  expect(best).not.toBeNull();
  expect(Number(best[1])).toBeLessThan(n);
  // it is the first (lowest) option in "Make it safer"
  await expect(page.locator('#safer .lv:not(.base) b').first()).toHaveText(best[1]);
  // fairness: the top-up assumption and the two other methods are shown with the answer
  await expect(page.locator('#assume-line')).toHaveText('Assumes you add no BTC or money after a margin call.');
  await expect(page.locator('#methods-line')).toContainText(/Other methods: real history since 2014 \d+ of 100, a volatility model \d+ of 100/);
  // what a sale leaves: not "everything lost"
  await expect(page.locator('#sold-line')).toContainText(/If sold: you get back about 0\.\d{4} of your 0\.\d{4} BTC/);
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

test('first phone screen (375 x 812): name, headline, trust line and the answer with its number, in ink not red', async ({ page }) => {
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
  await expect(page.locator('#price-line')).toContainText('CHF 60,000');
  await waitDone(page);
  await expect(page.locator('#tiles')).toContainText('CHF');
  const chf = await headlineNumber(page);
  expect(Math.abs(chf - eur)).toBeLessThanOrEqual(3);
  await expect(page.locator('footer')).toContainText('European Central Bank');
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
  await expect(rows.nth(3)).toContainText('€2,000'); // you receive now
  // too much extra cash: the new loan would start in a margin call; the reason is shown at once
  await page.locator('#f-refiExtra').fill('5000');
  await expect(page.locator('#ltv-today')).toContainText('starting LTV');
  await expect(page.locator('#error-banner')).toBeVisible();
});

test('phone: while typing the terms, a bar shows the answer and the number before the change; "See the answer" scrolls up', async ({ page }) => {
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

test('slider: releasing it says what changed, and Undo brings the old terms back', async ({ page }) => {
  await open(page); await waitDone(page);
  const slider = page.locator('#ltv-slider');
  await slider.focus();
  await page.keyboard.press('Home');
  await slider.dispatchEvent('change');
  await expect(page.locator('#slider-undo')).toContainText('Your starting LTV is now 10%.');
  await expect(page.locator('#f-initialLtv')).toHaveValue('10');
  await page.locator('#slider-undo-btn').click();
  await expect(page.locator('#f-initialLtv')).toHaveValue('50');
  await expect(page.locator('#slider-undo')).toBeHidden();
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
  await page.addInitScript(() => { try { localStorage.setItem('btc-loan-risk:form', '{"state": "nonsense", "compare": {"kind": 7}}'); localStorage.setItem('btc-loan-risk:lang', 'en'); } catch {} });
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
  await page.locator('[data-compare-remove]').click(); // removes the selected one (C)
  await expect(page.locator('#cmp thead button.col')).toHaveText(['Offer A', 'Offer B']);
  await page.locator('[data-compare-end]').click();
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
  await page.locator('[data-compare-end]').click();
  // kept on its own, the refinancing becomes a new loan entered by BTC: 10,000 + 1,000 against 0.4 BTC
  await expect(page.locator('#f-loanAmount')).toHaveValue('11000');
  await expect(page.locator('#f-collateralBtc')).toHaveValue('0.4');
  await expect(page.locator('#tiles')).toContainText('Sold at');
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
