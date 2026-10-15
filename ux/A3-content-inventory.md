# A3 · Content inventory

*Phase A, step 3. Example numbers use the test offer from A2 at a BTC price of €72,066. Every text, input and result on the current page, with a proposed verdict. These are **hypotheses**: the baseline test (A2) confirms or overturns each one before anything is built.*

## How to read this

- **Verdicts:**
  - **Keep:** stays visible.
  - **Merge:** combined with another element.
  - **Shorten:** stays, with less text.
  - **Expert:** moves into one collapsed "Expert details" section, still complete.
  - **Cut:** removed from the page.
- **Rule for every verdict:** does this element help the visitor choose between the five decisions in A1 (take as offered · take safer · sell instead · do nothing · ask the lender first)? If not, it moves to Expert or goes.
- **"Brief ⚑"** marks elements your original brief explicitly asked for. Changing them needs your OK; I name the change in **bold**.
- **Tier:**
  - **1** = the answer, seen first
  - **2** = the reasons, one step deeper
  - **3** = details on request (Expert)

## Today in numbers (measured on the current page, English; German is similar)

| | Today |
|---|---|
| Words a visitor passes before the first result (intro + form labels, hints, "where to find" lines, example badges) | **≈ 1,170** |
| Visible input fields | **23** (of 27) |
| "?" buttons | **23** |
| Result boxes, all with equal weight | **26** |
| "What does this mean?" toggles | **26** |
| "Not financial advice" / "lender's figures win" notices shown | **2 each** |
| Readability of help texts | Flesch 79 (EN) · Amstad 66 (DE) · ~11 words per sentence. **Already easy.** |

**Finding:** the sentences are not the problem. **The amount, the equal weight of everything, and where things sit are.**

---

## 1. Inputs (form)

| Input | Brief | Verdict | Tier | Where it goes / why |
|---|---|---|---|---|
| Loan amount | ⚑ | **Keep** | 1 | Essential. One of the first 5 inputs. |
| Starting LTV | ⚑ | **Keep** | 1 | Essential **and the main lever.** Also becomes a slider in the results (replaces the what-if table). |
| Liquidation LTV | ⚑ | **Keep** | 1 | Essential: it defines the liquidation price. |
| Duration | ⚑ | **Keep** | 1 | Essential. Possibly a second lever in the results. |
| Interest rate (fixed) | ⚑ | **Keep** | 1 | Essential for cost. Barely changes the risk, so it doesn't need to be first. |
| BTC price today | ⚑ | **Shorten** | 1 | Not a form field anymore: one line "BTC price used: €72,066 (Coinbase, 11:20) · change". Automatic is enough for Profile A. |
| Currency | ⚑ | **Shorten** | 1 | A small switch next to the amount (€ / $), not a separate field. |
| Margin-call LTV | ⚑ | **Merge** | 2 | Into one block "What happens when BTC falls" under *More terms from your offer*: margin-call LTV + cure period + what the lender does after it. |
| Cure period | ⚑ | **Merge** | 2 | Same block as above. |
| If a margin call is not fixed in time | – | **Merge** | 2 | Same block as above. Becomes one plain question. |
| How you pay back | ⚑ | **Merge** | 2 | Into one question "When do you pay the interest?" with 3 answers. The compounding question becomes an answer option, not its own field. |
| Interest on added interest (compounding) | ⚑ | **Merge** | 2 | Into "How you pay back" (see above). |
| Interest rate type (fixed / variable) | ⚑ | **Merge** | 2 | A link "the rate can change" under the rate field opens the rate steps. Not its own field. |
| Rate steps (variable) | ⚑ | **Keep** | 2 | Only after that link. Unchanged otherwise. |
| Origination fee | ⚑ | **Keep** | 2 | Under *More terms*. Matters for cost and APR. |
| Liquidation fee + "charged on" | ⚑ | **Merge** | 2 | One field with a small unit switch, under *More terms*. |
| Start date | – | **Expert** | 3 | Only affects day counting. Default: today. |
| Day count | ⚑ | **Expert** | 3 | Preset stays. Profile B needs it for the to-the-cent check. |
| LTV to return to after a margin call | – | **Expert** | 3 | Default (back to the starting LTV) fits most offers' wording. |
| Early repayment fee | ⚑ | **Cut** *(or Expert)* | – | Only feeds "cost to repay after half the loan time", which does not help the decision (see results). **Change to brief: drop the input and its result.** |
| Reserve you would add at a margin call | – | **Move** | 2 | Out of the form, into the results as a second lever: "What if I keep €2,000 ready?" It's a what-if, not a term of the offer. |
| Tax on selling now / at the end | ⚑ | **Move** | 2 | Out of the form, into the results section "Compare with selling BTC", where it is used. |
| Where you pay tax (notes) | ⚑ | **Cut** | – | Not used in any calculation; general tax notes only were agreed. **Change to brief.** |
| Notes and source of terms | ⚑ | **Keep** | 3 | At the very end of the form, collapsed ("Add a note about where these numbers come from"). |
| Number of simulated paths | – | **Expert** | 3 | Model setting. |
| Length of copied price blocks | – | **Expert** | 3 | Model setting. |
| Assumed yearly price trend | – | **Expert**, but named in tier 1 | 3 | The setting lives in Expert, but the headline sentence says "assuming no price trend". It is the one assumption that changes the headline a lot. |

**Result:** **5 inputs** visible first (amount, starting LTV, liquidation LTV, duration, rate) plus a one-line BTC price. About 8 more behind *More terms from your offer*; the rest in Expert.

## 2. Help texts per input

| Element | Brief | Verdict | Why |
|---|---|---|---|
| Short hint under every field | ⚑ | **Shorten** | Keep it only for the 5 essential fields, as a 1-line placeholder or subtitle. For the others the label must speak for itself, with the hint shown on demand. |
| "Where to find this in your offer" line under every field | ⚑ | **Merge** | Into **one** guide next to the form: "Where to find these numbers in your offer". A small picture of a term sheet with the 5 numbers marked, plus the search words. People read the offer once, not field by field. **Change to brief: one guide instead of per field.** |
| "?" button with a worked example on every field | ⚑ | **Shorten** | Keep the "?" only where the baseline test shows confusion. Expected candidates: starting LTV, liquidation LTV, how you pay back, margin call. **Change to brief: no longer on every field.** The full texts move to the glossary, so nothing is lost. |
| "Example, replace with your offer" badge on every field | ⚑ | **Merge** | Into **one** banner above the form ("Example values. Replace them with your offer."), plus a subtle highlight on the fields still unchanged. Today it repeats 23 times. |
| Error messages (problem + fix) | ⚑ | **Keep** | Already appear only when needed. |

## 3. Results

| Result | Brief | Verdict | Tier | Where it goes / why |
|---|---|---|---|---|
| Chance of liquidation | ⚑ | **Keep**, rewritten | 1 | **The headline.** As a sentence in natural frequencies ("In **55 of 100** simulated futures, this loan is liquidated within 12 months"), with a 100-dot grid. Range between models in small print. |
| What the number does NOT capture | ⚑ | **Shorten** | 1 | Stays next to the headline, but as **one line** plus "the 4 limits" on tap. Today it is a large box that pushes the answer down. |
| Liquidation price + fall until liquidation | ⚑ | **Merge** | 1 | Into the headline sentence: "Your BTC is sold if the price falls **40%**, to **€43,400**." Rising over time: "…and up to €48,700 by the end, because interest is added." |
| Margin-call price | ⚑ | **Merge** | 2 | Into a simple **price ladder**: today → margin call → liquidation, on one line. |
| Chance of a margin call | – | **Merge** | 1–2 | Into the dot grid as a third colour: fine / margin call but survived / liquidated. One picture instead of two numbers. |
| Past start dates ending in liquidation (replay) | ⚑ | **Keep**, reframed | 2 | As a **reality check:** "Started on any day since 2014, this loan would have been liquidated **40 times in 100**." |
| Worst case / fastest liquidation | ⚑ | **Shorten** | 2 | Into **2–3 concrete history stories**: "Taken at the 2017 peak: sold after 5 days." Concrete scenarios are easier to grasp than a statistic. |
| Possible price paths (fan chart) | ⚑ | **Redesign** | 2 | Phase B compares: fan chart vs. ~20 sample paths with the liquidated ones in red vs. history stories. Needs a one-sentence "how this is made". |
| Liquidation chance by month (bars) | ⚑ | **Shorten** | 2–3 | Into one sentence ("Most liquidations happen in the first 4 months"). The chart moves to Expert. |
| What-if table (other LTVs and durations) | – | **Merge** | 1 | Replaced by the **LTV slider** (and possibly duration) next to the headline. Interactive instead of a 3×3 table. |
| Reserve needed to survive | – | **Merge** | 2 | Into the reserve lever: "Keeping €X ready would have saved the loan in 90% of past start dates." |
| Top-up needed at a margin call | ⚑ | **Keep** | 2 | Under the margin-call step of the price ladder: "Then you'd need to add 0.17 BTC (≈ €8,600) within 48 h." |
| What you lose if liquidated | ⚑ | **Keep** | 2 | Under the liquidation step of the ladder: "You'd keep the €15,000 but lose 0.36 BTC." |
| Money you receive, total interest, total payback, total cost, effective APR | ⚑ | **Merge** | 2 | Into **one cost card**: "You receive €14,775 · pay back €16,819 · cost €2,044 (13.8% a year incl. fees)". |
| Interest share of payback | ⚑ | **Cut** | – | Doesn't change any of the five decisions; the cost card already shows the interest. **Change to brief.** |
| Cost to repay after half the loan time | – | **Cut** | – | Doesn't help the decision (see early repayment fee above). |
| Collateral BTC you pledge | ⚑ | **Keep** | 2 | In the cost card / price ladder ("You pledge 0.42 BTC"). |
| Monthly payment plan | – | **Expert** | 3 | Profile B needs it for the to-the-cent check. |
| Breakeven BTC rise vs. selling | ⚑ | **Keep** | 2 | In a section **"Borrow or sell?"** with the two tax inputs. Answers the visitor's second question (A1). |
| Tax note on liquidation | ⚑ | **Shorten** | 2 | One sentence in "Borrow or sell?" and under the liquidation step. |
| Methods compared (table) | ⚑ | **Expert** | 3 | Model detail; the range is already shown in small print. |
| Textbook formula | ⚑ | **Expert** | 3 | Sanity check only. |
| Live price line | ⚑ | **Shorten** | 1 | One line with source and time (see inputs). |

**Result:** tier 1 = **one sentence + dot grid + LTV slider + price ladder line**. Tier 2 = four short sections:
- What happens when BTC falls
- What it costs
- Borrow or sell?
- Reality check from history

Tier 3 = one Expert section.

## 4. Fixed sections

| Section | Brief | Verdict | Why |
|---|---|---|---|
| "What this page does" + "How it works" intro | – | **Shorten** | To **one sentence** above the form. The method moves to Expert ("How these numbers are made"). |
| Not financial advice | ⚑ | **Shorten** | **Once** near the result + footer. Today it appears twice in full. |
| Lender's figures always win | ⚑ | **Shorten** | **Once**, next to the liquidation price, where it matters. |
| Example values note | ⚑ | **Merge** | Into the single banner above the form (see help texts). |
| How the lender measures the price | ⚑ | **Keep** | In "What happens when BTC falls", collapsed, next to the liquidation price. It explains why the lender's trigger can differ. |
| Counterparty risk | ⚑ | **Keep** | In the "4 limits" next to the headline, plus a short section near the end. |
| Glossary | ⚑ | **Keep** | Becomes **the** home of all long explanations. Terms in the text link to it. |
| Privacy, data sources, Impressum, privacy notice | ⚑ | **Keep** | Footer. No change. |
| Bottom summary bar | – | **Keep**, rethink | Today it repeats the headline. In Phase B it could carry the LTV slider on phones instead. |
| Stale price warning, errors | ⚑ | **Keep** | Appear only when needed. |

## 5. Changes to your original brief that need your OK

1. **No longer** a "?" with a worked example on **every** input. Only where the baseline test shows confusion; full texts in the glossary.
2. **One** "where to find these numbers" guide instead of one line per field.
3. **Cut** the early repayment fee (input and result), the "where you pay tax" field and the interest-share result.
4. The completeness test is **rewritten** accordingly. Every element still needs an explanation somewhere (field, glossary or Expert), but not a visible one everywhere.

Nothing is cut or moved before the baseline test. If the test shows that people use something I want to cut, it stays.
