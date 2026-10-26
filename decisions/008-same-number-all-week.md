# 008 · The same terms give the same number all week

Date: 2026-10-20 · Status: in force

## Decision
The simulation uses only the stored weekly history; recent hours are not fetched. The live price is fetched but, with the LTV fixed, does not change the liquidation chance.

## Why
The example jumped from 54 to 53 a second after opening, which looked broken.

## Alternatives considered
Appending recent hours (rejected).

## Consequences
Numbers change only with the Monday data update; posts and texts quoting numbers must be checked after each update (skill live-numbers).

## Sources
Commit 08cbb35; owner 2026-10-20.
