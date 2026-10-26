---
name: release-check
description: Final check before the owner merges a feature branch of Bitcoin Loan Check into main. Use when a branch is finished and before telling the owner it is ready.
---

# Release check (before the owner merges)

1. `git status` clean; branch based on current `origin/main` (rebase or rebuild docs if main moved, e.g. after a data update).
2. Build: `node tools/build.mjs`; if the example, logo or preview texts changed: `node tools/build-og.mjs`, then build again.
3. Unit tests (`npm test`) and all five browser setups (`npx playwright test`), including `e2e/consistency.spec.js`.
4. Texts: if any text changed, `node tools/export-texts.mjs` and list the changed texts for the owner (EN and DE).
5. Counts in README.md and ux/G-quality-report.md match the test totals.
6. Privacy: new outside requests, storage or links? Then the privacy notice (EN, DE, new version date) is updated.
7. Decisions: a new standing decision has a record in `decisions/`.
8. Visual check of what changed, in light and dark mode and at phone width (screenshots for the owner).
9. Tell the owner: what changes for visitors, test results, and the push → pull request → merge steps. After the
   merge, watch the GitHub run until `test` is green and check the live site.
