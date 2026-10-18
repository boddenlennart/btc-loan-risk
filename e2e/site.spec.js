// The three pages together: navigation, the "How it works" and "Insights" pages, languages, and
// the check page trimmed after the content audit (ux/H-content-audit.md).
import { test, expect } from '@playwright/test';

async function visit(page, path, { lang = 'en', width } = {}) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https:\/\//, (route) => {
    const u = route.request().url();
    if (u.includes('api.coinbase.com')) return route.fulfill({ json: { data: { amount: '60000' } } });
    if (u.includes('www.bitstamp.net')) return route.fulfill({ json: { data: { ohlc: [] } } });
    return route.abort();
  });
  if (width) await page.setViewportSize({ width, height: 812 });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP refused: ${e.violatedDirective} ${e.blockedURI || ''}`)));
  await page.addInitScript((l) => { try { if (!sessionStorage.getItem('set')) { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', l); sessionStorage.setItem('set', '1'); } } catch {} }, lang);
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  return errors;
}

test('navigation: three pages, the current one marked; in the top bar on desktop, a second row on phones that scrolls away', async ({ page }) => {
  await visit(page, '/');
  const desk = page.locator('.desk-nav');
  await expect(desk).toBeVisible();
  await expect(page.locator('.phone-nav')).toBeHidden();
  await expect(desk.locator('a')).toHaveText(['Check a loan', 'Insights', 'How it works']);
  await expect(desk.locator('a[aria-current="page"]')).toHaveText('Check a loan');
  await desk.getByText('How it works').click();
  await expect(page).toHaveURL(/\/method\/$/);
  await expect(page.locator('.desk-nav a[aria-current="page"]')).toHaveText('How it works');
  await page.locator('.desk-nav').getByText('Insights').click();
  await expect(page).toHaveURL(/\/insights\/$/);
  await page.locator('.brand').click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);

  await page.setViewportSize({ width: 375, height: 812 });
  const row = page.locator('.phone-nav');
  await expect(row).toBeVisible();
  await expect(page.locator('.desk-nav')).toBeHidden();
  for (const a of await row.locator('a').all()) expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => row.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(0); // scrolled away
  await expect.poll(() => page.locator('.top').evaluate((el) => el.getBoundingClientRect().top)).toBe(0); // the name bar stays
});

test('"How it works": all parts, the example loan\'s charts and method table, no errors or security refusals', async ({ page }) => {
  const errors = await visit(page, '/method/');
  await expect(page).toHaveTitle('How it works · Bitcoin Loan Check');
  await expect(page.locator('.toc li')).toHaveCount(7);
  for (const id of ['steps', 'methods', 'test', 'data', 'trend', 'limits', 'verify']) await expect(page.locator(`#${id} h2`)).toBeVisible();
  await expect(page.locator('#steps-list li')).toHaveCount(4);
  await expect(page.locator('#example-note')).toContainText('Borrow €10,000 for 12 months');
  await expect(page.locator('#fan-chart path.band-outer')).toHaveCount(1);
  await expect(page.locator('#months-chart svg')).toHaveCount(1);
  await expect(page.locator('#compare tr')).toHaveCount(4);
  await expect(page.locator('#trend-facts')).toContainText('Since 2014, BTC grew by about');
  await expect(page.locator('#data')).toContainText('European Central Bank');
  await expect(page.locator('#data')).toContainText('Your lender decides which BTC price counts');
  await expect(page.locator('#verify a')).toHaveAttribute('href', 'https://github.com/boddenlennart/btc-loan-risk');
  await page.locator('#methods a.gloss').first().click(); // a glossary word opens the glossary in the footer
  await expect(page.locator('#glossary')).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('the method table on "How it works" equals the example answer on the check page', async ({ page }) => {
  await visit(page, '/method/');
  const sim = await page.locator('#compare tr').first().locator('td').textContent();
  const hist = await page.locator('#compare tr').nth(2).locator('td').textContent();
  await visit(page, '/');
  await expect(page.locator('#headline-text em')).toHaveText(sim);
  await expect(page.locator('#methods-line')).toContainText(`real history since 2014 ${hist} of 100`);
});

test('German: /de/method/ and /de/insights/ start in German; the language menu on a page loads that page in the other language', async ({ page }) => {
  await visit(page, '/de/method/');
  await expect(page.locator('h1')).toHaveText('So funktioniert es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('.desk-nav a[aria-current="page"]')).toHaveText('So funktioniert es');
  await expect(page.locator('.desk-nav a').first()).toHaveAttribute('href', '/de/');
  await page.locator('#lang-btn').click();
  await page.locator('[data-lang="en"]').click();
  await expect(page).toHaveURL(/\/method\/$/);
  expect(new URL(page.url()).pathname).toBe('/method/');
  await expect(page.locator('h1')).toHaveText('How it works');
  await visit(page, '/de/insights/');
  await expect(page.locator('h1')).toHaveText('Erkenntnisse');
  await expect(page.locator('.toc li')).toHaveCount(5);
  await expect(page.locator('#i-survival .take')).toContainText('Start-LTV');
});

test('check page after the audit: the method section and repeats are gone, the insight line links on, feedback and "start over" sit in the footer', async ({ page }) => {
  const errors = await visit(page, '/');
  await expect(page.locator('#method')).toHaveCount(0);
  await expect(page.locator('#fall-hook')).toContainText(/At its fastest since 2014, BTC fell this far \(−\d+%\) within \d+ (hours?|days)\./);
  await expect(page.locator('#fall-hook a')).toHaveAttribute('href', '/insights/#buffer');
  await expect(page.locator('#method-link')).toHaveAttribute('href', '/method/');
  // said once on the page, not three times: the lender itself can fail (plus the list of what is not included)
  expect(await page.locator('main').evaluate((m) => (m.textContent.match(/lender itself can fail/g) || []).length)).toBe(1);
  await expect(page.locator('main')).not.toContainText('Price history in this page');
  await expect(page.locator('main')).not.toContainText('Your lender\'s own figures always win');
  // "What happens when BTC falls": the ladder and the steps, without repeating the sale sentence of the answer
  await page.locator('#sec-falls > summary').click();
  await expect(page.locator('#sec-falls .ladder')).toBeVisible();
  await expect(page.locator('#falls-text')).toContainText('(liquidation): the lender sells');
  await expect(page.locator('#sale-line')).toBeHidden();
  await expect(page.locator('footer #sec-feedback')).toHaveCount(1);
  await expect(page.locator('footer #forget-btn')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// Accessibility (axe-core) on every page, light and dark, with the footer's folded parts open.
// The checker is injected into the page, so this test alone switches off the security rule.
test.describe('accessibility', () => {
  test.use({ bypassCSP: true });
  for (const path of ['/', '/insights/', '/method/', '/de/method/']) {
    for (const scheme of ['light', 'dark']) {
      test(`axe finds no issues on ${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await visit(page, path);
        await page.evaluate(() => { for (const d of document.querySelectorAll('footer details')) d.open = true; });
        await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
        const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
      });
    }
  }
});

test('price ladder: the labels never overlap, also when margin call and liquidation are close (phone and desktop, both languages)', async ({ page }) => {
  await visit(page, '/');
  const overlaps = () => page.locator('#falls-text .ladder').evaluate((el) => {
    const boxes = [...el.querySelectorAll('.lab')].map((l) => l.getBoundingClientRect());
    const box = el.getBoundingClientRect(); const bad = [];
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => { if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) bad.push('overlap'); }));
    for (const a of boxes) if (a.left < box.left - 1 || a.right > box.right + 1 || a.top < box.top - 1 || a.bottom > box.bottom + 1) bad.push('outside');
    return bad;
  });
  await page.locator('#sec-falls > summary').click();
  for (const ltv of ['50', '30', '62']) { // far apart, close (as in the owner's screenshot), very close to the margin call
    await page.locator('#f-initialLtv').fill(ltv);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(overlaps, `LTV ${ltv}, ${width}px`).toEqual([]);
    }
  }
  // close together (LTV 30): one label moves above the line; far apart on a wide screen (LTV 50): one row
  // (the terms are typed at desktop width: on phones they are folded away)
  await page.locator('#f-initialLtv').fill('30'); await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator('#falls-text .ladder.two-rows')).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.locator('#f-initialLtv').fill('50');
  await expect(page.locator('#falls-text .ladder.two-rows')).toHaveCount(0);
  await page.locator('#lang-btn').click(); await page.locator('[data-lang="de"]').click();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator('#falls-text .lab-sale')).toContainText('Liquidation');
  await expect.poll(overlaps).toEqual([]);
});

test('tile labels are never broken inside a word, only at spaces or proper hyphenation points (narrowest phone, both languages)', async ({ page }) => {
  await visit(page, '/', { width: 320 });
  for (const w of [320, 375]) {
  await page.setViewportSize({ width: w, height: 812 });
  const broken = () => page.locator('#tiles .label').evaluateAll((els) => els.filter((el) => {
    // a word is broken if one of its letters starts a new line: compare each letter's line with the previous letter's
    // a break at a space or a soft hyphen (Gesamt-kosten, a proper German hyphenation) is fine; Chrome reports the
    // letter right after a soft-hyphen break on the old line, so the word restarts one letter later
    const r = document.createRange(); const t = el.firstChild; let prevTop = null; let skip = 1;
    for (let i = 0; t && i < t.length; i++) {
      const ch = t.data[i];
      if (/\s/.test(ch)) { skip = 1; continue; }
      if (ch === '\u00AD') { skip = 2; continue; }
      r.setStart(t, i); r.setEnd(t, i + 1); const top = Math.round(r.getBoundingClientRect().top);
      if (skip > 0) skip--; else if (top > prevTop) return true;
      prevTop = top;
    }
    return false;
  }).map((el) => el.textContent));
  await expect.poll(broken).toEqual([]);
  await page.locator('#lang-btn').click(); await page.locator('[data-lang="de"]').click();
  await expect(page.locator('#tiles')).toContainText('Liquidiert bei');
  await expect.poll(broken).toEqual([]);
  await page.locator('#lang-btn').click(); await page.locator('[data-lang="en"]').click();
  }
});

test('"Insights": all 11, each with what was measured and a table or chart; the line under the answer leads to the first group', async ({ page }) => {
  const errors = await visit(page, '/insights/');
  await expect(page).toHaveTitle('Insights · Bitcoin Loan Check');
  await expect(page.locator('.toc li')).toHaveCount(5);
  const ids = ['survival', 'falls', 'speed', 'levers', 'reserve', 'partial', 'cost', 'measure', 'buy', 'spend', 'swings'];
  for (const id of ids) {
    await expect(page.locator(`#i-${id} h3`)).toBeVisible();
    await expect(page.locator(`#i-${id} table, #i-${id} .levers, #i-${id} svg`).first()).toBeVisible();
  }
  await expect(page.locator('.ins .take')).toHaveCount(10); // every insight except the lever list states its result in one sentence
  await expect(page.locator('#i-survival td.heat')).toHaveCount(24);
  await expect(page.locator('#basis')).toContainText('US dollars');
  await expect(page.locator('#swings-chart svg')).toHaveCount(1);
  // no "best" or advice wording in the insights (the intro says on purpose: never what is "best")
  for (const el of await page.locator('.ins').all()) await expect(el).not.toContainText(/\bbest\b|recommend|you should/i);
  expect(errors).toEqual([]);
  // from the check: the line under the answer opens the insights at the first group
  await visit(page, '/');
  await page.locator('#fall-hook a').click();
  await expect(page).toHaveURL(/\/insights\/#buffer$/);
  await expect(page.locator('#buffer h2')).toBeInViewport();
});

test('"Insights" on a 375 px phone: no sideways scrolling, neither the page nor any table (both languages)', async ({ page }) => {
  for (const path of ['/insights/', '/de/insights/']) {
    await visit(page, path, { width: 375 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect(await page.locator('.table-wrap').evaluateAll((ws) => ws.filter((w) => w.scrollWidth > w.clientWidth + 1).map((w) => w.getAttribute('aria-label')))).toEqual([]);
  }
});
