# A4 · Success criteria

*Phase A, step 4 (revised for feedback in production). Fixed **before** any design, so we can't adjust them afterwards to fit the result. People other than you and me confirm the result in two ways: **automated checks** (C, D) before launch, and **visitors' feedback** (A, B) after launch.*

## Launch gate vs. review after launch

- **Before launch:** criteria **C** and **D** must all pass, and every finding of severity 3–4 from my expert review (A2, section 2) must be fixed. I can measure these myself, and you can repeat the checks.
- **After launch:** criteria **A** and **B** are checked at each review checkpoint (A2, section 5), from the visitors' feedback e-mails. They decide what we improve next, not whether the page goes live.

## A. Understanding (from feedback e-mails, at each checkpoint)

| # | Criterion | Target | Measured from |
|---|---|---|---|
| A1 | **Headline understood:** F2 scored correct with the answer key (mentions losing the BTC / liquidation, and that it is an estimate, not a certainty) | **≥ 80 %** of answers | F2 |
| A2 | **Nobody misreads the headline as a price fall** ("BTC falls 55%") or as a certainty | **≤ 1** such answer per checkpoint; if 2 or more, the headline wording is changed | F2 |
| A3 | **Each profile reached:** at least one answer each from "spend", "compare" and "buy more BTC" | **all three present** by the second checkpoint; if one is missing, I check whether the page speaks to that profile | F1 |
| A4 | **Profile C understands the leverage result:** F2 answers from "buy more BTC" visitors are correct at the same rate as the others | **no more than 15 percentage points below** the overall rate | F1 + F2 |
| A5 | **No confirmed number error:** every reported wrong number is checked; confirmed errors are fixed at once | **0 open** | F5, F6 |

## B. Effort and satisfaction (from feedback e-mails, at each checkpoint)

| # | Criterion | Target | Measured from |
|---|---|---|---|
| B1 | **UMUX-Lite** (usefulness + ease) | average **≥ 75** (0–100 scale) | F3, F4 |
| B2 | **"Gives me what I need to decide"** on its own | average **≥ 5.5 of 7** | F3 |
| B3 | **Recurring problems:** any problem named independently by **3 or more** people | **fixed or explained** before the next checkpoint | F5 |

*Self-selected feedback is biased (A2, section 1). These numbers show the direction, not proof. With fewer than 10 answers at a checkpoint, I report them but draw no conclusions.*

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

## D+. New elements (feedback, donation)

| # | Criterion | Target |
|---|---|---|
| D7 | **Nothing is sent without the visitor's action**, except the named price requests. The feedback panel only opens the visitor's mail app (a `mailto:` link). The built page contains no other outside address. | `tests/hosting.test.js` extended; **passes** |
| D8 | **Donation QR code is correct:** the QR in the page, decoded by an independent QR reader, gives exactly `bitcoin:` + the address you supplied, and the address passes a checksum test | **passes** (automatic) |
| D9 | **Feedback e-mail is complete and readable:** the pre-filled e-mail contains F1–F5, the page version, language and device type, and no loan terms unless F6 is ticked | **passes** (automatic) |
| D10 | **Profile C numbers are right:** the new "result counted in BTC" is checked against an independent calculation on fixed example paths, like the other engine tests | **passes** (automatic) |

## E. What happens if a criterion is missed

- **C or D missed before launch:** fixed before launch.
- **A or B missed at a checkpoint:** I name the failing criterion, the cause (with quotes from the e-mails) and the **smallest** change that would fix it. You decide.
- **Targets are not lowered after seeing results.** If you think a target was wrong, we agree on a new one **before** the next checkpoint, and the reason is written down here.

## F. Who confirms what

| Criteria | Confirmed by |
|---|---|
| C, D | **Automated checks** that I run and you can repeat (`npm test` plus the audit script) |
| A, B | **Visitors' feedback e-mails** at each checkpoint, analysed by me, checked by you |
| Real-offer check (from the original brief) | **You**, with a real offer, to the cent, before launch |
