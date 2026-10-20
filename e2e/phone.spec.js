// The pages used with a finger on a phone: every control is tapped, dragged or typed into the way a
// visitor does it on an iPhone (Safari's engine) or an Android phone (Chrome's engine), with a touch
// screen and a phone browser. Runs only in the "iphone" and "android" test setups
// (playwright.config.js); a narrow computer window missed a slider that did nothing on iPhones.
import { test, expect } from '@playwright/test';
import { openFolded as tapOpenAll } from './helpers.js'; // taps on a touch screen

const PAGES = ['/', '/method/', '/insights/', '/de/', '/de/method/', '/de/insights/'];

test.beforeEach(({ isMobile }) => { test.skip(!isMobile, 'phone only: runs in the iphone and android setups'); });

async function open(page, path = '/', { lang = 'en' } = {}) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https:\/\//, (route) => {
    const u = route.request().url();
    if (u.includes('api.coinbase.com')) return route.fulfill({ json: { data: { amount: '60000' } } });
    if (u.includes('www.bitstamp.net')) return route.fulfill({ json: { data: { ohlc: [] } } });
    return route.abort();
  });
  await page.addInitScript((l) => { try { if (!sessionStorage.getItem('set')) { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', l); sessionStorage.setItem('set', '1'); } } catch {} }, lang);
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  return errors;
}
const waitDone = async (page) => { await expect(page.locator('#progress')).toBeHidden(); await expect(page.locator('body')).toHaveAttribute('data-ready', '1'); };
const headlineNumber = async (page) => Number((await page.locator('#headline-text em').textContent()).match(/\d+/)[0]);

// a drag with the finger (Chrome's engine accepts real touch events from a test; Safari's engine
// only mouse events, which go through the same code in the page)
async function drag(page, browserName, x0, y, xs) {
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (const x of xs) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await page.mouse.move(x0, y); await page.mouse.down(); for (const x of xs) await page.mouse.move(x, y); await page.mouse.up(); }
}

test('check page by touch: every folded part opens with a tap and closes with a second tap', { tag: '@phone' }, async ({ page }) => {
  const errors = await open(page); await waitDone(page);
  await page.locator('#own-terms-link').tap(); // the terms, folded away on phones
  await expect(page.locator('#f-initialLtv')).toBeVisible();
  expect(await tapOpenAll(page, 'body')).toBeGreaterThan(10);
  const falls = page.locator('#sec-falls > summary');
  await falls.scrollIntoViewIfNeeded(); await falls.tap();
  await expect(page.locator('#sec-falls')).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('terms by touch: tapping choices and typing recalculates; the answer bar leads back to the answer', { tag: '@phone' }, async ({ page }) => {
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  await page.locator('#own-terms-link').tap();
  const ltv = page.locator('#f-initialLtv');
  await ltv.tap(); await ltv.selectText(); await page.keyboard.type('30');
  await page.locator('#f-initialLtv').blur();
  await waitDone(page);
  await expect.poll(() => headlineNumber(page)).toBeLessThan(before);
  const thirty = await headlineNumber(page);
  const d36 = page.locator('[data-set="durationMonths"][data-val="36"]');
  await d36.scrollIntoViewIfNeeded(); await d36.tap(); await waitDone(page);
  await expect(d36).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => headlineNumber(page)).toBeGreaterThan(thirty); // three years: more futures reach a sale
  await expect(page.locator('#answer-bar')).toBeVisible();
  await page.locator('#answer-bar-btn').tap();
  await expect(page.locator('#headline-text')).toBeInViewport();
  // the other kind of loan, by tap
  await page.locator('#own-terms-link').tap();
  const existing = page.getByRole('button', { name: 'A loan I already have' });
  await existing.scrollIntoViewIfNeeded(); await existing.tap();
  await waitDone(page);
  await expect(page.locator('#ltv-today')).toContainText('LTV');
  await expect(page.locator('#headline-text')).toContainText('months left');
});

test('every field has text of at least 16 px, so the iPhone does not zoom in when it is tapped', { tag: '@phone' }, async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#own-terms-link').tap();
  await tapOpenAll(page, 'body'); // the terms and the feedback form in the footer
  const small = await page.evaluate(() => [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea')]
    .filter((el) => el.offsetParent && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => `${el.id || el.dataset.fb || el.outerHTML.slice(0, 60)}: ${getComputedStyle(el).fontSize}`));
  expect(small).toEqual([]);
  expect(await page.locator('#form input:visible').count()).toBeGreaterThan(5);
  expect(await page.locator('footer textarea:visible').count()).toBeGreaterThan(0);
});

test('two-finger zoom is allowed on every page (nothing stops a visitor from enlarging the text)', { tag: '@phone' }, async ({ page }) => {
  for (const p of PAGES) {
    await open(page, p);
    const vp = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(vp, p).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
  }
});

test('"Make it safer" by touch: drag the slider, the terms and the answer follow; Undo by tap', { tag: '@phone' }, async ({ page, browserName }) => {
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  const slider = page.locator('#ltv-slider');
  await slider.scrollIntoViewIfNeeded();
  const b = await slider.boundingBox(); const y = b.y + b.height / 2;
  const x0 = b.x + b.width * (Number(await slider.inputValue()) / 1000);
  await drag(page, browserName, x0, y, Array.from({ length: 10 }, (_, i) => x0 - (i + 1) * (b.width / 40)));
  await expect.poll(async () => Number(await page.locator('#f-initialLtv').inputValue())).toBeLessThan(50);
  await expect.poll(() => headlineNumber(page)).toBeLessThan(before);
  await page.locator('#slider-undo-btn').tap();
  await expect(page.locator('#f-initialLtv')).toHaveValue('50');
});

test('buttons by touch: compare an offer, the tile link, other futures, the language menu', { tag: '@phone' }, async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#tiles a.tile-risk').tap();
  await expect(page.locator('#sec-cost')).toHaveAttribute('open', '');
  await expect(page.locator('#risk-cost h4')).toBeInViewport();
  await page.locator('#sec-falls > summary').scrollIntoViewIfNeeded(); await page.locator('#sec-falls > summary').tap();
  const other = page.locator('#other-paths');
  await other.scrollIntoViewIfNeeded(); await other.tap();
  await expect(other).toHaveText('Show the next 20 futures (set 3 of 5)');
  const cmp = page.locator('#compare-btn');
  await cmp.scrollIntoViewIfNeeded(); await cmp.tap();
  await expect(page.locator('#cmp')).toBeVisible();
  await waitDone(page);
  await page.locator('#lang-btn').tap();
  await expect(page.locator('#lang-list')).toBeVisible();
  await page.locator('[data-lang="de"]').tap();
  await expect(page.locator('#lang-btn')).toContainText('DE');
  await expect(page.locator('#headline-text')).toContainText('von 100');
});

test('share on a phone opens the phone\'s own share menu with the link to the visitor\'s terms', { tag: '@phone' }, async ({ page }) => {
  await page.addInitScript(() => { window.shared = []; navigator.share = async (d) => { window.shared.push(d); }; });
  await open(page); await waitDone(page);
  const n = await headlineNumber(page);
  await page.locator('#share-btn').scrollIntoViewIfNeeded(); await page.locator('#share-btn').tap();
  await expect.poll(() => page.evaluate(() => window.shared.length)).toBe(1);
  const d = await page.evaluate(() => window.shared[0]);
  expect(d.url).toMatch(/#s=/);
  expect(d.text).toContain(`${n} of 100`);
});

test('charts by touch: a tap on a chart shows the values at that point', { tag: '@phone' }, async ({ page }) => {
  await open(page); await waitDone(page);
  await page.locator('#sec-falls > summary').scrollIntoViewIfNeeded(); await page.locator('#sec-falls > summary').tap();
  const chart = page.locator('#futures-chart svg');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.locator('#futures-chart .tip')).toBeVisible();
  await expect(page.locator('#futures-chart .tip')).toContainText(/month \d+/);
  await page.waitForTimeout(600); // still there after the finger is lifted
  await expect(page.locator('#futures-chart .tip')).toBeVisible();
  await page.locator('#sec-falls h3, #sec-falls p').first().tap(); // a tap elsewhere puts it away
  await expect(page.locator('#futures-chart .tip')).toBeHidden();
});

test('navigation by touch on every page: the phone row, the name back to the start, every folded part', { tag: '@phone' }, async ({ page }) => {
  const errors = await open(page);
  const row = page.locator('.phone-nav');
  await expect(row).toBeVisible();
  await row.getByText('How it works').tap();
  await expect(page).toHaveURL(/\/method\/$/);
  await tapOpenAll(page, 'main');
  await page.locator('.phone-nav').getByText('Insights').tap();
  await expect(page).toHaveURL(/\/insights\/$/);
  await tapOpenAll(page, 'main');
  await page.locator('.brand').tap();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  expect(errors).toEqual([]);
});

test('phone held sideways: nothing scrolls sideways, the top bar leaves room, the terms can be changed', { tag: '@phone' }, async ({ page }) => {
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.height, height: size.width });
  for (const p of PAGES) {
    await open(page, p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), p).toBeLessThanOrEqual(0);
    expect((await page.locator('.top').boundingBox()).height, p).toBeLessThan(size.width * 0.25);
  }
  await open(page); await waitDone(page);
  const before = await headlineNumber(page);
  await page.locator('#own-terms-link').tap();
  await page.locator('#f-initialLtv').fill('30'); await waitDone(page);
  await expect.poll(() => headlineNumber(page)).toBeLessThan(before);
});
