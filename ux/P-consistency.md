# Numbers that must agree with each other

Status: 21 Oct 2026. Test: `e2e/consistency.spec.js`.

## Why

Every number on the page was tested on its own. Still, the owner found pairs that disagreed, because each one was rounded or sampled on its own:

- **Futures chart:** its five sets of 20 had 13 liquidations, while the answer said 15. The chart showed the first 100 futures, a random draw.
- **Cost of the risk:** "In 47 of 100 futures it is zero" sat next to "54 liquidated" (53.5 and 46.5, each rounded up).

A careful reader compares such numbers. This check does the same, on the screen as a visitor sees it.

## What is checked

The check opens 30 very different loans, two comparisons, How it works and three loans in German. It reads every number from the screen and checks these rules.

**Under the answer**

| # | Rule |
|---|---|
| 1 | The dots and their legend add up to 100. "Liquidated" plus "partly liquidated" equals the big number. The red dots equal "liquidated", and so does "… of them in full" in the answer. |
| 2 | **Futures chart:** the five sets of 20 together have exactly the big number of liquidations, and the sentence under the chart says so. |

**What it costs**

| # | Rule |
|---|---|
| 3 | "In X of 100 futures it is zero" equals 100 minus the big number. |
| 4 | **The tile and "What it costs"** show the same total including the risk, and the same yearly rate. |
| 5 | That total is the cost if nothing goes wrong plus the cost of the risk (each rounded to 10). The "instead of" rate is the cost line's rate. |

**Make it safer and the price trend**

| # | Rule |
|---|---|
| 6 | "Your terms" equals the big number. The slider at your own LTV says the same. The best change equals its own row. |
| 7 | "No trend" in "Does the price trend matter?" equals the big number. |

**Real history, buy more BTC, liquidation price**

| # | Rule |
|---|---|
| 8 | The real-history number in "Other methods" equals the history section's count (full plus partial). |
| 9 | **Buy more BTC:** more plus less equals 100. "Liquidated" there equals "liquidated" under the answer. |
| 10 | **Liquidation price:** the tile's price is the one in "What happens when BTC falls". |
| 15 | **Calmer and wilder swings** (decision 021): the calm anchor is below the simulation's swings, the wild one above; calmer gives at most the answer's number, wilder at least (not for a loan already past its margin call, where calmer swings make a recovery less likely). The three volatilities equal those on How it works. |
| 16 | **Entry timing** (issue #12): the table's "All start days" row repeats the history line above it, full and partly liquidated. |
| 17 | **Real history** (owner, 29 Oct 2026): the section's title line repeats the start-years table's 2014 and 2020 rows; the 2014 row (all start days) is the number in "Other methods" and the 90-day table's last row. |

**Comparing loans**

| # | Rule |
|---|---|
| 11 | **Comparing offers:** each column's "Liquidated" and "Cost incl. liquidation risk" equal that offer's own answer and cost. |
| 12 | **Refinancing:** the current loan's and the refinancing's columns equal their own answers. With the same length, "next 12 months" equals "whole term". |

**Other pages and languages**

| # | Rule |
|---|---|
| 13 | **How it works:** the red dots and the methods table equal the check page's example (answer, real history, volatility model). The futures with and without a sale add up to all futures. The cost of the risk, rounded to €10, and the total equal the check page. "Zero in X of 100" equals 100 minus the answer. |
| 14 | **German:** the same loans show the same numbers as in English (the answer, the legend, the tiles, the cost of the risk, "Make it safer"). |

The loans cover:

- **Loan types:** new and existing loans (one past its margin call), buy more BTC (repaid by selling or in cash), variable rate, interest added, equal payments, cash reserve, high fees, tax.
- **Lender rules:** every margin-call rule, partial sales.
- **Terms:** starting LTVs from 20% to 68%, liquidation LTV 75–90%, 3 to 36 months.
- **Currencies:** four.

## What it found (21 Oct), all fixed

| Found | Fix |
|---|---|
| **Futures chart** 13, answer 15 | The 100 futures shown are picked at random so that, like all futures, the answer's number end in a liquidation. A sentence under the chart says so |
| **"Zero in 47 of 100"** next to 54 liquidated | 100 minus the answer's number |
| **"Buy more BTC": 53 liquidated**, under the answer 54 (repaid in cash) | The same count as under the answer; more and less share the rest |

Each rule was checked to fail with the old behaviour:

- zero count rounded on its own: 8 of 32 loans fail;
- chart not matched to the answer: 31 fail;
- "buy more BTC" rounded on its own: 1 fails.

## Adding a number to the page

If it can be compared with another number, add its rule here and in `e2e/consistency.spec.js`.
