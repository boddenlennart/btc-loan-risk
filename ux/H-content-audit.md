# Content audit for the three-page site (Variant 3)

Status: draft for review (18 Oct 2026). Every block the check page shows today, with a decision.
**Keep** = stays on the check page · **Move** = goes to /insights or /method · **Merge** = said once instead of several times · **Remove** = no longer needed.

Principle: the check page answers **"what about my loan?"**. General facts about BTC go to **/insights**. How the numbers are made and how to verify them goes to **/method**.

## Redundancies found

| # | Said several times today | Where | Decision |
|---|---|---|---|
| R1 | The lender itself can fail or lose your BTC | answer (small print), checklist note, "What this does not include" | **Merge:** keep the line in the answer and the item in "What this does not include"; remove the note under the checklist |
| R2 | Data period and sources | answer small print, line above "Start over", footer "Data: …", method text, method "settings used" | **Merge:** the answer keeps "Price data: 1 Jan 2014 to … · last updated …"; everything else in one place on /method |
| R3 | Results of the other methods | answer small print ("real history 42, volatility model 52"), "Your loan in every crash" (history 42 + sentence), method table (all four methods) | **Merge:** answer small print stays (one line); the section keeps the history number (it is *about* history); the four-method table moves to /method |
| R4 | The sale price | "Sold at" tile, the sentence under the answer, the price ladder, the sale sentence in "What happens when BTC falls", the liquidation sentence below it | **Merge:** tile and "If sold: you get back …" in the answer; the section keeps the ladder and the step-by-step text, without repeating the sale sentence |
| R5 | "Your lender may measure the price differently" | the long "measure" paragraph in "What happens when BTC falls", item in "What this does not include" | **Merge:** item stays in "What this does not include"; the explanation with data moves to /insights (insight 8: hourly lows vs. a price index) |
| R6 | "Your lender's own figures win" | notice in "What happens when BTC falls", footer "Check every number against your lender's documents" | **Merge:** footer sentence only |
| R7 | General BTC history facts | leverage section ("higher 4 years later on 100% of start days …"), history section (4-year growth, years with 50% falls, trend range) | **Move to /insights** (by goal: buying BTC; buffer) and **/method** (why no trend) |
| R8 | Privacy summary | long footer paragraph and the full privacy notice | **Merge:** footer keeps the trust line and the privacy-notice link; the long paragraph goes |

## Every block of the check page

| Block | Decision | Reason |
|---|---|---|
| Name, headline, subhead, trust line | **Keep** | first screen |
| Answer: label, example story, number, dots, assumption, best change | **Keep** | the core |
| Tiles (sold at, margin call, cost, beats selling if) and "If sold: you get back …" | **Keep** | |
| Answer small print: other methods + "How to check this number" | **Keep**, the link goes to /method | |
| Answer small print: "No price trend assumed · not a forecast", price data | **Keep** | one line each |
| Answer small print: lender can fail | **Keep** (R1) | |
| **New:** one small hook to /insights at the sale price ("BTC fell this far within a year in N of 100 one-year periods since 2014 → Insights") | **Add** | connects the check with the data |
| Your terms (form), comparison, refinancing, Share | **Keep** | |
| Make it safer (slider, options, undo) | **Keep** | personal levers; the general lever ranking is on /insights |
| Before you sign (8 questions) | **Keep**, without the lender-failure note (R1) | |
| What happens when BTC falls: price ladder, margin-call and sale steps, partial-sale amounts, "first N months", 20 possible futures | **Keep** | personal |
| … the repeated sale sentence (R4), the "measure" paragraph (R5), "lender's figures win" (R6) | **Remove** / **Move** | redundant |
| What it costs: line, timing note, payment plan, borrow or sell with taxes, leverage (dots, sizes, trends, break-even, cash) | **Keep** | personal |
| … "Since 2014, BTC was higher 4 years later …" (R7) | **Move** to /insights | general |
| Your loan in every crash since 2014: history number, link sentence, 4 real start dates, trend table (folded) | **Keep** | personal |
| … why no trend, 4-year growth, years with 50% falls (R7) | **Move** to /method and /insights | general |
| How these numbers are made (whole section: method list, four methods, fan chart, chart by month, settings) | **Move** to /method | method |
| What this does not include | **Keep** (folded) | honesty belongs next to the numbers |
| Help improve this page (feedback) | **Move** to the footer of every page (opens the same form) | not part of the check |
| "Price history in this page …" line above the button | **Remove** (R2) | |
| Start over and forget my inputs | **Keep**, moved into the footer of the check page | |
| Footer: maker, not advice, licence, donation, glossary, Impressum, privacy notice | **Keep** on every page | |
| Footer: long privacy paragraph (R8), "Data: …" sources line (R2) | **Remove** / **Move** to /method | |

Result: the check page loses one whole section, three general paragraphs and five repeats. It gains one link line, and nothing it removes is lost: it moves to the page where people look for it.

## The two new pages

**/insights: what happened since 2014.** Not a forecast, not advice. Built from the same data, refreshed weekly.
1. How much buffer does a loan need?
   - survival map: starting LTV × duration
   - worst falls by time window
   - how fast crashes go: hours from margin call to sale
2. Which levers matter most?
   - lever ranking
   - reserve sizing
   - partial vs. full sale
3. Comparing offers fairly
   - expected cost including the risk
   - hourly lows vs. a lender's price index
4. By goal
   - buying more BTC
   - spending without selling
5. Today's market swings compared with history

**/method: how the numbers are made, and how to check them.**
1. The short answer
2. Four illustrated steps
3. Three methods side by side
4. The test against history (chart)
5. Data and the weekly update
6. Why no price trend is assumed
7. What the model can't do
8. Verify it yourself: code, tests, reference results

## Navigation

Three items on every page: **Check a loan · Insights · How it works**, plus the language menu.
- On desktop, they sit in the top bar.
- On phones, they form a second row under the name. That row scrolls away; the name bar stays.
