# 013 · Visual identity: the Bitcoin logo, orange only for the logo

Date: 2026-10-17, changed 2026-10-21 · Status: in force

## Decision
Logo: the official Bitcoin logo (public domain, as a vector) in the top bar, tab icon and previews. Orange belongs to the logo only. Status colours: liquidated a clear red, partly liquidated a half-filled red dot, margin call gold/yellow; history lines teal instead of orange. Font Source Serif 4 (self-hosted), fixed type scale. Link previews show the example's answer with its dots. Halving markers on the Insights price-swings chart.

## Why
More Bitcoin feel while staying professional; orange must never read as a warning; colour-blind visitors must tell red from gold.

## Alternatives considered
Logo B "distance to the line" (used until 2026-10-21); pink for partial (option 1, rejected).

## Consequences
tests/design.test.js guards hues, contrast and colour-blind distance.

## Sources
Owner 2026-10-21; commit 0b1c08a.
