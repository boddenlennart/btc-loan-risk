# 021 · Calmer and wilder swings: two measured anchors, the answer unchanged

Date: 2026-10-27 · Status: in force

## Decision
Under the answer, one line states the swings the simulation assumes (its volatility, recent years weighted more) and shows the same loan with calmer and wilder swings: as calm as BTC's calmest 365 days so far, and as wild as 2017–2021. Both are measured from the price data at every build (history.volatilityAnchors). The same real days and futures are used; every daily move, the day's low and its hours are scaled by anchor ÷ the simulation's volatility (montecarlo volScale). Only the liquidation number is shown for them. The answer and every other number stay on the simulation's own swings (decision 004). Visitors cannot type their own volatility.

## Why
Visitors and reviewers asked how much the answer depends on the volatility assumption. Anchors from BTC's own history need no forecast and no "typical" value; they update with the weekly data. Scaling keeps every real crash shape and all days since 2014.

## Alternatives considered
Drawing only days from the calm or wild period (too few days); fixed factors such as ×0.75 / ×1.25 (no source); a free volatility input (reverses the removal of model settings, ux/L-holistic-review.md S1, and allows reassuring numbers with nothing behind them); a "drastically calmer future" of 20% a year (half of BTC's calmest year: a forecast, against the standing rules); a three-way switch that redraws the answer (would change the headline). A toggle for data since 2020 only (a visitor's suggestion, 27 Oct 2026): checked, 2014–2017 are about 8% of the draws and 2020 onwards gives a slightly higher answer (49 vs 46); instead fixed lines: real history on start days since 2020 on the check page, "Only 2020 onwards" in the weighting table on How it works.

## Consequences
Scaling also makes the single worst days smaller or bigger in the same proportion (stated on How it works). For a loan already past its margin call, calmer swings can give a higher number (less chance to recover); the numbers rule allows that. Two extra count-only runs per answer.

## Sources
Issue #10; owner 2026-10-27 (1a, 2a, 3a, 4a; calm anchor = calmest 12 months, no free input, no 20% line).
