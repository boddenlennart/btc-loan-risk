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

## What follows for the design

- **Profile A decides the layout:** answer first, few inputs first, plain sentence, one lever.
- **Profile B keeps everything they need**, but behind one door: an "expert details" section, collapsed by default.
- **Comparing two offers side by side** would help Profile B. It is a new feature, though, so it is **not** part of this redesign ("deeper, not bigger"). Noted for later.

**Please correct:** Do the two profiles match your friends? Who is missing? Is the order of the five decisions right?
