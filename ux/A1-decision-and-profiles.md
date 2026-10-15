# A1 · The visitor's question, decision and profiles

*Phase A, step 1. Draft for your corrections.*

## The one question a visitor comes with

> **"If I take this loan, how likely is it that I lose my bitcoin, and what can I do to make it safer?"**

Everything else is secondary:

- **Second question:** "What does it cost me compared with simply selling some BTC?"
- **Third question** (only for some visitors): "Are the numbers in my offer right, and how does this offer compare with another?"

## The decision they make afterwards

After using the page, a visitor does one of these:

1. **Take the loan as offered.**
2. **Take it, but safer:** borrow less (lower LTV), choose a shorter duration, or keep money aside to add collateral at a margin call.
3. **Sell some BTC instead.**
4. **Do nothing** (no loan, no sale).
5. **Ask the lender a question first**, for example how it measures the BTC price or what happens after a margin call.

For profile C (below), decisions 1 and 2 mean "take the leverage as planned / take less leverage", and 3 becomes "don't lever, keep the BTC as it is".

**Design consequence:** the results must lead to these five options. Every result that does not help choose between them moves to an expert section or goes.

## Profile A: first-time borrower *(main profile)*

| | |
|---|---|
| **Situation** | Holds some BTC for a few years. Needs money for something concrete (a car, a renovation, a deposit). Does not want to sell. |
| **Knowledge** | Understands what BTC is and that its price swings. Has never taken a crypto-backed loan. Has a vague idea of "LTV" from the offer, but could not explain it. Not a finance person. |
| **What they have in hand** | One offer, as a PDF or a web page from one lender. |
| **Device** | Mostly a phone, possibly on the sofa, with the offer open in another app. |
| **Questions in their own words** | "Is this safe?" · "How far can BTC fall before I lose it?" · "What happens if it falls?" · "Am I being ripped off?" |
| **What would go wrong today** | Scrolls past ~1,170 words and 23 "?" buttons before seeing any result. Meets 26 results of equal weight. Does not know which number matters. May read "55%" as "BTC will fall 55%". |
| **Success for them** | Within a few minutes they can say: "In about half of the simulated futures I'd lose my BTC. With a lower LTV it would be about one in five." Then they choose one of the five decisions above. |

## Profile B: offer comparer *(secondary profile)*

| | |
|---|---|
| **Situation** | Has BTC and some finance experience. Has two or more offers and wants the better one, or wants to check the lender's numbers. |
| **Knowledge** | Knows LTV, margin call and APR. May know what a Monte Carlo simulation is. |
| **What they have in hand** | Two offers or term sheets, possibly a spreadsheet. |
| **Device** | Mostly a laptop. |
| **Questions in their own words** | "Which offer has the lower real cost?" · "Which one is safer at the same loan amount?" · "Do the lender's numbers add up?" · "How does the model work?" |
| **What would go wrong today** | Finds all the details, but has to re-enter everything to compare two offers. The table of methods and the payment plan are there but scattered. |
| **Success for them** | Can check the liquidation price, total interest and payback against the offer to the cent, and see the risk of two LTVs side by side. Finds the model details in one expert section. |

## Profile C: leveraged long-term holder *(added by you)*

| | |
|---|---|
| **Situation** | Experienced Bitcoiner with a long-term conviction that BTC gains value against fiat money, which loses purchasing power over time. Borrows fiat against BTC **to buy more BTC now**. Plans to repay later, either with fresh income or by selling some of the (hopefully more valuable) BTC. |
| **Knowledge** | High. Knows LTV, margin calls and liquidation, probably from experience. Has a view on BTC's long-term price. |
| **What they have in hand** | One or more offers; a target amount of BTC to buy; sometimes a plan to add the bought BTC as extra collateral. |
| **Device** | Laptop and phone. |
| **Questions in their own words** | "How much can I borrow before the liquidation risk gets serious?" · "How much must BTC rise for this to pay off?" · "What if BTC halves first, before it goes up?" · "Do I end up with more BTC than if I hadn't borrowed?" |
| **Decision afterwards** | How much leverage to take (LTV, amount), for how long, how much cash to keep ready for margin calls, and whether to repay with income or by selling BTC. Or: not to lever at all. |
| **What would go wrong today** | The page frames the loan as "borrow **or sell**". This profile borrows **to buy**. The breakeven assumes repayment by selling BTC. The 0% price trend sits hidden in the model settings, although this profile's whole idea is a long-term upward trend. The page does not show the **double hit**: when BTC falls, the collateral and the newly bought BTC lose value together, and a liquidation sells the collateral at the low. |
| **Success for them** | They can see, for the LTV they are considering, the chance of liquidation, the BTC rise needed to break even, and the **result counted in BTC**: in how many of 100 simulated futures they end up with more BTC than without the loan, and in how many with less. |

**An honest point the page should make to this profile:** the loss of fiat purchasing power is a few percent per year. BTC's price swings are far larger: in 8 of the 13 calendar years since 2014, BTC fell at least 50% from a high within the same year (most: 82% in 2018; measured on this project's USD data). Over a loan of 1–3 years, **the liquidation risk is driven mainly by the swings, not by the long-term trend.** A positive long-term trend lowers the risk only somewhat. The page should show the result with **no trend assumed and with the visitor's own trend side by side**, so optimism is visible and not hidden in a setting.

## What follows for the design

- **One early question, "What will you do with the money?"**, separates the profiles: *spend it* (A, B) or *buy more BTC* (C). The answer changes only one results section: "Borrow or sell?" becomes "Is the leverage worth it?". The headline, the lever and the price ladder stay the same for everyone.
- **Profile A decides the layout:** answer first, few inputs first, plain sentence, one lever.
- **Profile B keeps everything they need**, but behind one door: an "expert details" section, collapsed by default.
- **Comparing two offers side by side** would help Profile B. It is a new feature, though, so it is **not** part of this redesign ("deeper, not bigger"). Noted for later.

**Status:** profiles A and B confirmed by you; profile C added at your request.
