# Whole-site review: value, fit, repeats, gaps

Status: 19 Oct 2026, after the expanded "How it works". Read as a first-time visitor and as product owner, all three pages fully opened (check about 3,400 words, Insights 3,300, How it works 3,900), English and German.

## Verdict

Each page has one clear job and the three connect: **the check** answers "what about my loan?", **Insights** "what happened to loans like this?", **How it works** "why should I trust the number?". Every major feature earns its place. No gap blocks the launch. Six smaller points are worth fixing first (S1–S6); five can wait (C1–C5).

## Feature by feature

| Page | Feature | Value | Verdict |
|---|---|---|---|
| Check | The answer (number, dots, assumption, best change, tiles, what you get back) | The core | Keep |
| Check | Insight line under the answer ("fell this far within 7 hours") | Connects the number with history | Keep |
| Check | Your terms: new/existing loan, LTV or BTC, all lender rules | Needed to check any real offer | Keep |
| Check | Expert settings: start date, day count | Real loan terms | Keep |
| Check | Expert settings: number of simulated futures, length of price pieces | Lets visitors change the validated model; all texts assume 10,000 and 30 days; no visitor need | **Remove (S1)** |
| Check | Compare offers, refinancing | The differentiator | Keep |
| Check | Make it safer (slider, options) | Turns the number into action | Keep; heading says "one change at a time" but one option changes two terms (S4) |
| Check | 8 questions for the lender | Practical, lender-neutral | Keep |
| Check | What happens when BTC falls (ladder, steps, 20 futures) | Makes the number tangible | Keep; repeats "you get back about … BTC" from the answer (S2) |
| Check | What it costs · Borrow or sell / Is the leverage worth it | Second main question (cost) | Keep |
| Check | Your loan in every crash since 2014 (real history, 4 real years, trend table) | Trust through real events | Keep |
| Check | What this does not include | Honesty next to the number | Keep |
| Check | Remember inputs, Share, Start over | Privacy by default, sharing | Keep |
| Insights | 11 insights | A report people can cite and share | Keep all; "Today's price swings" stands alone (S3) |
| Insights | Hourly lows vs. a smoother price | Answers "does my lender's price index matter?" | Keep; the same topic is explained on all three pages (S2) |
| How it works | Three layers, one real future, volatility, precision, rules, methods, test, maths | Trust; the audit made visible | Keep; the textbook formula is described twice (S2) |
| All | Navigation, light/dark, two languages, footer (feedback, glossary, legal, donation) | Expected basics | Keep |

## Repeats and inconsistencies

1. **"You get back about 0.0436 BTC"** appears in the answer and again in "What happens when BTC falls". The answer keeps it (fairness: liquidated is not everything lost); the section keeps only what it adds (BTC sold, including the fee).
2. **Which BTC price the lender uses** is explained on the check ("What this does not include"), on How it works (a full paragraph) and on Insights (with data). Keep one short line on the check, the full explanation with data on Insights, and on How it works one sentence with a link.
3. **The textbook formula** is described in the methods table and again in a note below it. Keep the table.
4. **Three "today's volatility" figures:** 38% (Insights, the last 30 days), 39% (How it works, the volatility model) and 44% (2026 so far, in the bar chart). All correct, but they look inconsistent. Insights says which measure it is and that the simulation uses 57%; How it works names the volatility model's figure as its own estimate.
5. **The simulation's weighting is not mentioned at the number.** The "?" help next to the answer says "built from real price moves since 2014"; it should add "recent years count more", since that choice changes the number.
6. **"Make it safer"** lists "Liquidation LTV 90% and margin call only a warning" under "one change at a time".

## Gaps

- **How it works has no way back to the check** ("Check your own terms →", as Insights has).
- **"Today's price swings" (Insights) does not say what it means for a loan.** One sentence: the simulation assumes 57% a year, more than today's 38%, so it is the cautious side.
- **The owner's plain-language review covered the 391 texts of 16 Oct.** About 250 texts are new since then (Insights, How it works, legal, comparison). They have passed the automatic rules (short sentences, no advice or market claims), but not a human reading.
- **The comparison of offers does not show "cost including the risk"**, although Insights shows that it can reverse which offer is cheaper. Valuable, but it needs a careful definition in the simulation (C1).

## Before launch (MoSCoW)

**Must:** nothing new beyond ux/J-launch-steps.md (your checks and clicks).

**Should**

| # | What | Who |
|---|---|---|
| S1 | Remove the two model settings from "Expert settings" (number of futures, length of price pieces) | me |
| S2 | Remove the three repeats (you get back, which price counts, textbook formula) | me |
| S3 | Connect "today's volatility": Insights links its 38% to the simulation's 57%; How it works names its 39% as the volatility model's estimate; How it works gets "Check your own terms →" | me |
| S4 | "Make it safer": heading without "one change at a time" (one option changes two terms) | me |
| S5 | The "?" next to the answer mentions that recent years count more | me |
| S6 | A plain-language reading of the new texts (export: ux/review/texts-review.md, 637 numbered texts EN and DE; the new ones are in the groups Insights, How it works, legal, comparison) | you |

**Could (after launch)**

| # | What |
|---|---|
| C1 | "Cost including the risk" as a row in the comparison of offers |
| C2 | Insights also in euros |
| C3 | Own link-preview images for Insights and How it works |
| C4 | A manual screen-reader check (VoiceOver) |
| C5 | An outside review of the maths by a quant |

**Won't (this launch):** lender directory, more languages, accounts, a measuring script.
