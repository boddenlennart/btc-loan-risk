# A4 · Success criteria

*Phase A, step 4. Fixed **before** any design, so we can't adjust them afterwards to fit the result. The redesign counts as done only when **people other than you and me** meet the criteria marked "testers", and the automatic checks pass.*

## A. Understanding (5 new testers on the redesigned page, test kit A2)

| # | Criterion | Target | Baseline (current page) |
|---|---|---|---|
| A1 | **Headline understood:** Q1 answered correctly with the page closed (mentions losing the BTC / liquidation, and that it is an estimate, not a certainty) | **at least 4 of 5** | from your baseline test |
| A2 | **Liquidation price found:** Q2 correct (within 1%) | **at least 4 of 5** | from your baseline test |
| A3 | **Knows how to make it safer:** Q3 correct with the page closed **and** T3 solved without a hint (they found how much safer a change makes it) | **at least 4 of 5** | from your baseline test |
| A4 | **Knows the limits:** Q4 names at least one limit with the page closed | **at least 3 of 5** | from your baseline test |
| A5 | **Cost understood:** Q5 correct (amount received **and** total cost) | **at least 4 of 5** | from your baseline test |
| A6 | **Nobody misreads the headline as a price fall** ("BTC falls 55%") | **0 of 5** | from your baseline test |
| A7 | **Leads to a decision:** "Would you take this loan?" answered with one of the five decisions in A1 and a reason that comes from the page | **at least 4 of 5** | from your baseline test |

## B. Effort (same testers)

| # | Criterion | Target | Baseline |
|---|---|---|---|
| B1 | **Time to first answer** (T1: from opening the page with the offer in hand until they state a risk result) | median **≤ 3 minutes**, **and** faster than the baseline median | from your baseline test |
| B2 | **The 5 main terms entered correctly without a hint** (amount, starting LTV, liquidation LTV, duration, rate) | **5 of 5** testers | from your baseline test |
| B3 | **Hints needed** across all 4 tasks | **at most 2 in total** (for all 5 testers together) | from your baseline test |
| B4 | **SUS score** (usability questionnaire) | average **≥ 75**, **and** higher than the baseline average | from your baseline test |

## C. Amount of text and controls (measured automatically on the built page)

| # | Criterion | Target | Today (measured) |
|---|---|---|---|
| C1 | Words a visitor passes before the first result | **≤ 300** (EN and DE) | ≈ 1,170 (EN) · ≈ 1,090 (DE) |
| C2 | Input fields visible before the first result | **≤ 6** | 23 |
| C3 | "?" buttons visible by default | **≤ 6** | 23 |
| C4 | Elements in the first screen of results (phone, 375 × 812) | the headline sentence, the dot grid and the LTV slider are **all visible without scrolling** | headline only; 26 boxes follow |
| C5 | Repeated notices ("not advice", "lender's figures win", example badge) | **each shown once** above the footer | 2 / 2 / 23 times |

## D. Quality (automatic)

| # | Criterion | Target | Today |
|---|---|---|---|
| D1 | **The numbers are unchanged:** all calculation tests pass, unchanged (loan, validation, barrier, GARCH, properties, replay, calibration, data, live price) | **all pass** | 174 pass |
| D2 | **Every element still explained somewhere** (field, glossary or expert section). The content test is rewritten for the new help rules, not deleted. | **passes** | passes (old rules) |
| D3 | **Readability** of every help text | EN Flesch **≥ 70**; DE Amstad **≥ 65**; average **≤ 14 words per sentence**; no single sentence over 25 words | EN 79 · DE 66 · ~11 words (keep at least this level) |
| D4 | **Accessibility:** automated audit (axe-core) on the built page, light and dark mode, phone and desktop | **0 serious or critical issues** | measured at the start of Phase C on the old page too |
| D5 | **Phone layout:** no sideways scrolling at 320 px width; all tap targets at least 44 × 44 px | **passes** | passes at 375 px; 320 px not yet tested |
| D6 | **Speed:** first risk answer on a mid-range phone | **≤ 5 seconds** after the page opens | ≈ 2.6 s on a laptop; phone not yet measured |

## E. What happens if a criterion is missed

- **A or B missed:** I name the failing criterion, the observed cause (with tester quotes) and the **smallest** change that would fix it. You decide whether to change it and test again (2–3 new testers are enough for a re-check).
- **C or D missed:** fixed before the tester round, because those I can measure myself.
- **Targets are not lowered after seeing results.** If you think a target was wrong, we agree on a new one **before** the next test round, and the reason is written down here.

## F. Who confirms what

| Criteria | Confirmed by |
|---|---|
| A, B | **Your 5 testers** (observation sheets + SUS), analysed by me, checked by you |
| C, D | **Automated checks** that I run and you can repeat (`npm test` plus the audit script) |
| Real-offer check (from the original brief) | **You**, with a real offer, to the cent |
