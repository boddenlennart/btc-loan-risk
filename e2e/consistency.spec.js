// Every number on the page that a careful reader can compare with another one must agree with it.
// Each number was tested on its own; the owner still found pairs that disagreed (21 Oct 2026: the
// futures chart had 13 liquidations where the answer said 15; "zero in 47 of 100" next to 54
// liquidated). This file opens 30 very different loans, reads the numbers from the screen as a
// visitor sees them, and checks the rules that tie them together (list: ux/P-consistency.md).
import { test, expect } from '@playwright/test';
import { encodeState } from '../src/app/share.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';
import { openFolded } from './helpers.js';

// The rules are about the page's logic, not about a browser engine: Chrome's engine only, to keep the run short.
test.beforeEach(({ browserName }) => { test.skip(browserName !== 'chromium', 'numbers are the same in every engine'); });
test.describe.configure({ mode: 'parallel' });

const E = { ...EXAMPLE_FORM, isExample: false };
export const LOANS = [
  ['the example', {}],
  ['starting LTV 20%', { initialLtv: 20 }],
  ['starting LTV 30%', { initialLtv: 30 }],
  ['starting LTV 40%', { initialLtv: 40 }],
  ['starting LTV 62%', { initialLtv: 62 }],
  ['starting LTV 68%, close to the margin call', { initialLtv: 68 }],
  ['liquidation at 90%', { liquidationLtv: 90, marginCallLtv: 80 }],
  ['liquidation at 75%, margin call 65%', { liquidationLtv: 75, marginCallLtv: 65 }],
  ['3 months', { durationMonths: 3 }],
  ['6 months', { durationMonths: 6 }],
  ['24 months', { durationMonths: 24 }],
  ['36 months', { durationMonths: 36 }],
  ['margin call only a warning', { marginCallConsequence: 'warningOnly' }],
  ['the lender sells part at the margin call', { marginCallConsequence: 'autoPartial' }],
  ['part sold when the time to top up ends', { marginCallConsequence: 'partialAfterCure' }],
  ['part sold at the liquidation LTV', { liquidationSale: 'partial', marginCallConsequence: 'warningOnly' }],
  ['no margin call', { marginCallLtv: '' }],
  ['a loan I already have', { mode: 'existing', collateralBtc: '0.35', durationMonths: 9 }],
  ['a loan I already have, past its margin call', { mode: 'existing', collateralBtc: '0.23', durationMonths: 6 }],
  ['buy more BTC', { purpose: 'buy' }],
  ['buy more BTC, repaid in cash', { purpose: 'buy', repayWith: 'cash' }],
  ['variable rate', { rateType: 'variable' }],
  ['interest added, paid at the end', { repayment: 'bullet', compounding: 'monthly' }],
  ['equal payments', { repayment: 'amortizing', durationMonths: 24 }],
  ['US dollars', { currency: 'USD' }],
  ['Swiss francs', { currency: 'CHF', initialLtv: 40 }],
  ['Czech crowns', { currency: 'CZK', loanAmount: 250000 }],
  ['cash reserve for a margin call', { reserveAmount: 3000 }],
  ['high fees', { liquidationFee: 10, originationFee: { value: 3, type: 'percent' } }],
  ['tax on selling', { taxRateNow: 25, taxRateAtMaturity: 25, purpose: 'buy' }],
];

const ALLOWED = ['127.0.0.1', 'www.bitstamp.net', 'api.coinbase.com'];
async function open(page, form) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https:\/\//, (route) => {
    const u = route.request().url();
    if (u.includes('api.coinbase.com')) return route.fulfill({ json: { data: { amount: '60000' } } });
    if (u.includes('www.bitstamp.net')) return route.fulfill({ json: { data: { ohlc: [] } } });
    return route.abort();
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('set')) { localStorage.clear(); localStorage.setItem('btc-loan-risk:lang', 'en'); sessionStorage.setItem('set', '1'); } } catch {} });
  await page.goto(`/${encodeState(form)}`);
  await waitDone(page);
  return errors;
}
const waitDone = async (page) => { await expect(page.locator('#progress')).toBeHidden({ timeout: 60000 }); await expect(page.locator('body')).toHaveAttribute('data-ready', '1'); };
const int = (s) => Number(String(s).replace(/[^\d]/g, ''));
const money = (s) => Number(String(s).replace(/[^\d.]/g, '').replace(/\.$/, ''));
const one = (text, re, what) => { const m = text.match(re); expect(m, `${what}: not found in "${text.slice(0, 160)}"`).not.toBeNull(); return m; };

/** Reads every number the check page shows for the current loan (all folded parts open). */
async function readPage(page) {
  await openFolded(page, 'main');
  // the five sets of the futures chart, as the owner counted them
  const sets = [];
  for (let k = 0; k < 5; k++) {
    await expect(page.locator('#futures-line')).toContainText('of these 20'); // drawn a moment after opening
    sets.push(Number((await page.locator('#futures-line').textContent()).match(/(\d+) of these 20/)[1]));
    await page.locator('#other-paths').click();
  }
  return {
    sets,
    ...(await page.evaluate(() => {
      const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
      const rows = (sel) => [...document.querySelectorAll(`${sel} .lv`)].map((r) => [r.querySelector('span').textContent.trim(), r.querySelector('b').textContent.trim(), r.classList.contains('base')]);
      const legend = (sel) => [...document.querySelectorAll(`${sel} .legend span`)].map((s) => s.textContent.trim());
      const dots = (sel) => { const c = {}; for (const i of document.querySelectorAll(`${sel} .dots i`)) c[i.className] = (c[i.className] || 0) + 1; return c; };
      return {
        n: txt('#headline-text em'), hero: txt('#headline-text'), legend: legend('#dots'), dots: dots('#dots'),
        futuresLine: txt('#futures-line'), falls: txt('#falls-text'),
        tiles: [...document.querySelectorAll('#tiles .tile')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()), tileRisk: txt('#tiles a.tile-risk'),
        cost: txt('#sec-cost'), riskCost: txt('#risk-cost'),
        safer: rows('#safer'), slider: txt('#slider-line'), sliderShown: !!document.querySelector('#safer .slider:not([hidden])'), best: txt('#best-lever'),
        trend: rows('#trend-body'), methods: txt('#methods-line'), history: txt('#history-text'), stress: txt('#stress-line'), historySum: txt('#history-sum'),
        years: [...document.querySelectorAll('#years-table tbody tr')].map((r) => [...r.cells].map((c) => c.textContent.trim())),
        entryTotal: [...document.querySelectorAll('#entry-table tfoot td')].map((c) => c.textContent.trim()),
        leverage: txt('#leverage'), levLegend: legend('#leverage'), levDots: dots('#leverage'),
        ownLtv: (() => { const f = document.querySelector('#f-initialLtv'); return f && f.offsetParent && f.value !== '' ? Number(f.value) : null; })(), // typed as an LTV (not as BTC)
      };
    })),
  };
}

/** The rules. Each one names the two places a reader would compare. */
function checkRules(d, label) {
  const n = Number(d.n);
  const at = (what) => `${label}: ${what}`;
  // 1. the dots under the answer: 100 in all; liquidated (in full or in part) = the big number
  const leg = Object.fromEntries(d.legend.map((s) => { const m = s.match(/^(\d+) (.+)$/); return [m[2], Number(m[1])]; }));
  expect(Object.values(leg).reduce((a, b) => a + b, 0), at('legend adds up to 100')).toBe(100);
  expect((leg.liquidated || 0) + (leg['partly liquidated'] || 0), at('legend liquidated + partly = the big number')).toBe(n);
  expect(Object.values(d.dots).reduce((a, b) => a + b, 0), at('100 dots')).toBe(100);
  expect(d.dots['d-liq'] || 0, at('red dots = legend "liquidated"')).toBe(leg.liquidated || 0);
  const full = d.hero.match(/; (\d+) of them in full/);
  if (full) expect(Number(full[1]), at('"of them in full" = legend "liquidated"')).toBe(leg.liquidated || 0);
  // 2. the futures chart: the five sets together = the big number, and the sentence says so
  expect(d.sets.reduce((a, b) => a + b, 0), at('five sets of 20 futures add up to the big number')).toBe(n);
  expect(Number(one(d.futuresLine, /so that (\d+) of them end/, 'futures sentence')[1]), at('futures sentence')).toBe(n);
  // 3. the cost of the risk: zero in 100 − the big number of futures
  if (d.riskCost) {
    expect(Number(one(d.riskCost, /In (\d+) of 100 futures it is zero/, 'zero count')[1]), at('"zero in X of 100" = 100 − the big number')).toBe(100 - n);
    // 4. the tile and "What it costs" show the same total (and the same yearly rate)
    const line = one(d.riskCost, /Including the liquidation risk: about ((?:[A-Z]{2,3} )?[^\s(]*[\d,]+)(?: \(about ([\d.]+%) a year instead of ([\d.]+%)\))?/, 'risk line');
    const tile = one(d.tileRisk, /about ((?:[A-Z]{2,3} )?[^\s·]*[\d,]+)(?: · ([\d.]+%))?/, 'tile risk line');
    expect(money(tile[1]), at('tile total = "Including the liquidation risk" total')).toBe(money(line[1]));
    if (line[2]) expect(tile[2], at('tile rate = "What it costs" rate')).toBe(line[2]);
    // 5. the total is the cost if nothing goes wrong plus the cost of the risk (each rounded to 10)
    const risk = money(one(d.riskCost, /([\d,]+) of it is the cost of the risk/, 'risk part')[1]);
    const base = /months left, instead of/.test(d.riskCost) ? one(d.riskCost, /instead of ((?:[A-Z]{2,3} )?[^\s]*[\d,.]+\d) interest/, 'interest')[1] : one(d.cost, /The loan costs ((?:[A-Z]{2,3} )?[^\s]*[\d,.]+\d) if nothing goes wrong/, 'cost line')[1];
    expect(Math.abs(money(line[1]) - money(base) - risk), at('total = cost + cost of the risk (rounding to 10)')).toBeLessThanOrEqual(10);
    if (line[3]) expect(d.cost, at('"instead of" rate = the cost line\'s rate')).toContain(`(${line[3]} a year including fees)`);
  }
  // 6. "Make it safer": your terms = the big number; the slider at your LTV says the same; the best change matches its row
  const base = d.safer.find((r) => r[2]);
  if (base) expect(int(base[1]), at('"Your terms" row = the big number')).toBe(n);
  // (the slider moves in steps of 5 points: compared only when it sits at your own LTV)
  const own = d.slider.match(/^Starting LTV (\d+)% → (\d+) of 100/);
  if (d.sliderShown && own && d.ownLtv !== null && Number(own[1]) === d.ownLtv) expect(Number(own[2]), at('slider line at your LTV')).toBe(n);
  const best = d.best.match(/One change lowers this: (.+) → (\d+) of 100/);
  if (best) {
    const row = d.safer.find((r) => r[0] === best[1]);
    expect(row, at(`best change "${best[1]}" has a row`)).toBeTruthy();
    expect(int(row[1]), at('best change = its row')).toBe(Number(best[2]));
  }
  // 7. "Does the price trend matter?": the row without a trend = the big number
  const none = d.trend.find((r) => r[0].startsWith('No trend'));
  if (none) expect(int(none[1]), at('trend "No trend" row = the big number')).toBe(n);
  // 8. real history: the number in "Other methods" = what the history section says (full + partial)
  const hm = d.methods.match(/Real history since 2014 (\d+) of 100/);
  // the start-years table's first row (2014 = all start days): [label, start days, liquidated, partly?]
  const y0 = d.years[0];
  const hr = y0 ? [null, y0[2], y0[3]] : null;
  if (hm && hr) expect(Number(hr[1]) + Number(hr[2] || 0), at('"Other methods" history = history section (full + partial)')).toBe(Number(hm[1]));
  // 9. buy more BTC: more + less = 100; liquidated there = liquidated under the answer
  if (d.levLegend.length) {
    const lv = Object.fromEntries(d.levLegend.map((s) => { const m = s.match(/^(\d+) (.+)$/); return [m[2], Number(m[1])]; }));
    expect(Object.values(lv).reduce((a, b) => a + b, 0), at('"buy more BTC" adds up to 100')).toBe(100);
    const lh = one(d.leverage, /In (\d+) of 100 futures you end with more BTC[^.]*\. In (\d+) of 100 with less \((\d+) of them liquidated\)/, 'leverage headline');
    expect(Number(lh[1]) + Number(lh[2]), at('"more" + "less" = 100')).toBe(100);
    expect(Number(lh[3]), at('"buy more BTC" liquidated = legend "liquidated" under the answer')).toBe(leg.liquidated || 0);
  }
  // 10. the liquidation price in the tile is the one in "What happens when BTC falls"
  const liqTile = d.tiles.find((x) => /^(Liquidated at|Partial liquidation at)/.test(x));
  if (liqTile && d.falls) {
    const price = one(liqTile, /at\s*((?:[A-Z]{2,3} )?[^\s\d]*[\d,]+)/, 'liquidation tile')[1];
    expect(d.falls, at('liquidation price: tile = "What happens when BTC falls"')).toContain(price);
  }
  // 16. entry timing (issue #12): the table's last row repeats the history line above it (full and partly liquidated)
  if (hr && d.entryTotal.length) {
    expect(Number(d.entryTotal[1]), at('entry table "All start days" = history line')).toBe(Number(hr[1]));
    if (d.entryTotal[2] !== undefined) expect(Number(d.entryTotal[2]), at('entry table "partly" = history line')).toBe(Number(hr[2] || 0));
  }
  // 17. real history (owner, 29 Oct 2026): the section's title line repeats the start-years table (2014 and 2020 rows)
  const hs = d.historySum.match(/^Liquidated (\d+) of 100 on start days since 2014(?: · (\d+) since 2020)?$/);
  if (d.years.length) {
    expect(hs, at('history title line')).not.toBeNull();
    expect(Number(hs[1]), at('title line 2014 = table 2014 row')).toBe(Number(d.years[0][2]));
    const y20 = d.years.find((r) => r[0].includes('2020'));
    if (y20) expect(Number(hs[2]), at('title line 2020 = table 2020 row')).toBe(Number(y20[2]));
  }
  // 15. calmer and wilder swings (decision 021): on the same futures, calmer never more than the big number, wilder never less.
  // Not for a loan already past its margin call: there calmer swings make a recovery less likely (98 vs 97 of 100, found 27 Oct 2026).
  const sl = one(d.stress, /^Assumes swings of (\d+)% a year\. As calm as BTC's calmest 12 months so far \((\d+)%\): (\d+) of 100\. As wild as 2017–2021 \((\d+)%\): (\d+) of 100\.$/, 'stress line');
  expect(Number(sl[2]), at('calm anchor below the simulation\'s swings')).toBeLessThan(Number(sl[1]));
  expect(Number(sl[4]), at('wild anchor above the simulation\'s swings')).toBeGreaterThan(Number(sl[1]));
  if (!label.includes('past its margin call')) {
    expect(Number(sl[3]), at('calmer swings: at most the big number')).toBeLessThanOrEqual(n);
    expect(Number(sl[5]), at('wilder swings: at least the big number')).toBeGreaterThanOrEqual(n);
  }
}

for (const [label, form] of LOANS) {
  test(`numbers agree with each other: ${label}`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await open(page, { ...E, ...form });
    checkRules(await readPage(page), label);
    expect(errors).toEqual([]);
  });
}

test('numbers agree with each other: comparing two offers, each column = that offer\'s own answer and cost', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, E);
  await page.locator('#compare-btn').click();
  await page.locator('#f-initialLtv').fill('35'); await waitDone(page);
  const col = async (row, i) => (await page.locator('#cmp tbody tr').filter({ hasText: row }).first().locator('td').nth(i).textContent()).replace(/\s+/g, ' ');
  for (const i of [1, 0]) { // B is selected after "Compare an offer"; then A
    if (i === 0) { await page.locator('#cmp [data-offer="0"]').click(); await waitDone(page); }
    const d = await readPage(page);
    checkRules(d, `offer ${i ? 'B' : 'A'}`);
    expect(int((await col('Liquidated, of 100', i)).match(/^\d+/)[0]), `offer ${i}: table "Liquidated" = its answer`).toBe(Number(d.n));
    const total = one(d.riskCost, /about ([^\s(]+[\d,]+)/, 'risk line')[1];
    expect(money((await col('Cost incl. liquidation risk', i)).match(/[^\s]*[\d,]+/)[0]), `offer ${i}: table cost incl. risk = its "What it costs"`).toBe(money(total));
  }
});

test('numbers agree with each other: a refinancing, the current loan and the new one each = their own answer', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, { ...E, mode: 'existing', collateralBtc: '0.4', durationMonths: 12 });
  const current = await page.locator('#headline-text em').textContent();
  await page.locator('#compare-btn').click();
  await page.locator('[data-set="refi.change"][data-val="more"]').click();
  await page.locator('#f-refiExtra').fill('1000'); await waitDone(page);
  const rowsLiq = page.locator('#cmp tbody tr').filter({ hasText: 'Liquidated, of 100' });
  expect(int(await rowsLiq.nth(0).locator('td').nth(0).textContent()), 'current loan column = its answer').toBe(Number(current));
  const refi = Number(await page.locator('#headline-text em').textContent());
  expect(int(await rowsLiq.nth(1).locator('td').nth(1).textContent()), 'refinancing, whole term = its answer').toBe(refi);
  // with the same length, "the next 12 months" and "the whole term" are the same futures and the same number
  expect(int(await rowsLiq.nth(0).locator('td').nth(1).textContent()), 'refinancing: next 12 months = whole term when both are 12 months').toBe(refi);
});

// How it works explains the example with the same simulation: its numbers are the check page's.
test('numbers agree with each other: How it works uses exactly the example\'s numbers from the check page', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, EXAMPLE_FORM);
  const d = await readPage(page);
  const n = Number(d.n);
  const [h, g] = one(d.methods, /Real history since 2014 (\d+) of 100, a volatility model (\d+) of 100/, 'other methods').slice(1).map(Number);
  const checkTotal = money(one(d.riskCost, /about (€[\d,]+)/, 'risk line')[1]);
  const checkRisk = money(one(d.riskCost, /(€[\d,]+) of it is the cost of the risk/, 'risk part')[1]);
  const [vol, calmVol, wildVol] = one(d.stress, /swings of (\d+%) a year\. .*\((\d+%)\): \d+ of 100\. .*\((\d+%)\): \d+ of 100/, 'stress line').slice(1);
  await page.goto('/method/');
  await expect(page.locator('#vol-stress')).toContainText(`(${calmVol}, up to `);
  await expect(page.locator('#vol-stress')).toContainText(`2017–2021 (${wildVol})`);
  await expect(page.locator('#vol-chart')).toContainText(`what the simulation uses: ${vol}`);
  const m = await page.evaluate(() => ({
    red: document.querySelectorAll('#num-dots i.d-liq').length,
    methods: [...document.querySelectorAll('#methods-table tbody tr')].map((r) => r.lastElementChild.textContent.trim()),
    formula: document.querySelector('#risk-formula').textContent, end: document.querySelector('#risk-all-end').textContent, read: document.querySelector('#risk-read').textContent,
  }));
  expect(m.red, 'red dots on How it works = the example\'s answer').toBe(n);
  expect(Number(m.methods[0]), 'methods table, simulation = the example\'s answer').toBe(n);
  expect(Number(m.methods[1]), 'methods table, volatility model = check page "Other methods"').toBe(g);
  expect(Number(m.methods[2]), 'methods table, real history = check page "Other methods"').toBe(h);
  const f = one(m.formula, /\((\d[\d,]*) × €0 \+ (\d[\d,]*) × €[\d,]+\) ÷ (\d[\d,]*) = €[\d,]+ ÷ [\d,]+ = (€[\d,]+)$/, 'formula');
  expect(int(f[1]) + int(f[2]), 'futures without + with a sale = all futures').toBe(int(f[3]));
  expect(Math.round(money(f[4]) / 10) * 10, 'cost of the risk, rounded to €10 = the check page').toBe(checkRisk);
  const total = money(one(m.end, /liquidation risk: (€[\d,]+) instead of/, 'total')[1]);
  expect(Math.abs(Math.round(total / 10) * 10 - checkTotal), 'cost including the risk = the check page (rounded to €10)').toBeLessThanOrEqual(10);
  expect(Number(one(m.read, /Zero in (\d+) of 100/, 'zero')[1]), '"zero in X of 100" = 100 − the answer').toBe(100 - n);
});

// The same loan in German shows the same numbers (only the way they are written differs).
test('numbers agree with each other: the same loans in German show the same numbers', async ({ page }) => {
  test.setTimeout(180_000);
  const numbers = (s, de) => (s.match(de ? /\d[\d.]*(?:,\d+)?/g : /\d[\d,]*(?:\.\d+)?/g) || []).map((x) => Number(de ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, ''))).sort((a, b) => a - b);
  // every piece of text on its own (side by side, "€42,857" and "−48%" would read as one number)
  const grab = () => page.evaluate(() => ['#headline-text', '#dots .legend', '#tiles', '#risk-cost', '#safer .levers'].map((s) => {
    const el = document.querySelector(s); if (!el) return '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const parts = []; while (w.nextNode()) parts.push(w.currentNode.nodeValue);
    return parts.join(' | ');
  }));
  for (const form of [E, { ...E, initialLtv: 30, marginCallConsequence: 'partialAfterCure' }, { ...E, mode: 'existing', collateralBtc: '0.35', durationMonths: 9 }]) {
    await open(page, form); await openFolded(page, '#sec-cost');
    const en = await grab();
    await page.locator('#lang-btn').click(); await page.locator('[data-lang="de"]').click();
    await expect(page.locator('#headline-text')).toContainText('von 100'); await waitDone(page);
    const de = await grab();
    en.forEach((x, i) => expect(numbers(de[i], true), `German = English: ${['answer', 'legend', 'tiles', 'cost of the risk', 'Make it safer'][i]}`).toEqual(numbers(x, false)));
    await page.locator('#lang-btn').click(); await page.locator('[data-lang="en"]').click();
  }
});

// Insights: each sentence above a table repeats numbers from that table; they must be the same numbers
// (27 Oct 2026: "27 of 100 margin calls" above a table that showed 28, rounded two ways).
test('numbers agree with each other: Insights, every sentence = the table under it, in English and German', async ({ page }) => {
  const digits = (s) => (s.match(/\d[\d.,]*\d|\d/g) || []).map((x) => x.replace(/[.,]/g, ''));
  const n = (s) => digits(s)[0];
  for (const path of ['/insights/', '/de/insights/']) {
    await page.goto(path); await expect(page.locator('#i-speed table')).toBeVisible();
    const d = await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.textContent || '';
      const rows = (sel) => [...document.querySelectorAll(`${sel} tbody tr`)].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
      const ids = ['survival', 'falls', 'speed', 'reserve', 'cost', 'measure', 'buy', 'spend'];
      return {
        take: Object.fromEntries(ids.map((id) => [id, text(`#i-${id} .take`)])),
        table: Object.fromEntries(ids.map((id) => [id, rows(`#i-${id} .table-wrap`)])),
        leversLead: text('#i-levers .sub'), leversBase: text('#i-levers .lv.base b'),
      };
    });
    const row = (id, label) => d.table[id].find((r) => n(r[0]) === label);
    const has = (id, cell, what) => expect(digits(d.take[id]), `${path} ${what}: sentence "${d.take[id]}" = table ${cell}`).toContain(n(cell));
    // survival: either "no loan at LTV x or lower" (all 0 in the 12-month column) or "at LTV 20%, n of 100"
    const some = n(row('survival', '20')[2]) === '0';
    if (some) for (const r of d.table.survival.filter((r) => Number(n(r[0])) <= Number(digits(d.take.survival)[0]))) expect(n(r[2]), `${path} survival: no liquidation at ${r[0]}`).toBe('0');
    else has('survival', row('survival', '20')[2], 'survival, LTV 20%, 12 months');
    const year = d.table.falls.find((r) => n(r[0]) === '365');
    has('falls', year[2], 'falls, one year, 10 of 100'); has('falls', year[4], 'falls, one year, worst');
    has('speed', d.table.speed[0][1], 'speed, within 24 hours');
    has('reserve', row('reserve', '50')[2], 'reserve, 50%, 90 of 100'); has('reserve', row('reserve', '50')[4], 'reserve, 50%, worst');
    const offers = d.table.cost.slice(0, 4); // the first table: offer A and offer B
    has('cost', offers[3][1], 'cost, offer A'); has('cost', offers[3][2], 'cost, offer B');
    has('measure', String(Math.max(...d.table.measure.map((r) => Math.abs(Number(n(r[1])) - Number(n(r[2])))))), 'measure, largest difference');
    has('buy', row('buy', '20')[2], 'buy, 20%, 12 months'); has('buy', row('buy', '50')[2], 'buy, 50%, 12 months');
    has('spend', row('spend', '30')[1], 'spend, 30%, no tax');
    expect(digits(d.leversLead), `${path} levers: lead = the reference loan's bar`).toContain(n(d.leversBase));
  }
});
