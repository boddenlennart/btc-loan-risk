# Brief for two outside reviewers (one page)

**Bitcoin Loan Check** (bitcoinloancheck.com) is an independent, free page that checks any BTC-backed loan offer. It runs only in the browser and collects no data. For a set of terms it shows how often such a loan would be liquidated in 10,000 simulated futures built from real price moves since 2014, the liquidation and margin-call prices, the full cost, the cost including the liquidation risk (an option price), what happened since 2014, and a comparison of offers and refinancings. Method and maths: /method/; independent check: `ux/K-math-audit.md`; source code: github.com/boddenlennart/btc-loan-risk.

It names no lenders, gives no advice and never marks an offer as "best". It wants to be useful to borrowers and fair to lenders.

## For the reviewer from a lender (about 45 minutes)

Please enter two or three real offer structures you know well, and tell us:

1. **Can every rule be entered?** Margin-call levels, time to top up, partial or full sale, the fee basis, which LTV the lender brings you back to, how interest is paid. Which rules have no field, or are approximated?
2. **Are the sale mechanics realistic?** The page sells at the liquidation price; it checks every day's lowest price. Where does real practice differ in a way that changes the answer?
3. **Which words would confuse your customers?** For example "margin call", "time to top up", "cost including the risk".
4. **Is the "cost including the risk" fair to lenders?** It prices the borrower's loss from a liquidation (missed recovery plus fee) as a barrier option; for loans without liquidation during the term it says the risk sits with the lender.
5. **What would make you send customers to this page, and what would stop you?**

## For a UX reviewer (about 60 minutes)

Please review on a phone and a computer, in English and German if possible:

1. **Heuristics.** Nielsen's 10 heuristics; each finding with a severity of 0–4 and a screenshot.
2. **Three tasks.** Check your own offer; compare two offers; check a loan you already have and a refinancing. Where do you hesitate?
3. **Numbers.** Is it clear what each number means and what it does not include? Is anything stated twice in different words?
4. **Movement.** Anything that jumps, scrolls unexpectedly, or loses your place?
5. **Trust.** Does the page feel independent and careful, or like marketing?

Please send findings as a list: where, what you saw, why it matters, severity. Thank you!
