# 020 · Sale price in a fast fall: the step's lowest price

Date: 2026-10-27 · Status: in force

## Decision
A sale triggered by a price level (the liquidation LTV, full or partial, and the immediate partial sale at the margin call) is counted at the lowest price of the step in which the level was reached, never above the level: the day's low in the simulations, the hour's low in the real-history replay. A sale at the end of a top-up deadline stays at that step's close. No extra haircut ("the lender sells x% below the market"): 0%, and no input for it yet.

## Why
Real liquidations sell into the fall, often below the level (gaps, slippage). One simple rule for every method and every offer; it is the cautious end, stated openly on How it works. A haircut other than 0% would need a source.

## Alternatives considered
The step's close, never above the level (rejected: less cautious, and the close can be far from the moment of the sale); a stated haircut as default (rejected: no source); a haircut input (postponed).

## Consequences
The liquidation chance hardly moves (only with partial sales, which sell more BTC at the lower price); the BTC returned falls and the cost of the risk rises (about a fifth for the example loan on 27 Oct 2026). The independent Python references follow the same rule. The textbook barrier formula on How it works still assumes a sale at the level. Dated note on How it works.

## Sources
Issue #7 (feedback from a lender's CEO, 23 Oct 2026, see decision 002); owner 2026-10-27 (answers 1a, 2a, 3a).
