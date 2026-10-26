# Bitcoin Loan Check: instructions for Claude

bitcoinloancheck.com: a free, open-source, independent check for any Bitcoin-backed loan offer. Static pages that
run entirely in the visitor's browser (no backend, no tracking). Live since 21 Oct 2026. This file is the project's
standing instructions: read it first in every session, then the task (a GitHub issue) and the documents it links.

## The owner and how to work with them

- **Not a coder.** Explain in plain language: what changes for the visitor, not how the code does it.
- **Phased approval.** For anything beyond a small fix: plan first, then wait for an explicit "yes". After each phase
  (plan → tests → build → verify), summarise in plain words and ask before continuing. Ask before any big decision.
  Questions the owner already answered are recorded in `decisions/`: do not ask them again.
- **When the owner asks "deeper, not bigger"** (the meta prompt with points 1–4), answer the four points, then
  rewrite their request; build only after "yes".
- **Honest reporting.** Say when a test failed, when something was skipped, when you got something wrong.
- The owner reads on a phone too: lead with the result, then the detail.

## Workflow (one task = one issue = one branch = one session)

1. Start: read this file, the issue, and the decision records it touches. Check `git status` and `git log`
   (the owner sometimes commits or merges between sessions).
2. Branch from an up-to-date `main` (`git fetch origin && git switch -c <short-name> origin/main`,
   then `git branch --unset-upstream`, so GitHub Desktop offers "Publish branch").
3. Plan (skill `plan-feature`) → owner's "yes" → tests → build → verify (see "Done" below).
4. Commit with the repository's own git identity (`boddenlennart`, `217341961+boddenlennart@users.noreply.github.com`,
   already configured) and end every commit message with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only when all tests pass.
5. **The owner pushes (GitHub Desktop), opens the pull request and merges.** Never push, never merge, never
   enable auto-merge. You may read GitHub (API, `gh`) and comment on issues.
6. End: write the handover note (skill `handover`) as a comment on the issue and in the pull-request text.

`main` is protected: changes arrive only through a pull request whose required check `test` passed.

## Done means

- Every fix has a test that would have caught it, and you checked that it fails on the old code (skill `fix-with-test`).
- Unit tests and all five browser setups pass locally (commands below); for page changes, also the numbers check.
- Texts in English and German; `node tools/export-texts.mjs` re-run if any text changed.
- Test counts in `README.md` and `ux/G-quality-report.md` updated when tests were added.
- A decision record in `decisions/` for any new standing decision.

## Commands (tools live inside the project: never install globally)

```
export PATH="$PWD/.tools/node/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/ms-playwright"
node tools/build.mjs                 # build docs/ from src/ (always before browser tests)
node tools/build-og.mjs              # link-preview images (after build; they show the example's answer); then build again
npm test                             # unit tests (vitest); npm run test:fast skips calibration
npx playwright test                  # browser tests: chromium, webkit, firefox, iphone, android (~11 min)
npx playwright test --project=iphone # one setup
node tools/export-texts.mjs          # ux/review/texts-review.md, the owner's reading copy of all texts
node tools/update-golden.mjs         # only when a change of results is intended; review the diff
```
Local preview: `.claude/launch.json` ("page", port 8765). Long runs: run in the background and keep the owner informed.

## Standing rules

**Independence and wording** (`decisions/002`, `ux/H-content-audit.md`)
- No lender is named, ranked, recommended or paid on the site. Input from people at lenders is used only to model
  loans correctly and stays out of the page's examples.
- No advice ("you should"), no market claims or forecasts, no "typical" values without a source.
  Sentences of at most 30 words; German uses "Sie". All text lives in `src/content/text.*.js`.
- "Liquidated" means any forced sale, full or partial (`decisions/005`).

**Numbers** (`ux/P-consistency.md`)
- Two numbers a reader can compare must agree. A number shown is rounded once; numbers next to it are derived from it
  (for example 100 minus the answer), never rounded separately. New numbers get a rule in `e2e/consistency.spec.js`.
- Tests never hard-code results that new data moves; compare with the stored example (`exampleAnswer()` in `e2e/helpers.js`).

**Tests** (`decisions/012`)
- Act like a visitor: real taps, drags and key presses; folded parts opened with `openFolded`; no `dispatchEvent`
  shortcuts. Phone tests carry the `@phone` tag and also run as iPhone and Android.

**Design** (`ux/C-design-spec.md`, `tests/design.test.js`)
- Orange belongs to the Bitcoin logo only, never to a warning or data colour. Status colours: red (liquidated),
  half-filled red (partly), gold/yellow (margin call); they must stay apart for colour-blind eyes. Type scale is fixed.

**Privacy and legal** (`decisions/001`, `decisions/014`)
- No tracking, no cookies, no new outside service without updating the privacy notice first (EN and DE, new version date).

**This repository is public.** Never commit secrets, personal correspondence, names of contacts at lenders,
marketing plans or anything about the owner's book. Those live in the owner's private folder
`~/Documents/BitcoinLoanCheck-private/` and in their Claude Projects.

## Where things are

- `decisions/`: why things are the way they are (read before changing them).
- GitHub Issues: the backlog. Label `next` = scope of the next branch, `later` = parked.
- `ux/`: specifications and reviews (A–P); `ux/J-launch-steps.md` and `ux/O-go-no-go.md` for operations.
- `README.md`: for humans: hosting, the weekly data update, data sources, tests, project structure.
- `.claude/skills/`: recurring workflows: `plan-feature`, `fix-with-test`, `weekly-data-review`, `release-check`, `live-numbers`, `handover`.
- `.github/workflows/`: `tests.yml` (every push and pull request), `update-data.yml` (Mondays 05:17 UTC).
- Weekly data: a pull request "Weekly price data update …" each Monday; check it with `weekly-data-review`,
  the owner merges. If Safari's engine times out while installing, "Re-run failed jobs"; if it keeps happening,
  the issue "GitHub runners: slow browser install" describes the tested fix.
