// The three pages together: navigation, the "How it works" and "Insights" pages, languages, and
// the check page trimmed after the content audit (ux/H-content-audit.md).
import { test, expect } from '@playwright/test';
import { openFolded } from './helpers.js';

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

test('"How it works": three layers, every part, the charts and tables of the example loan, no errors or security refusals', async ({ page }) => {
  const errors = await visit(page, '/method/');
  await expect(page).toHaveTitle('How it works · Bitcoin Loan Check');
  await expect(page.locator('.toc li')).toHaveCount(12);
  await expect(page.locator('p.layer')).toHaveText(['For everyone', 'The details', 'For experts']);
  for (const id of ['one-future', 'volatility', 'your-number', 'rules', 'risk-cost', 'methods', 'test', 'data', 'trend', 'model-limits', 'maths', 'verify']) await expect(page.locator(`#${id} h2`)).toBeVisible();
  // one simulated future: a real path, coloured piece by piece, with the margin-call and liquidation lines
  await expect(page.locator('#one-chart path.piece-a').first()).toBeVisible();
  await expect(page.locator('#one-chart path.line-critical')).toHaveCount(1);
  await expect(page.locator('#one-steps li')).toHaveCount(4);
  await expect(page.locator('#one-steps')).toContainText(/the loan is liquidated on day \d+/);
  // volatility per year: one bar per year since 2014, and the weighting table with this page's row marked
  const years = new Date().getUTCFullYear() - 2014 + 1;
  await expect(page.locator('#vol-chart rect.bar')).toHaveCount(years);
  await expect(page.locator('#vol-table tbody tr')).toHaveCount(5);
  await expect(page.locator('#vol-table tr.us')).toContainText('Half-life 3 years (this page)');
  await expect(page.locator('#your-number .dots i')).toHaveCount(100);
  await expect(page.locator('#rules-list li')).toHaveCount(5);
  await expect(page.locator('#rules-list')).toContainText(/the sale is counted at the lowest price of that hour, never above the liquidation price/);
  await expect(page.locator('#rules-changed')).toContainText('Changed on 27 October 2026');
  // decision 022: the example's margin call is only a warning; the deadline figures say "if the lender sold after …"
  await expect(page.locator('#rules-list')).toContainText(/If the lender sold everything when a margin call is not fixed within 1 day, the example would give \d+ of 100; within 2 days \d+, within 3 days \d+\. With only a warning, as in the example: \d+\./);
  await expect(page.locator('#example-changed')).toContainText('Changed on 27 October 2026: the example\'s margin call is now only a warning');
  await expect(page.locator('#methods-table tbody tr')).toHaveCount(4);
  await expect(page.locator('#fan-chart path.band-outer')).toHaveCount(1);
  await expect(page.locator('#months-chart svg')).toHaveCount(1);
  await expect(page.locator('#test-bars .lv')).toHaveCount(4);
  await expect(page.locator('#trend-facts')).toContainText('Since 2014, BTC grew by about');
  await expect(page.locator('#data')).toContainText('European Central Bank');
  await expect(page.locator('#data')).toContainText('Your lender decides which BTC price counts');
  // the maths: folded, with the fitted values filled in
  await expect(page.locator('details.maths')).not.toHaveAttribute('open', '');
  await page.locator('details.maths > summary').click();
  await expect(page.locator('#m-garch')).toContainText(/α = 0\.\d+, β = 0\.\d+/);
  await expect(page.locator('#m-code a')).toHaveCount(7);
  await expect(page.locator('#verify a').first()).toHaveAttribute('href', 'https://github.com/boddenlennart/btc-loan-risk');
  await page.locator('#methods a.gloss').first().click(); // a glossary word opens the glossary in the footer
  await expect(page.locator('#glossary')).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('"How it works", the cost of the risk: one future worked through, the average, the scaling, the textbook cross-check, the same number as the check', async ({ page }) => {
  const errors = await visit(page, '/method/');
  await expect(page.locator('#risk-one')).toContainText(/the example loan is liquidated on day \d+ at €[\d,]+\. 0\.\d{4} BTC repaid the loan, 0\.\d{4} BTC was the liquidation fee\. .* Liquidation fee: 0\.\d{4} × €[\d,]+ = €[\d,]+\./);
  await expect(page.locator('#risk-one')).toContainText(/In this future: €[\d,]+\./);
  await expect(page.locator('#risk-all')).toContainText(/In [\d,]+ futures nothing is sold, so their cost is €0\. In the other [\d,]+, it is €[\d,]+ on average/);
  // the average written out: the arithmetic on the page adds up
  const nums = (s) => [...s.matchAll(/[\d][\d,.]*/g)].map((m) => Number(m[0].replace(/,/g, '')));
  const f1 = await page.locator('#risk-formula').textContent();
  const [n, , none, , sold, avg, , sum, , risk] = nums(f1); // all N costs ÷ N = (none × €0 + sold × avg) ÷ N = sum ÷ N = risk
  expect(none + sold).toBe(n);
  expect(Math.abs(sum / n - risk)).toBeLessThanOrEqual(0.5);
  expect(Math.abs((sold * avg) / n - risk)).toBeLessThanOrEqual(1);
  const f2 = await page.locator('#risk-formula2').textContent();
  const [share, avg2, risk2] = nums(f2);
  expect(risk2).toBe(risk); expect(Math.abs(share * avg2 - risk)).toBeLessThanOrEqual(1); // the share is shown exactly
  await expect(page.locator('#risk-all-end')).toContainText(/Precise to about ±€[\d,]+\./);
  await expect(page.locator('#risk-scale')).toContainText(/the average end price is \d+% higher/);
  await expect(page.locator('#risk-table tbody tr')).toHaveCount(2);
  await expect(page.locator('#risk-table tr.us')).toContainText('This page\'s simulation');
  await expect(page.locator('#risk-read li')).toHaveCount(3);
  await expect(page.locator('#risk-cost')).toContainText('Loans without a liquidation during the term');
  const sim = Number((await page.locator('#risk-table tr.us td').textContent()).replace(/[^\d]/g, ''));
  expect(errors).toEqual([]);
  // the check shows the same cost of the risk, rounded to 10
  await visit(page, '/');
  await expect(page.locator('#progress')).toBeHidden();
  await page.locator('#sec-cost > summary').click();
  await expect(page.locator('#risk-cost')).toContainText(`€${(Math.round(sim / 10) * 10).toLocaleString('en-GB')} of it is the cost of the risk`);
});

test('"How it works" shows the same numbers as the check page: the answer, the dots, the weighting row, real history', async ({ page }) => {
  await visit(page, '/method/');
  const sim = (await page.locator('#methods-table tbody tr').first().locator('td').last().textContent()).trim();
  const hist = (await page.locator('#methods-table tbody tr').nth(2).locator('td').last().textContent()).trim();
  await expect(page.locator('#vol-table tr.us td').last()).toHaveText(sim);
  await expect(page.locator('#your-number .dots i.d-liq')).toHaveCount(Number(sim));
  await expect(page.locator('#num-list')).toContainText(`shown as ${sim}.`);
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
        await openFolded(page, 'footer');
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

test('tile labels are never broken inside a word, only at spaces or proper hyphenation points (narrowest phone, both languages)', { tag: '@phone' }, async ({ page }) => {
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

test('tiles on phones: every word and number stays whole and inside its tile, in both languages and four currencies (UAT finding 4)', { tag: '@phone' }, async ({ page }) => {
  test.setTimeout(240_000);
  await visit(page, '/', { width: 375 });
  // every letter of every text in the tiles: inside the tile, and a word only continues on a new line after a space or soft hyphen
  const problems = () => page.locator('#tiles .tile').evaluateAll((tiles) => tiles.flatMap((tile) => {
    const box = tile.getBoundingClientRect(); const out = [];
    const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT); let t;
    while ((t = walker.nextNode())) {
      const r = document.createRange(); let prevTop = null; let skip = 1;
      for (let i = 0; i < t.length; i++) {
        const ch = t.data[i];
        if (/[\s]/.test(ch) && ch !== ' ') { skip = 1; continue; }
        if (ch === '­') { skip = 2; continue; }
        r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getBoundingClientRect();
        if (b.width === 0) continue;
        if (b.right > box.right + 0.5 || b.left < box.left - 0.5) { out.push(`clipped: "${t.data}"`); break; }
        const top = Math.round(b.top);
        if (skip > 0) skip--; else if (top > prevTop) { out.push(`split: "${t.data}"`); break; }
        prevTop = top;
      }
    }
    return out;
  }));
  const done = async () => { await expect(page.locator('#progress')).toBeHidden({ timeout: 60_000 }); await page.waitForTimeout(300); };
  await page.locator('#own-terms-link').click();
  for (const w of [320, 375]) {
    await page.setViewportSize({ width: w, height: 812 });
    for (const lang of ['en', 'de']) {
      if (lang === 'de') { await page.locator('#lang-btn').click(); await page.locator('[data-lang="de"]').click(); await expect(page.locator('#tiles')).toContainText('Liquidiert bei'); }
      for (const cur of ['EUR', 'USD', 'CHF', 'CZK']) {
        await page.locator('#form [data-k="currency"]').selectOption(cur); await done();
        expect(await problems(), `${w} px, ${lang}, ${cur}`).toEqual([]);
      }
      // the longest label: a partial sale at the liquidation LTV
      await openFolded(page, '#form');
      await page.locator('#form [data-set="liquidationSale"][data-val="partial"]').click(); await done();
      expect(await problems(), `${w} px, ${lang}, partial sale`).toEqual([]);
      await page.locator('#form [data-set="liquidationSale"][data-val="all"]').click();
      await page.locator('#form [data-k="currency"]').selectOption('EUR');
      if (lang === 'de') { await page.locator('#lang-btn').click(); await page.locator('[data-lang="en"]').click(); await expect(page.locator('#tiles')).toContainText('Liquidated at'); }
    }
  }
});

test('no page scrolls sideways at 320 px, with every folded part open (= 400% zoom; UAT finding 11)', { tag: '@phone' }, async ({ page }) => {
  for (const path of ['/', '/insights/', '/method/', '/de/', '/de/method/']) {
    await visit(page, path, { width: 320 });
    if (await page.locator('#own-terms-link').isVisible()) await page.locator('#own-terms-link').click(); // the terms, folded on phones
    await openFolded(page);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth,
      out: [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.table-wrap')).slice(0, 3).map((e) => `${e.tagName} "${e.textContent.slice(0, 40)}"`) }));
    expect(r.out, path).toEqual([]);
    expect(r.sw, path).toBeLessThanOrEqual(r.w);
  }
});

test('chart axes: every price label lies inside its chart, in four currencies and both languages (UAT finding 5)', { tag: '@phone' }, async ({ page }) => {
  test.setTimeout(180_000);
  const clipped = () => page.evaluate(() => [...document.querySelectorAll('.chart svg')].flatMap((svg) => {
    const box = svg.getBoundingClientRect(); if (!box.width) return [];
    return [...svg.querySelectorAll('text.axis')].filter((t) => { const b = t.getBoundingClientRect(); return b.width && (b.left < box.left - 0.5 || b.right > box.right + 0.5); }).map((t) => t.textContent);
  }));
  for (const width of [375, 1280]) {
    await visit(page, '/', { width });
    if (width < 1024) await page.locator('#own-terms-link').click();
    for (const id of ['sec-falls', 'sec-history']) await page.locator(`#${id} > summary`).click();
    for (const lang of ['en', 'de']) {
      if (lang === 'de') { await page.locator('#lang-btn').click(); await page.locator('[data-lang="de"]').click(); }
      for (const cur of ['EUR', 'USD', 'CHF', 'CZK']) {
        await page.locator('#form [data-k="currency"]').selectOption(cur);
        await expect(page.locator('#progress')).toBeHidden({ timeout: 60_000 }); await page.waitForTimeout(400);
        expect(await clipped(), `${width} px, ${lang}, ${cur}`).toEqual([]);
      }
      await page.locator('#form [data-k="currency"]').selectOption('EUR');
      if (lang === 'de') { await page.locator('#lang-btn').click(); await page.locator('[data-lang="en"]').click(); }
    }
    for (const path of ['/method/', '/de/method/']) { await visit(page, path, { width }); expect(await clipped(), `${width} px ${path}`).toEqual([]); }
  }
});

test('links to other websites open in a new tab and say so to screen readers; the page itself stays open', async ({ page, context }) => {
  for (const path of ['/', '/method/', '/insights/', '/de/', '/de/method/']) {
    await visit(page, path);
    await openFolded(page);
    const links = await page.locator('a[href^="http"]').evaluateAll((as) => as.filter((a) => new URL(a.href).origin !== location.origin)
      .map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel, hint: (a.querySelector('.visually-hidden') || {}).textContent || '' })));
    expect(links.length, path).toBeGreaterThan(0);
    for (const l of links) {
      expect(l.target, `${path} ${l.href}`).toBe('_blank');
      expect(l.rel, `${path} ${l.href}`).toContain('noopener');
      expect(l.hint.trim(), `${path} ${l.href}`).toMatch(path.startsWith('/de/') ? /neuen Tab/ : /new tab/);
    }
  }
  // issue #9: the maker's LinkedIn page and the Impressum's contact form, both in a new tab
  for (const path of ['/', '/de/']) {
    await visit(page, path);
    await expect(page.locator('#maker a[href="https://linkedin.com/in/lennart-bodden"]')).toContainText('LinkedIn');
    await page.locator('#impressum > summary').click();
    await expect(page.locator('#impressum-body a[href="https://mein.online-impressum.de/bitcoinloancheck/"]')).toBeVisible();
  }
  await visit(page, '/');
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('#code-link').click()]);
  expect(tab).toBeTruthy();
  expect(new URL(page.url()).pathname).toBe('/'); // the check page did not navigate away
});

test('"Insights": all 12, each with what was measured and a table or chart; the line under the answer leads to the first group', async ({ page }) => {
  const errors = await visit(page, '/insights/');
  await expect(page).toHaveTitle('Insights · Bitcoin Loan Check');
  await expect(page.locator('.toc li')).toHaveCount(5);
  const ids = ['survival', 'falls', 'speed', 'levers', 'reserve', 'partial', 'cost', 'measure', 'buy', 'spend', 'swings', 'entry'];
  for (const id of ids) {
    await expect(page.locator(`#i-${id} h3`)).toBeVisible();
    await expect(page.locator(`#i-${id} table, #i-${id} .levers, #i-${id} svg`).first()).toBeVisible();
  }
  await expect(page.locator('.ins .take')).toHaveCount(11); // every insight except the lever list states its result in one sentence
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

test('"Insights" on a 375 px phone: no sideways scrolling, neither the page nor any table (both languages)', { tag: '@phone' }, async ({ page }) => {
  for (const path of ['/insights/', '/de/insights/']) {
    await visit(page, path, { width: 375 });
    const tooWide = () => page.locator('.table-wrap').evaluateAll((ws) => ws.filter((w) => w.scrollWidth > w.clientWidth + 1).map((w) => w.getAttribute('aria-label')));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect(await tooWide()).toEqual([]);
    // Phones and computers have different system fonts; Linux's is about 10% wider than a Mac's and
    // pushed three German tables over the edge (found on GitHub, 20 Oct). Elsewhere the text is widened
    // to about Linux's width; on Linux (GitHub's test computers) the font is already the wide one.
    if (process.platform !== 'linux') {
      await page.addStyleTag({ content: 'table { letter-spacing: 0.06em; }' });
      expect(await tooWide(), `${path}, wider font`).toEqual([]);
    }
  }
});

test('light/dark switch: follows the device first, the choice sticks on every page and is applied before drawing; "Start over" forgets it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const errors = await visit(page, '/');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const btn = page.locator('#theme-btn');
  await expect(btn).toHaveAttribute('aria-label', 'Switch to light mode'); // the device is dark
  const dark = await bg();
  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode');
  expect(await bg()).not.toBe(dark);
  // other page, then reload: still light, set before the page's own script runs
  await page.locator('.desk-nav').getByText('How it works').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.themeAtStart = document.documentElement.dataset.theme; }));
  await page.reload();
  expect(await page.evaluate(() => window.themeAtStart)).toBe('light');
  await page.goto('/');
  await page.locator('#forget-btn').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  expect(await bg()).toBe(dark);
  expect(errors).toEqual([]);
});

test('top bar on narrow phones (320 and 375 px): the name stays on one line, nothing overlaps', { tag: '@phone' }, async ({ page }) => {
  for (const width of [320, 375]) {
    await visit(page, '/', { width });
    const box = (s) => page.locator(s).boundingBox();
    const [brand, theme, lang] = [await box('.brand span'), await box('#theme-btn'), await box('#lang-btn')];
    expect(brand.height, `${width}px: name on one line`).toBeLessThan(30);
    expect(brand.x + brand.width).toBeLessThanOrEqual(theme.x);
    expect(theme.x + theme.width).toBeLessThanOrEqual(lang.x);
    expect(lang.x + lang.width).toBeLessThanOrEqual(width);
  }
});

test('charts on a 375 px phone: axis text really 12 px, labels do not overlap, tooltips still work', { tag: '@phone' }, async ({ page }) => {
  await visit(page, '/method/', { width: 375 });
  for (const id of ['#fan-chart', '#months-chart']) {
    const info = await page.locator(`${id} svg`).evaluate((svg) => {
      const texts = [...svg.querySelectorAll('text.axis')].map((t) => t.getBoundingClientRect());
      const bottom = texts.filter((b) => Math.abs(b.bottom - Math.max(...texts.map((x) => x.bottom))) < 2).sort((a, b) => a.left - b.left);
      return { size: parseFloat(getComputedStyle(svg.querySelector('text.axis')).fontSize) * (svg.getBoundingClientRect().width / svg.viewBox.baseVal.width), overlaps: bottom.some((b, i) => i > 0 && b.left < bottom[i - 1].right + 2), inside: texts.every((b) => b.right <= svg.getBoundingClientRect().right + 1 && b.left >= svg.getBoundingClientRect().left - 1) };
    });
    expect(info.size, id).toBeGreaterThanOrEqual(11.5);
    expect(info.overlaps, id).toBe(false);
    expect(info.inside, `${id}: a label is cut off`).toBe(true);
  }
  const svg = page.locator('#fan-chart svg'); await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await expect(page.locator('#fan-chart .tip')).toBeVisible();
});

test('reading pages: every section starts at the same left edge as the page title', { tag: '@phone' }, async ({ page }) => {
  for (const path of ['/method/', '/insights/']) {
    await visit(page, path);
    const left = await page.locator('h1').evaluate((h) => Math.round(h.getBoundingClientRect().left));
    for (const h of await page.locator('main .part h2').all()) expect(await h.evaluate((x) => Math.round(x.getBoundingClientRect().left)), `${path} ${await h.textContent()}`).toBe(left);
    // lists are not indented: a bullet (or number) starts at the text's left edge; only its own width is kept free
    for (const l of await page.locator('main .part ul:visible, main .part ol:visible').all()) { // (folded parts have no position)
      const pad = await l.evaluate((x) => parseFloat(getComputedStyle(x).paddingLeft) / parseFloat(getComputedStyle(x).fontSize));
      expect(pad, `${path} list "${(await l.textContent()).slice(0, 40)}"`).toBeLessThanOrEqual(1.6);
      expect(await l.evaluate((x) => Math.round(x.getBoundingClientRect().left)), path).toBe(left);
    }
  }
});

test('whole-site review fixes: fixed model settings, no repeats, the volatility figures explained, links between the pages', async ({ page }) => {
  await visit(page, '/');
  // S1: the model's own settings are not on the page and cannot come in through a shared link
  await page.locator('#own-terms-link').click();
  await page.locator('details.more[data-remember="expert"] > summary').click();
  await expect(page.locator('#form')).not.toContainText('Simulated futures');
  await expect(page.locator('[data-k="simPaths"], [data-k="bootstrapBlockDays"]')).toHaveCount(0);
  // S2: "you get back" once (the answer), the falls section says what it adds
  await page.locator('#sec-falls > summary').click();
  await expect(page.locator('#sold-line')).toContainText('If liquidated: you get back at most');
  await expect(page.locator('#falls-text')).not.toContainText('get back');
  // S4, S5
  await expect(page.locator('#safer-body')).toContainText('Other options (liquidated, of 100)');
  await expect(page.locator('#headline-help')).toContainText('with recent years counting more');
  await visit(page, '/method/');
  await expect(page.locator('#measure a')).toHaveAttribute('href', '/insights/#i-measure');
  await expect(page.locator('#barrier-note')).toHaveCount(0);
  await expect(page.locator('#your-number .to-check a')).toHaveAttribute('href', '/');
  await expect(page.locator('#methods-table')).toContainText('its estimate of today\'s volatility');
  await visit(page, '/insights/');
  await expect(page.locator('#i-swings')).toContainText(/the simulation on the check assumes \d+% a year/);
});

test('"Where to find these numbers": the five words to look for, without a sample text', async ({ page }) => {
  await visit(page, '/');
  await page.locator('#own-terms-link').click();
  await page.locator('button[aria-controls="where"]').click();
  await expect(page.locator('#where')).toContainText('Look for these words');
  await expect(page.locator('#where .sample')).toHaveCount(0);
  await expect(page.locator('#where ol li')).toHaveCount(5);
});

// Owner, 21 Oct 2026: more Bitcoin feel, still factual. The halvings are marked in the one chart with calendar dates.
test('Insights: the price-swings chart marks the three halvings, each between its own years, in both languages', async ({ page }) => {
  for (const [path, word] of [['/insights/', 'Dashed lines: the halvings of 2016, 2020 and 2024'], ['/de/insights/', 'Gestrichelte Linien: die Halvings 2016, 2020 und 2024']]) {
    await visit(page, path);
    const chart = page.locator('#swings-chart');
    await expect(chart.locator('line.line-mark')).toHaveCount(3);
    await expect(chart.locator('text', { hasText: /^Halving$/ })).toHaveCount(3);
    await expect(page.locator('main')).toContainText(word);
    // each marker sits between the year labels around it (2016 lies between "2015" and "2017")
    const pos = await chart.evaluate((el) => ({
      marks: [...el.querySelectorAll('line.line-mark')].map((l) => Number(l.getAttribute('x1'))),
      years: Object.fromEntries([...el.querySelectorAll('text.axis')].filter((t) => /^20\d\d$/.test(t.textContent)).map((t) => [t.textContent, Number(t.getAttribute('x'))])),
    }));
    for (const [i, yr] of [[0, 2016], [1, 2020], [2, 2024]]) {
      const before = pos.years[yr - 1] ?? pos.years[yr - 2]; const after = pos.years[yr + 1] ?? pos.years[yr + 2];
      expect(pos.marks[i], `halving ${yr}`).toBeGreaterThan(before); expect(pos.marks[i], `halving ${yr}`).toBeLessThan(after);
    }
  }
});
