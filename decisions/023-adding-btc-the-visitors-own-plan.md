# 023 · Topping up when the price falls: the visitor's own plan, nothing preset

Date: 2026-11-02 · Status: in force

## Decision
In "If the price falls: your lender's rules and your plan", one question: "Will you top up if the price falls?" (wording: decision 024). The answer is "No, I don't top up" unless the visitor picks a way; then the page counts exactly as before. Three ways, each with only its own fields, all empty until filled in:
- **Once, at the margin call:** an amount, added as BTC at the margin-call price (the former reserve; offered only with a margin call).
- **Every month:** an amount and a number of months (at most the loan's); the first now, then when each loan month begins, as BTC at that moment's price.
- **Whenever the LTV gets too high:** an LTV at which to add, an LTV to go back to, the money available in total, and how fast: at once (at the price where the LTV reaches the level), within 1 day or within 2 days (at the price then, only if the LTV is still above the target). The simulation steps in days, real history in hours.

A way counts once all its fields are filled in. The answer card always says what the number assumes about adding BTC and links to the question. With a plan, a line gives the number without it and the money put in on average, and a folded table shows the same total added in the other ways (all at the start; every month over the whole loan; once at the lender's margin call; halfway between the starting and the liquidation LTV, back to the starting LTV, at once) and not at all. Every row is rounded as the answer at the top would show it. The suggestion "Keep €… ready for a margin call" (20% of the loan, a preset amount) is gone from "Make it safer".

Rules (src/engine/lender.js, both methods): added BTC comes after the lender's sales in the same step, like the reserve before; a fall through the liquidation LTV within one step is a liquidation. Added BTC counts as yours in "What a sale leaves you" and is left out of "buy more BTC" (it does not come from the borrowing). The independent Python programs follow the same rules and agree exactly.

## Why
Many borrowers avoid liquidation by adding BTC (owner, 2 Nov 2026; a visitor asked about adding every month). The page answered only "what if you do nothing". Amounts depend on each visitor's loan and means, so none is suggested: a preset amount would be a number with nothing behind it. One question with "No" as the answer keeps the form as short as before for everyone else.

## Alternatives considered
Free schedules (own dates, mixed rules: too many fields, hard to explain and test); hours (1/12/24/48) as speeds (the simulation cannot tell them apart); the comparison table from real history (its own row would differ from the answer); keeping the 20%-of-the-loan suggestion; the plan acting before the lender's sale in a step (more hopeful than the reserve rule, and it would have moved existing results).

## Sources
Issue #22; mock-up `ux/sketches/top-up-plan.html`; owner 2026-11-02 (1a, 2a, 3a, 4b, 5a). The table is computed with "Make it safer" (in the background, after the answer) and only when a plan is set.
