# 020 · Sale price in a fast fall: the lowest price of the hour the level is reached

Date: 2026-10-27 · Status: in force

## Decision
A sale triggered by a price level (the liquidation LTV, full or partial, and the immediate partial sale at the margin call) is counted at the lowest price of the hour in which the level was reached, never above the level. The real-history replay steps by hour; the simulation's real days keep their hourly lows for this (the first hour whose low reaches the level). The volatility model and the smooth textbook-style model have no real hours: there the day's low counts (they feed only the "other methods" counts). A sale at the end of a top-up deadline stays at that step's close. No extra haircut ("the lender sells x% below the market"): 0%, and no input for it yet.

## Why
Real liquidations sell into the fall, often below the level (gaps, slippage). One rule for the simulation and the replay. First built with the day's low (27 Oct 2026, owner's answer 1a); a review the same day measured that on about 1,680 real liquidations since 2014 the day's low was a median 6% below the level, the crossing hour's low 1.5%: a lender sells within minutes, not at the worst moment of the day. The owner then chose the crossing hour. Still cautious: a sale within minutes often gets more than the hour's low. A haircut other than 0% would need a source.

## Alternatives considered
The step's close, never above the level (rejected: the close can be far from the moment of the sale); the day's low in the simulation (built first, replaced the same day: about four times the real overshoot); a stated haircut as default (rejected: no source); a haircut input (postponed).

## Consequences
The liquidation chance hardly moves (only with partial sales, which sell more BTC at the lower price); the BTC returned falls and the cost of the risk rises (about 7% for the example loan on 27 Oct 2026). The independent Python references follow the same rule. The textbook barrier formula on How it works still assumes a sale at the level. Dated note on How it works.

## Sources
Issue #7 (feedback from a lender's CEO, 23 Oct 2026, see decision 002); owner 2026-10-27 (answers 1a, 2a, 3a; then the crossing hour after the quant review).
