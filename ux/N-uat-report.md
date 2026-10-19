# Final acceptance test (UAT) before the release candidate

Status: 19 Oct 2026, branch `ux-redesign` at 8ff9046. Nothing has been changed; this is the report. Fixes follow after the owner's approval.

## Why this test was different

The owner found flaws the earlier tests missed: a tile stuck on "…", a jump that landed too low, a note that sounded alarming. They share one cause. The earlier tests checked whether the right text is on the page; a person looks at the page at real sizes, while it moves, while deciding. This test therefore started from what a person sees.

## The raw material

| Material | What | Where |
|---|---|---|
| Screenshots | 5 flows (example, own terms, existing loan, comparison, refinancing to buy BTC) × 320, 375, 768, 1280 px, plus dark and German at 375 and 1280 px: 40 sets, about 280 images, every image looked at; plus How it works and Insights on phones | `ux/uat/evidence/` (the images cited below) |
| Speed and stability | Layout shift (CLS) and reaction time (INP) per interaction, processor slowed 4× and 6× (phone) and normal (computer); the calculation also forced into the slowed main thread, because the slowdown does not reach the background worker | `ux/uat/evidence/perf.txt` |
| Accessibility | Keyboard walk (90 Tab presses), the accessibility tree of the answer, axe (WCAG 2.2 AA) in 7 states, reflow at 320 and 640 px | below |
| Real offers | Published terms of six lender structures (public comparison pages and lender material, Oct 2026), anonymised as A–F | section 4 |
| Combinations | 17 pairwise cases covering every pair of values of 12 settings; in each, every number compared between tile, cost section and table | `ux/uat/evidence/pairwise.txt` |
| Properties | 6 rules checked on 20 random loans each with the real history | below |
| Error cases | Offline, price services answering 503, storage blocked, broken and unusual share links | below |

## Success criteria (set before the test)

| Criterion | Result |
|---|---|
| No visible layout shift after an interaction, except a wanted one | **Not met:** opening the page on a slow phone shifts heavily (finding 3). Interactions: met (largest 0.009, good is below 0.1). |
| Every number identical everywhere it appears | **Met** (17 combinations, all languages and currencies tested). One display difference: €999.96 next to €1,000 (finding 12). |
| Every rule of the real offers can be entered | **Not met:** three structures cannot be entered exactly (finding 6). |
| No finding of severity 3 or 4 open | **Not met:** four severity-3 findings. |
| A 12-month loan answers within 10 s on a slowed processor | **Met:** about 5 s at 6× slower. A 36-month loan takes about 13 s (finding 7). |

## Findings

Severity (Nielsen): 4 = must not ship, 3 = major (misleads or visibly broken), 2 = minor (confusing, workaround exists), 1 = cosmetic.

### 1. Severity 3 · With "sells only enough", the big number says 0 while most futures sell part of the BTC

**Seen:** loan with a partial sale at the liquidation LTV, 36 months. The answer reads **"0 of 100"** in large type, then in a sentence "In 68 more, part of the BTC is liquidated." The line under it also says "real history 0 of 100, a volatility model 0 of 100". Evidence: `01-partial-headline-375.png`.
**Why it matters:** the big number is what people remember and share. Here it suggests safety although a forced sale happens in 68 of 100 futures.
**Cause:** the headline counts only full liquidations; partial ones are a second clause.
**Fix:** when the lender's rules can sell part of the BTC, the big number counts futures with any forced sale ("68 of 100 … liquidated in full or in part"), with full liquidations as the clause. The other methods line counts the same way.

### 2. Severity 3 · The chart "If one of these real years started today" starts every line with a spike and is stretched

**Seen:** every line starts at the top of the chart and drops to today's price; the scale runs to about €240,000, which squeezes the real lines into the lower third. On every screen size. Evidence: `02-history-chart-spike-375.png`, `02-history-chart-spike-1280.png`.
**Cause:** `story()` in `src/app/riskjob.js` takes the lowest price of the past week for each weekly point; for the first point that week is empty, so the minimum is infinite. The scale then uses its cap of 4× today's price.
**Fix:** the first point is 1 (today's price). Add a test that every chart point is a finite number.

### 3. Severity 3 · Opening the page on a slow phone makes the content jump

**Seen:** with the processor slowed 6×, the layout-shift score on opening is **0.77** (good is below 0.1, poor above 0.25): the answer, the terms and the sections move down after the first paint. At 4× slower: 0. A cheap phone can be at 6×.
**Cause:** the browser paints the page frame before the script has filled in the answer.
**Fix:** keep the content area invisible until the first answer is drawn (a few hundred milliseconds), or reserve its height. Then measure again at 6×.

### 4. Severity 3 · The tiles break on phones

**Seen at 375 px (three narrow tiles side by side):**
- numbers break in the middle: "US$22,50 / 1" (`04-tiles-usd-375.png`)
- a label breaks mid-word: "PARTIAL LIQUIDATIO / N AT" (`01-partial-headline-375.png`)
- the German risk line is cut off: "Liquidationsrisik" (`04-tiles-de-375.png`)
- the "Full cost" tile is seven lines tall next to two half-empty tiles

**Cause:** the tiles allow breaks anywhere; on phones three tiles of about 100 px share a row; the new two-line risk line made one tile much taller.
**Fix:**
- two tiles per row below 480 px
- numbers never break
- labels break only at hyphenation points
- the rate in the risk line stays together ("22.7% a year")
- a test that no word or number in a tile is split or clipped, in both languages and four currencies

### 5. Severity 2 · Chart axes are cut off for the US dollar (and wider currencies)

**Seen:** "S$200,000", "S$100,000" on the left edge of "20 possible futures" (`05-chart-axis-usd-1280.png`). CHF, CZK and PLN labels are wider still.
**Cause:** the charts reserve a fixed 64 px for the axis.
**Fix:** measure the widest label, or write large values short ("US$200k").

### 6. Severity 2 · Three real structures cannot be entered exactly

| Lender | Published structure | Can it be entered? |
|---|---|---|
| A | Max. starting LTV 50%, warnings at 70% and 75%, partial liquidation at 80%, monthly interest | Yes (warning-only margin call, partial sale) |
| B | 50%, margin call 70% with 72 hours, full liquidation at 85% | Yes |
| C | Same lender's "volatility-protected" loan: no price-based margin call or liquidation; sale only after a missed payment | **No:** the form always liquidates at a price |
| D | DeFi: up to 73%, no warning, liquidation at 78% with a 5–6% bonus to the liquidator | Yes (no margin call, fee on BTC sold) |
| E | "Stabilisation" at a threshold (the BTC is converted, 3% fee), then liquidation | **Only approximately** (as a partial sale) |
| F | Margin call at 73%, liquidation at 95%, interest at the end | Yes |

Also: one lender's example states the starting LTV "inclusive of principal and interest". The form assumes the LTV of the amount received. Entering such a number as it is understates the risk, and nothing tells the user.

**Fix (small):** a hint under "Starting LTV" ("If your lender counts the interest for the whole term in the LTV, enter the amount including that interest"). **Fix (later):** a rule "no liquidation during the term" with the honest message that the price risk then sits with the lender (this ties in with How it works). Stabilisation stays approximate, and a line says so.

### 7. Severity 2 · Long loans are slow on cheap phones

**Measured** (the calculation in the main thread slowed 6×, about a cheap phone):

| Loan | Number appears | All sections done |
|---|---|---|
| 12 months | 4.9 s | 17.7 s |
| 36 months | 13.1 s | 47.1 s |

On a computer: 1.0 / 3.6 s and 2.5 / 8.3 s. The progress pill shows meanwhile, and the number comes first. But "Make it safer", the trends and the slider take three quarters of the time.
**Fix:** compute those with fewer futures (for example 2,000 instead of 10,000; they compare options, so the same futures keep the order), or only when that section is opened. Expected: all sections at 6× within about 6 s for 12 months.

### 8. Severity 2 · Screen readers

- The four tiles are read as one run-on line ("Liquidated at €37,500 −38% from today Margin call at €42,857 48 h to fix Full cost …"). Fix: mark them up as a list of label and value.
- The "?" next to the number is announced as "More". Fix: "More about this number".
- Enter on the tile's risk line opens the cost section, but the focus stays on the tile. Fix: move the focus to the heading "Cost including the risk".
- Good: the keyboard order is logical, every element shows a focus ring, the skip link works, and axe finds **no violations** in any of the 7 states, light and dark.

### 9. Severity 2 · A share link that cannot be read is ignored silently

**Seen:** a broken link (or one with four offers) shows the example without a word. The person who received it thinks they see the sender's terms.
**Fix:** a short note in the answer: "This link could not be read. Showing the example." (Links with unknown fields, an unknown currency or wrong values work as they should: what can be read is used, and errors are shown.)

### 10. Severity 2 · One concept, several names

- The time to fix a margin call is called "Time to top up" (field), "48 h to fix" (tile), "deadline" (8 texts) and "cure period" (glossary).
- The cost with risk appears as "Cost including the risk", "Including the liquidation risk", "with the liquidation risk".

**Fix:** one term each, for example "time to top up" / "Frist zum Nachschießen", and "cost including the liquidation risk" with the short form "with the liquidation risk" only in the tile.

### 11. Severity 1 · How it works scrolls sideways on a 320 px phone

The code link "reference/reference_montecarlo.py" is 8 px too wide. Fix: allow long links to break.

### 12. Severity 1 · Small display details

- An existing loan's costs show "€999.96 is interest" and, two lines below, "instead of €1,000 interest". Use the same precision.
- On a computer, the tile line breaks as "22.7% a / year". Fixed with finding 4.
- On a phone, for an existing loan, the currency menu sits next to the hint, not the amount field (`12-existing-terms-375.png`).
- For a refinancing, "Make it safer" offers "Starting LTV 10%", which only borrowing less could reach. Acceptable, as the slider is already hidden there.
- "Show 20 other futures (2 of 5)" could read as "you are on 2 of 5". Clearer: "Show the next 20 futures (set 2 of 5)".

## Checked and fine

- **Numbers agree everywhere:** in all 17 combinations, the tile, the cost section and the comparison table agree.
- **No technical errors:** no console errors in any of the 40 screenshot sets, and no "NaN", "undefined" or broken signs.
- **Properties on random loans:**
  - price and amount scaled together give the same chances, and a cost of the risk scaled exactly, apart from cent rounding
  - the cost of the risk is never negative, and 0 exactly when no future has a sale
  - a longer loan is never liquidated less often
  - a higher starting LTV is never liquidated less often, with any margin-call rule at most 1 point fewer
  - a higher fee never lowers the cost of the risk and never changes how often a loan is liquidated
- **Error cases:**
  - offline and price services down: the stored price is used and marked "not current"
  - storage blocked: the page works
  - negative values in a link: shown as errors
- **Reflow:** the check page and Insights at 320 px and 640 px, with no sideways scrolling.
- **Dark mode, German and the tablet width:** no further problems beyond the findings above.

## What neither of us can judge alone

Prepared for the owner:
- `ux/uat/user-test-script.md`: a 20-minute session with 7 tasks and a 5-question comprehension quiz, for 5–8 people from the target group
- `ux/uat/iphone-voiceover-checklist.md`: 20 checks on a real iPhone, with and without VoiceOver
- `ux/uat/reviewer-brief.md`: a one-page brief for the friend at a lender and for a UX reviewer

## Proposed order of fixes

1. Before the release candidate:
   - findings 1–4 (all severity 3)
   - finding 9 (silent link)
   - finding 11 (one line)
2. Also before launch, if the owner agrees:
   - finding 5 (axes)
   - finding 7 (speed)
   - finding 8 (screen readers)
   - finding 10 (terms)
   - finding 12 (details)
   - finding 6 (small fix: the LTV hint)
3. After launch: finding 6, the rule "no liquidation during the term".

Each fix gets a test that would have caught it, so that this kind of flaw cannot come back:
- every chart point is a finite number
- no split or clipped word in a tile, in both languages and four currencies
- the layout-shift score on opening at 6× slowdown
- the headline with partial sales
