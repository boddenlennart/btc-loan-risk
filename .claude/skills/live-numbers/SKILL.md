---
name: live-numbers
description: Read the current example numbers from the live bitcoinloancheck.com before they are quoted in a post, reply or article. Use whenever the owner wants to publish text containing numbers from the site.
---

# Live numbers

1. Open https://bitcoinloancheck.com in a headless browser (Playwright from `.tools/`), wait until
   `body[data-ready="1"]` and `#progress` is hidden.
2. Read: `#headline-text` (answer), `#methods-line` (real history, volatility model), `#tiles`
   (liquidation price, full cost, rate, with the liquidation risk), `#risk-cost`, `#best-lever`, `#price-line`.
3. Compare with the numbers in the owner's text and list every number that differs, old → new.
4. Note when the numbers will next change: after the next Monday data update is merged.
5. Numbers are always the example's (50% starting LTV, liquidation at 80%, 12 months, EUR) unless the text says otherwise;
   name the currency when quoting history numbers (they differ by about a point between EUR and USD).
