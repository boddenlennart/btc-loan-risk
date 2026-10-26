# 005 · "Liquidated" means any forced sale

Date: 2026-10-19 · Status: in force

## Decision
The big number, tables, levers, slider and trends count every forced sale, full or partial (pSale = full + partial). The lender's sale is called "liquidation" everywhere ("Liquidated at", "Liquidiert bei").

## Why
A big 0 next to 68 partial sales misled the reader (UAT finding 1).

## Alternatives considered
Counting only full liquidations (rejected).

## Consequences
Wording is fixed in the content tests; partial sales still shown separately where they matter.

## Sources
ux/N-uat-report.md finding 1; commit f24bbce; owner 2026-10-18 (wording).
