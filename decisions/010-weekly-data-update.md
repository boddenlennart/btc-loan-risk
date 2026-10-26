# 010 · Weekly data update by pull request, never merged automatically

Date: 2026-10-15, reworked 2026-10-21 · Status: in force

## Decision
Every Monday 05:17 UTC a GitHub workflow fetches new hourly prices (Bitstamp, checked against Kraken) and ECB rates, rebuilds pages and link-preview images, runs all unit tests, then the browser tests in five setups side by side, and opens a pull request for the owner. Failures open an issue and delete the unfinished branch. The page warns when data is older than 45 days.

## Why
Fresh data with a human check; the owner merges in about two minutes a week.

## Alternatives considered
Automatic merge (rejected by the owner).

## Consequences
The owner merges; Claude reviews with the skill weekly-data-review. Mind GitHub's 60-day inactivity rule (README).

## Sources
README "How to update and check the data"; .github/workflows/update-data.yml; tests/workflow.test.js.
