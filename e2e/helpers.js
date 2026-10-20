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
