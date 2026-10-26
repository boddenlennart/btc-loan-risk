# 012 · Testing policy

Date: 2026-10-19 to 2026-10-21 · Status: in force

## Decision
Every fix gets a test that would have caught it, checked to fail on the old code. Browser tests act like visitors (real taps, drags, keys; no faked events) in five setups: Chrome, Safari's engine, Firefox, iPhone, Android. A numbers check (decision 007) runs on 30 loans. Tests compare with the stored example, never with a hard-coded result that new data moves.

## Why
The owner found a slider that did nothing on iPhones (tests had faked the release on a desktop window) and mismatched numbers.

## Alternatives considered
Desktop-only tests with shortcuts (rejected).

## Consequences
GitHub runs everything on every push and pull request; the required check is "test".

## Sources
Owner 2026-10-19 ("Give each fix a test"), 2026-10-20 (mobile slider); ux/E-test-plan.md, ux/G-quality-report.md.
