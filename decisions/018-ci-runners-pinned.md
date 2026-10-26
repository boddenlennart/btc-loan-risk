# 018 · GitHub's test computers pinned to Ubuntu 24.04

Date: 2026-10-26 · Status: in force

## Decision
Every job in `.github/workflows/tests.yml` and `update-data.yml` runs on `ubuntu-24.04`, not `ubuntu-latest`. The browsers are kept between runs (cache of `~/.cache/ms-playwright`); installing them is its own step with its own time limit (15 min), the tests have 30 min. Actions `checkout` and `setup-node` are v5.

## Why
From 19 Oct 2026 `ubuntu-latest` moved to a newer Ubuntu, where installing the browsers took up to 30 minutes. On 26 Oct Safari's engine and the iPhone setup hit the 40-minute limit twice (pull requests #6 and #15), although their tests take about 10 minutes.

## Alternatives considered
"Re-run failed jobs" each time (worked once, failed again the same day); exempting the owner from the branch rule (rejected: removes the protection).

## Consequences
Moving to a newer Ubuntu is a deliberate change on a branch, after its tests pass. `tests/workflow.test.js` guards the pin, the action versions, the separate install step and the cache.

## Sources
Issue #14; pull requests #6, #15.
