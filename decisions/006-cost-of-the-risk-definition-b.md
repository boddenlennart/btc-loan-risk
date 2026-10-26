# 006 · Cost of the risk: definition B

Date: 2026-10-19 · Status: in force

## Decision
The cost of the liquidation risk is the price of full protection against a liquidation, averaged over the simulated futures: per sale, the missed rise on the BTC that repaid debt (k·b·max(0, end − sale)) plus the full end value of the BTC paid as fee ((1−k)·b·end), with end prices scaled so their average equals today's price (as in option pricing). Shown as the cost including the risk, next to the cost if nothing goes wrong.

## Why
It values what the borrower actually loses, on the same futures as the answer, and compares offers fairly (a lower rate with more risk can cost more).

## Alternatives considered
A friend's option-based pricing (paper "The Economics of Bitcoin Loan Margin Calls", March 2026): its calculations were checked and found correct, but its put on loans without a margin call measures the lender's risk, not the borrower's cost. The textbook barrier value stays on How it works as a cross-check.

## Consequences
Insights item renamed "What liquidations cost since 2014" because it measures real history, BTC's rise included.

## Sources
ux/M-risk-cost-spec.md; commit f526de6; owner 2026-10-19.
