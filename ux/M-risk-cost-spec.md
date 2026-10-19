# Cost including the risk: specification

Status: 19 Oct 2026. Approved by the owner (definition B, Insights item renamed, built before the launch) and built the same day.

Background: a friend working for a lender priced the liquidation risk as an option (paper "The Economics of Bitcoin Loan Margin Calls", March 2026). The back-check (conversation of 19 Oct) found his calculations correct and his margin-call premium the right quantity for the borrower. It also found that his put on loans without a margin call is the lender's risk, not the borrower's cost. The owner chose **definition B**: the price of protecting the borrower against what a liquidation costs them.

## 1. The definition

**In one sentence:** the average, over the 10,000 simulated futures, of what a liquidation takes from the borrower by the end of the loan. That is the rise they miss on the BTC sold, plus the BTC paid as the liquidation fee.

**In each simulated future,** for every sale by the lender (full liquidation, sale after a missed margin call, or partial sale):

| Symbol | Meaning |
|---|---|
| `b` | BTC sold in this sale (the fee included) |
| `k` | Share of the sale that repays debt: `1 / (1 + fee)` for a fee on the amount owed, `1 − fee` for a fee on the BTC sold (as in `src/engine/lender.js`) |
| `P_sale` | The sale price |
| `P_end` | The BTC price on the last day of the loan in this future, scaled (see below) |

Loss from this sale = `k·b · max(0, P_end − P_sale)` + `(1 − k)·b · P_end`.

- The first part is the missed recovery: had the BTC not been sold, it would be worth `P_end` instead of `P_sale`. If BTC falls further after the sale, the sale did no extra harm, so this part is 0. That is the payoff of a down-and-in barrier option.
- The second part is the fee: that BTC is gone whatever happens.

**Cost of the risk** = the average of all losses over all 10,000 futures, the many futures with no sale included as 0.

**Cost including the risk** = full cost (interest and fees; for a refinancing also the switching costs) + cost of the risk.

**Per year:** effective yearly rate + cost of the risk ÷ loan amount ÷ years, shown as "about X% a year".

**Scaling of the end price.** In the simulation, the middle price stays at today's level, but the average end price is higher, because large rises pull it up (+21% after 12 months). An option price needs an average end price equal to today's price, as in standard option pricing with an interest rate of 0. So every `P_end` is multiplied by `today's price ÷ average end price`. The number then needs no assumption about the price trend.

**Not included, and said so:**
- the lender failing or losing the BTC
- sales below the liquidation price in fast crashes (the simulation sells at the liquidation price)
- taxes
- interest on money (an interest rate of 0 is used; with 4% the number would be about 5% lower)
- the advantage a borrower may have when the lender cannot claim more than the BTC

**Where it applies:**
- **New loans:** over the whole term.
- **Existing loans:** over the months left, from today's LTV.
- **A refinancing:** over the new term; the current loan over its months left.
- **"Buy more BTC":** the same; the bought BTC is not pledged and not affected.
- **"Make it safer" options and the trend table:** not computed, which keeps the calculation fast.

**Precision:** the method page states it (about ±€50 on the example; computed from the spread of the 10,000 losses). The check shows the cost rounded to €10 and marked "about".

## 2. Where it appears

| Place | What |
|---|---|
| Check, "What it costs" | A new block after the cost sentence, before "Borrow or sell?" (texts below) |
| Check, comparison of offers | New row "Cost including the risk", value and "about X% a year" |
| Check, refinancing table | The same row, for the current loan (months left) and the refinancing (new term) |
| How it works | New section "The cost of the risk" (texts below), after "The lender's rules in the simulation" |
| Glossary | New entry "Cost of the risk" |
| Insights | Item 7 renamed to "What liquidations cost since 2014", plus one sentence saying it measures what really happened (BTC's rise included), not the protection price on the check |
| Tiles under the answer | Added 19 Oct at the owner's request: under "Full cost" (new loan) or "Interest left" (existing loan) two small lines, "with the liquidation risk: about €X · Y% a year" (existing loan: amount only); a tap opens the explanation. The big number stays the contractual cost. |
| Share text | Unchanged |

## 3. Texts (English drafts; German follows the same content)

**"What it costs" block**

- Heading: *Cost including the risk*
- Big line: *Including the liquidation risk: about {total} ({rate} a year instead of {apr}).*
- *{risk} of it is the cost of the risk: what full protection against a liquidation would cost on average in the simulated futures.*
- *It is not a fee anyone charges you. In {none} of 100 futures it is zero; after a liquidation, it is far more.*
- *Use it to compare offers: lower interest with a higher liquidation chance can cost more in total.*
- Link: *How this number is made →* (to How it works, #risk-cost)

**Comparison tables:** row *Cost including the risk*, small line *about {rate} a year*. When the offers run for different lengths, the existing note applies.

**How it works, "The cost of the risk"**

1. *What it measures.* What a liquidation takes from you by the end of the loan: the rise you miss on the BTC sold, and the BTC paid as the fee. If BTC falls further after the sale, the sale did no extra harm and counts as 0.
2. *One future, worked through.* Built from the example loan's real numbers at build time, for example: *Liquidated on day 120 at €37,500; 0.2667 BTC repaid the loan, 0.0133 BTC was the fee. At the end BTC was at €52,000: the missed rise is 0.2667 × (52,000 − 37,500) = €3,867, the fee €693. Total in this future: €4,560.*
3. *From 10,000 futures to the number.* The average over all futures, those without a sale included as 0. On the example: about {risk}, ±{se}.
4. *Why the end prices are scaled.* One paragraph, as in section 1.
5. *The option view.* This equals the price of a down-and-in barrier option on the BTC sold. A cross-check table on the example loan:
   - the textbook formula for that option, with the simulation's 57% volatility and smooth prices
   - the same computed in the simulation
   - the difference, explained (crashes within the day, fee, lender rules)
6. *How to read it.* Three points: an average, not a payment; zero in most futures, large after a liquidation; for comparing offers.
7. *Loans without a margin call or liquidation during the term.* There the risk mostly sits with the lender, not the borrower. A lender has to be paid for it somehow, for example through the rate or a lower LTV. This page does not put a number on the lender's side.
8. *Not included:* the list from section 1.

**Glossary:** *Cost of the risk: the average, over the simulated futures, of what a liquidation takes from you by the end of the loan: the missed rise on the BTC sold and the BTC paid as the fee. An option price, not a fee.*

All texts follow the content rules (no advice or market claims, at most 30 words a sentence). Words like "true cost" or "hidden price" are not used.

## 4. Checks before it ships

1. **Independent Python version** (`reference/reference_montecarlo.py`): computes the same cost per loan from its own sale records. Exact agreement for all 24 cases stays a permanent test.
2. **Answers known in advance** (`tests/math-audit.test.js`):
   - no sale: 0
   - price flat after the sale: only the fee part
   - a known end price: the exact formula
   - partial sales with both fee bases: exact
   - after scaling, the average end price equals today's price
3. **Textbook cross-check:** with the simulation's smooth-price model (`gbm`, constant volatility), the simulated option price agrees with the barrier-option formula (adjusted for daily checking) within the simulation's precision.
4. **The friend's paper reproduced as a test:** his loan at 30/40/50% volatility gives his margin-call premiums (0.6 / 2.1 / 4.8%) within precision, with continuous checking.
5. **Golden master** updated, with the new figure explained in the commit.
6. **Browser tests:**
   - the block in "What it costs"
   - the comparison and refinancing rows
   - the method page section
   - both languages
   - no console errors
7. **Calculation time** measured before and after; at most a few percent slower.
8. **Maths audit** (`ux/K-math-audit.md`): a new row for this check.

## 5. Open points for the owner

1. Approve this specification (definition, places, texts).
2. Rename Insights item 7 to "What liquidations cost since 2014"?
3. Build now, before the launch?
