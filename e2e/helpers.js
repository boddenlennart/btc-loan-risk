// Shared by the browser tests.
import { expect } from '@playwright/test';

// Opens every folded part that can be seen, one after the other, the way a visitor does: a tap on a
// touch screen, a click otherwise (also those that only appear once another one is open). Checks that
// each opened. Tests used to open them by script, which would not notice a heading that does not react.
export async function openFolded(page, scope = 'body') {
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  let n = 0;
  for (; n < 80; n++) {
    const s = page.locator(`${scope} details:not([open]) > summary:visible`).first();
    if (!(await s.count())) break;
    const name = (await s.textContent()).trim().slice(0, 40);
    await s.evaluate((el, k) => { el.parentElement.dataset.opened = k; }, String(n)); // this one, not the next closed one
    const d = page.locator(`details[data-opened="${n}"]`); const sum = d.locator('> summary');
    await sum.scrollIntoViewIfNeeded();
    if (touch) await sum.tap(); else await sum.click();
    await expect(d, `opening "${name}"`).toHaveAttribute('open', '');
  }
  return n;
}

// The example's answer as the built page shows it, read from the result the build stored in the page.
// Tests compare with this instead of a fixed number: the weekly data update moves it (54 → 53 on 21 Oct 2026).
// Rounded exactly as the page does (splitTo100 in src/app/main.js: the four groups add up to 100).
import { readFileSync } from 'node:fs';
export function exampleAnswer(lang = 'en') {
  const html = readFileSync(new URL(`../${process.env.E2E_DIR || 'docs'}/${lang === 'en' ? '' : `${lang}/`}index.html`, import.meta.url), 'utf8');
  const m = JSON.parse(html.match(/<script type="application\/json" id="meta">([\s\S]*?)<\/script>/)[1]).example.result.main;
  const marginOnly = m.pMarginCall === null ? 0 : Math.max(0, m.pMarginCall - m.pLiquidation - m.pPartial);
  const parts = [m.pLiquidation, m.pPartial, marginOnly, 1 - m.pLiquidation - m.pPartial - marginOnly];
  const raw = parts.map((p) => Math.max(0, p) * 100); const fl = raw.map(Math.floor);
  let rest = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return fl[0] + fl[1];
}
