# B · Design proposal

*Phase B: sketches only, no code on the real page. The sketches are in `ux/sketches/sketches.html` (open with a double-click). Every number in them is computed with the page's real engine for the test offer from A2, at a BTC price of €72,066. Script: `ux/sketches/compute-numbers.mjs`.*

## 1. What the numbers taught us (and what changes because of it)

The sketch numbers produced three findings that shape the design more than any layout choice:

| # | Finding (test offer, of 100 simulated futures) | What follows |
|---|---|---|
| 1 | **Borrowing less is the strongest lever.** Starting LTV 50% → **64** liquidated; 40% → **45**; 30% → **26**. | The **LTV slider** is the main control, right under the answer. |
| 2 | **A higher liquidation LTV alone barely helps this offer:** 83% → 64; 95% → **63**. The reason: the lender also sells when a margin call at 70% is not fixed within 48 h, and that rule triggers first. With the margin call only a warning, 95% gives **46**. | The margin-call rules become **one plain question** in the input ("What happens when BTC falls?"). The page says it directly: *"A higher liquidation LTV alone barely helps your offer… Ask your lender what happens after a margin call."* |
| 3 | **Even an optimistic trend leaves the swings in charge:** no trend → 64; +20%/year → 56; +50%/year → 46. +50% a year helps about as much as starting at 40% instead of 50% LTV. | Profile C sees its own trend **next to** 0%, with this comparison. |

Historical facts used in the copy (USD data 2014–2026, every start day):
- Higher after **4 years: 100%** of start days.
- Higher after **1 year: 67.5%** of start days; worst outcome **−83%**.
- In **7 of 13** calendar years BTC fell **≥ 50%** within the year.

## 2. Your request: advocate for a lower LTV, point to high liquidation LTVs (e.g. Firefish)

**What the design does:** the section **"What lowers your risk"** lists every option with its effect **computed on the visitor's own numbers**, sorted by effect:
- lower starting LTV
- shorter duration
- keeping cash ready for a margin call
- a margin call that is only a warning
- a higher liquidation LTV combined with that

Together with the LTV slider, this guides the visitor clearly towards the strongest option, without telling them what to do. It also makes your point concretely: the long-term direction has been up, but the loan has to survive the path.

**What I recommend not to do: name a provider such as Firefish on the page.** Four reasons:
1. **Your own brief:** "no provider presets, no lender names in the engine… nothing may look like a real lender quote." The completeness test enforces this.
2. **Legal and trust:** naming one lender reads as a recommendation or advertising, even unpaid. That matters for liability and for the Impressum question. Visitors trust a neutral tool more.
3. **The numbers above:** a 95% liquidation LTV only helps if the margin-call rules don't sell earlier. Without checking a specific lender's full terms (and re-checking whenever they change), naming it could point people to an offer that is not safer for them.
4. **Terms change.** A name on a static page goes stale without anyone noticing.

**Instead, a small addition:** a checklist **"Questions to ask a lender"**, inside "What happens when BTC falls". It lets visitors find high-liquidation-LTV offers themselves, and judge them properly:
- At which LTV do you sell?
- What happens after a margin call? Only a warning, or a sale after N hours?
- Which BTC price do you use (one exchange, an average, over how long)?
- Do you sell everything or only as much as needed?
- What does a liquidation cost?
- Who holds my BTC? Is it lent out?

If you still want named examples, the honest place is the README or a separate, dated "how I compared lenders" note. Not the calculator.

## 3. Input: five numbers first (sketch section 1)

- **First screen:** loan amount (with a € / $ switch), starting LTV (?), liquidation LTV (?), duration as chips (6 / 12 / 24 / other), interest rate, and **"What will you do with the money?"** (Spend it / Buy more BTC).
- **BTC price:** one line under the form ("BTC price used: €72,066 · Coinbase, 11:20 · change"), no longer a field.
- **One banner** "Example values. Replace them with your offer" plus **one guide** "Where to find these numbers", a mini term sheet with the 5 numbers marked. This replaces 23 badges and 23 "where to find" lines.
- **"More terms from your offer"** (collapsed, with a one-line summary of what is set):
  - "When do you pay the interest?" (?): 3 choices; compounding is part of the choice
  - origination fee
  - "What happens when BTC falls?" (?): margin-call LTV plus one of three answers (only a warning / sale if not fixed within N hours / no margin call)
  - liquidation fee with its basis
- **Expert settings:** start date, day count, LTV after a margin call, simulation settings, plus a note field at the end.
- **No "calculate" button.** Results update while typing, as today.

## 4. Results: two variants (sketch section 2). **Recommendation: Variant 1**

**Variant 1 · "Answer first"**
1. **The sentence:** "In **64 of 100** simulated futures, this loan is liquidated within 12 months." (?)
2. **100 dots:**
   - red = liquidated (64)
   - amber = margin call, but survived (7)
   - grey = no margin call (29)
3. **One line:** "Your BTC is sold if the price falls **40%**, to **€43,413**, or earlier if a margin call is not fixed within 48 h."
4. **Small print:** "Other model: 58 of 100 · assumes no price trend · not a forecast · what this does not include ›" (opens the 4 limits).
5. **"Make it safer":** the LTV slider. Moving it updates the sentence and the dots live, and shows how much BTC you'd pledge.
6. **Sections, closed by default:**
   - **What happens when BTC falls:** price ladder; what a margin call and a liquidation would mean in BTC and euros; how the lender measures the price; questions to ask a lender
   - **What lowers your risk:** all options with their effect
   - **What it costs:** you receive / pay back / total cost / % a year
   - **Borrow or sell?** or **Is the leverage worth it?**
   - **What history says:** replay "44 of 100 start dates" + 3 real stories + chart C
   - **Expert details:** methods compared, textbook formula, monthly table, payment plan, model settings, data sources
   - **Help improve this page**

**Variant 2 · "Guided story":** numbered steps:
1. the price fall
2. "has it happened before?"
3. the simulation
4. what makes it safer
5. the cost

It is better at building understanding, but the answer comes in step 3. That misses criterion C4 ("answer + dots + slider on the first phone screen"), and visitors who return (B, C) have to scroll every time.

**Why Variant 1, improved with Variant 2's order:** inside "What happens when BTC falls" and "What history says", the content follows the story order (price ladder → history → simulation).

## 5. The price-path picture (sketch section 3)

Your question was how to read the bands, how they are calculated and what they mean. **Answer: we stop asking visitors to read bands.**

| Option | What it shows | Verdict |
|---|---|---|
| **A · Fan** (today, now explained) | Each month, the range in which 9 of 10 / half of the simulated prices lie. | **Expert section only.** It shows prices, not outcomes: a future that dips below the sale line and recovers looks fine in the bands, but ended in a sale. |
| **B · 20 possible futures** | 20 single simulated years. A line that reaches a sale point stops with a ✕ (red); survivors are grey. Amber line = margin call, red line = liquidation. | **Main picture**, in "What happens when BTC falls". One line = one future, one ✕ = one sale. "Show 20 others" draws a new set. |
| **C · What really happened** | The visitor's own loan, started on 4 real days (Dec 2017, Nov 2021, Feb 2020, Jan 2023), with real prices scaled to today's. | **In "What history says"**. Makes it concrete: "Feb 2020: sold after 28 days; a year later BTC was 4.1× the start." |

**How the paths are made, in one sentence (shown above chart B):** "Each line is one possible next 12 months, built from real 30-day stretches of BTC's past, stuck together at random." The longer method explanation stays in the glossary and Expert section.

**An honest note:** chart B showed that several ✕ sit **above** the red line, at the amber line. Those are sales after an unfixed margin call. The chart makes the margin-call finding (section 1, #2) visible, so it gets one sentence of explanation under the chart.

## 6. Profile C: "Is the leverage worth it?" (sketch section 4)

Shown instead of "Borrow or sell?" when the visitor picked *Buy more BTC*.
- "With €14,775 you buy **0.205 BTC** today. You pay back the loan at the end by selling BTC." (A switch "repay with new money" changes the calculation.)
- **Result counted in BTC, as 100 dots:**
  - **30** more BTC than without the loan
  - **6** less, but not sold
  - **64** liquidated
  
  "If liquidated, you end with 0.262 BTC instead of 0.416 BTC (−37%), even though you bought more."
- **Breakeven:** "BTC must be 13.8% higher at the end, without being sold on the way."
- **Trend side by side:** no trend 64 · +20%/year 56 · +50%/year 46, with the comparison to a lower LTV.
- **The history facts** (4 years: always higher so far; 1 year: 1 in 3 lower, worst −83%) plus "The past does not guarantee the future."

**New calculation, needs your OK:** "result counted in BTC" goes into the engine with its own independent check (criterion D10). The sketch numbers come from a copy of the engine's rules, which reproduces the headline exactly (64 of 100).

## 7. Feedback and donation (sketch section 4, right)

- **Feedback:** as approved. 4 questions + 1 optional, the "attach loan terms" box off by default, "Write e-mail" (to boddenlennart@proton.me) and "Copy text".
- **Donation:** one quiet sentence, your address with "Copy address", the QR code (`bitcoin:` link, made at build time), and "Donations on the Bitcoin network are public." Address checked: valid bech32 checksum, a script-type (P2WSH) address.

## 8. Where the six "?" sit

1. Starting LTV
2. Liquidation LTV
3. When do you pay the interest?
4. What happens when BTC falls?
5. The headline sentence
6. The 20-futures chart: its explanation sits directly above it, so this one is a sentence, not a button

Nothing else on the first screens has a "?".

## 9. Key wording (tier 1), English and German

| | English | Deutsch |
|---|---|---|
| Headline | In **64 of 100** simulated futures, this loan is liquidated within 12 months. | In **64 von 100** simulierten Zukünften wird dieser Kredit innerhalb von 12 Monaten liquidiert. |
| Sale line | Your BTC is sold if the price falls **40%**, to **€43,413**, or earlier if a margin call is not fixed within 48 h. | Ihre BTC werden verkauft, wenn der Kurs um **40 %** auf **43.413 €** fällt, oder früher, wenn ein Margin Call nicht innerhalb von 48 Stunden behoben wird. |
| Small print | Other model: 58 of 100 · assumes no price trend · not a forecast · what this does not include › | Anderes Modell: 58 von 100 · ohne Kurstrend gerechnet · keine Prognose · was das nicht abbildet › |
| Lever | Make it safer · Starting LTV 50% → 64 of 100 liquidated · you pledge 0.42 BTC | Sicherer machen · Start-LTV 50 % → 64 von 100 liquidiert · Sie hinterlegen 0,42 BTC |
| "?" on the headline | A simulated future is one possible path of the BTC price over your loan, built from real past price moves. We calculate 10,000 of them. 64 of 100 means: in 64 of every 100 paths, your BTC was sold before the loan ended. It is not a forecast and not a promise. | Eine simulierte Zukunft ist ein möglicher Verlauf des BTC-Kurses während Ihres Kredits, gebaut aus echten früheren Kursbewegungen. Wir berechnen 10.000 davon. 64 von 100 heißt: In 64 von 100 Verläufen wurden Ihre BTC vor Laufzeitende verkauft. Das ist keine Prognose und kein Versprechen. |

## 10. Decisions I need from you

1. **Variant 1 or 2** for the results? (I recommend 1.)
2. **Charts:** B as the main picture, C in history, A only in Expert. OK?
3. **New calculation "result counted in BTC"** for profile C: build it? (With its own tests.)
4. **Lender names:** OK to use neutral options plus the "Questions to ask a lender" checklist instead of naming providers?
5. **Anything in the sketches that feels wrong**, too much or missing?

## 11. Your Impressum question (not a design decision)

**I don't need your home address, and I recommend you don't send it to me.** You can enter it yourself at the very end, in two places (`legal.impressum` in `src/content/text.de.js` and `text.en.js`); I'll show you exactly where.

Two things to weigh first:
- **Security:** the page shows a Bitcoin donation address, and its topic signals that you hold BTC. A **home address next to that is a physical-security risk** for a known BTC holder.
- **Alternatives:**
  - Some services offer a business or "Impressum" address you can use. Whether such an address is acceptable as the required address for legal service is disputed in Germany.
  - Whether you need an Impressum at all depends on whether the page counts as business-like. Donations can play a role there.

  Both are questions for a lawyer, ideally before you publish. Your e-mail (boddenlennart@proton.me) goes into the feedback button and the Impressum contact line in Phase C.

## 12. Decisions (approved 2026-10-15)

| # | Decision |
|---|---|
| 1 | **Variant 1** ("Answer first"), with 5 sections instead of 7: *Make it safer* includes the other levers; costs sit together with *Borrow or sell?* / *Is the leverage worth it?* |
| 2 | **Charts:** "20 possible futures" is the main picture; "What really happened" goes in history; the bands only in the expert section. |
| 3 | **Result counted in BTC** for profile C: build it, with its own tests. |
| 4 | **Neutral levers + "Questions to ask a lender"**, no provider names. |
| 5 | **Price outlook:** presets anchored in our own history (Bear −30%, No trend 0%, Moderate +20%, Bull +50%, Generational run +100% a year) plus a free slider. The headline always shows "no trend" with the visitor's outlook next to it. "Black swan" is handled as a stress test (real crashes started today), not as a trend. No forecasts gathered online. |
| 5 (changed 16 Oct 2026) | **Price outlook replaced by a fixed comparison.** The free outlook only added one extra number and suggested a forecast the data cannot support (the past trend is only known to lie between about +1% and +112% a year). Now "What history says" shows the visitor's loan at five fixed trends (−30%, 0, +20%, +50%, +100% a year), and the same for the result in BTC. The rest of the page assumes no trend. |
| 6 | **Margin-call behaviour is a setting:** only a warning · top up within N hours, otherwise the lender sells everything / only enough to reach the target LTV · the lender automatically sells part to reach the target LTV · no margin call. At the liquidation LTV: sells everything / only enough to reach the target. |
| 7 | **"How these numbers are made"** in three layers: one sentence under the headline, one line above the 20-futures chart, a full section with method, data, history test results, limits and a link to the code. |
| 8 | **Also in Phase C:** amounts in BTC (and entering "BTC I pledge" instead of the LTV), "I already have a loan", a shareable link (inputs stored only in the link itself, never sent to a server). |

Evidence for decision 5 (test offer, margin call only a warning, liquidated of 100): even at +100% a year, a 60-month loan at 50% LTV is liquidated in 37 of 100 futures. Average yearly growth over 4-year periods since 2014: worst +8%, median +61%, best +172%; by start year it fell from +113% (2014–18) to +16% (2022–26). Script: `ux/sketches/trend-grid.mjs`.
