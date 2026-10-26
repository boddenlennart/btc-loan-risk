---
name: fix-with-test
description: Fix a bug or flaw in Bitcoin Loan Check the project's way - reproduce it, write the test that would have caught it, prove the test fails on the old code, fix, run everything. Use for every bug report from the owner or a test failure.
---

# Fix with a test

1. **Reproduce first**, the way the visitor saw it (their browser, phone or desktop, their terms; use the share link
   or the owner's screenshot). Say in one sentence what is wrong and why (root cause, not the symptom).
2. **Classify**: page fault, test fault (timing, hard-coded value, shortcut), or data/environment (GitHub runner,
   new week of data). Only page faults change the page.
3. **Write the test that would have caught it**, acting like a visitor (decision 012): real taps/drags/keys,
   `openFolded`, `waitFresh` after typing, `@phone` tag for phone behaviour, `exampleAnswer()` instead of fixed
   numbers. If two numbers disagreed, add a rule to `e2e/consistency.spec.js` (decision 007).
4. **Prove it**: run the new test against the old code (copy the fixed file aside, restore the old one with
   `git show HEAD:<file>`, rebuild, run, restore). It must fail. Report how often it failed.
5. Fix. Rebuild (`node tools/build.mjs`; `node tools/build-og.mjs` and build again if the example or images change).
6. Run the unit tests and all five browser setups. Update test counts in README.md and ux/G-quality-report.md.
7. Tell the owner in plain words: what was wrong, the fix, the test, and that it failed before. Commit when green.
