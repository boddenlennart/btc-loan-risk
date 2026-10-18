# Go-live review: UI/UX and functionality

Status: 18 Oct 2026, branch `ux-redesign` (commit e11873d). Checked as a first-time visitor on a 375 px phone and a 1280 px desktop, light and dark, English and German, on all three pages, with every function used at least once (example, own terms, comparison, refinancing, existing loan, buying BTC, share, start over, language, light/dark, feedback, glossary, legal texts). The 64 automatic browser tests and 355 unit tests pass.

## What already works well

- **The check answers first.** On a phone, the number, the dots and the assumption fit the first screen; the example appears at once (0.06–0.24 s).
- **Each page has one job.** Check: "what about my loan?" · Insights: "what happened since 2014?" · How it works: "why trust it?". The content audit removed eight repeats.
- **Fair to lenders and borrowers.** Three methods side by side, no "best" wording, no lender names, the lender checklist, "no offer is marked as better" in the comparison.
- **Trust and privacy.** No server, no tracking, inputs stay in the browser, open code, strict security rule (only the page's own two scripts may run), 0 accessibility issues found by the automatic checker on every page in both colour modes.
- **Robust.** Bad links, blocked storage, offline, failing price services and broken data are handled; 19 of 19 planted bugs are caught by the tests.

## Findings

| # | Where | Finding | Effect on visitors |
|---|---|---|---|
| F1 | Check, comparison, charts, share text | "Liquidation" is not yet used everywhere. Still "Sold at LTV 80%" in the example sentence, "the price at which BTC would be sold" in the subhead and search description, "Sold at" in the comparison table, "✕ = sale", "sold after 5 days" and "no sale" in the crash stories, "BTC is sold at" in the share text. | Two words for one event; the owner decided on "liquidation". |
| F2 | Privacy notice | Still the first draft: names GitHub Pages (the site is on Cloudflare), 11 «placeholders» open, "Copy link to this calculation" is now "Share", the stored light/dark choice is not mentioned, ECB as a data source is missing. | Legally required before going public. |
| F3 | Weekly data update | Scheduled jobs run only on the main branch, and `main` is still empty. Until the launch merge the data never refreshes; the job has not run once on GitHub. | Without the merge, the page would show "data is old" after 45 days. |
| F4 | All charts on phones | Axis labels and chart notes appear at about 6–7 px (the charts are drawn 640 px wide and shrunk to 343 px). | Hard to read; fails the spirit of the 12 px minimum used everywhere else. |
| F5 | Make it safer | One option reads "Liquidation LTV 95%". Few offers allow that, so it suggests something visitors can rarely get. | Can mislead; looks like a recommendation of an unusual term. |
| F6 | Texts | "yearly Price trend values" (capital P mid-sentence, from the glossary link); "-30% a year" uses a hyphen where all other numbers use the minus sign "−". | Small polish. |
| F7 | "Not found" page | Has no Impressum and privacy link. | Small legal and navigation gap. |
| F8 | Link previews | "Insights" and "How it works" use the check page's preview image (their own title and description are already set). | When shared, the preview shows the check's headline. |
| F9 | Phone fixes of today | Keyboard bar, no jumping, light/dark switch: tested in Safari's engine, not yet on a real iPhone. | Unknown until checked on the device. |
| F10 | Comprehension | Nobody outside the project has used the page yet. The biggest open question: is "60 of 100 simulated futures" understood correctly? | The core message could be misread. |
| F11 | Comparison | Insight 7 showed that "cost including the risk" can reverse the order of two offers. The comparison table does not show it. | A strong extra row is missing (optional). |
| F12 | How it works | The audit planned pictures for the four steps and a chart for the test against history; both are text only. | Less convincing for non-experts (optional). |

## Before go-live (MoSCoW)

### Must have (no launch without)

| # | What | Who | Effort |
|---|---|---|---|
| M1 | "Liquidation" everywhere the event is named (F1), English and German | me | small |
| M2 | Privacy notice rewritten: Cloudflare (Pages, DNS, network, logs, data-processing agreement, US transfer / Data Privacy Framework), ECB, price services, browser storage (inputs, language, light/dark), share link, feedback e-mail; all placeholders filled (F2) | me (draft), you (details, approval) | medium |
| M3 | German/EU legal check of Impressum, privacy notice, the "not advice" wording, the Insights page, browser storage under § 25 TDDDG, and how easily the Impressum can be reached (it sits folded in the footer) | you, ideally with a lawyer | outside |
| M4 | Launch mechanics: pull request `ux-redesign` → `main` (you merge), Cloudflare builds from `main`, custom domain bitcoinloancheck.com with www redirect and HTTPS, then start the weekly data job once by hand and check that its pull request appears (F3) | me (steps), you (clicks) | small |
| M5 | Real-iPhone check of today's fixes (keyboard, no jumping, light/dark) and the time to the first full answer on an older phone (F9) | you, 15 minutes | small |
| M6 | Confirm the feedback mailbox receives mail and the donation address is in a wallet you control (show it in the wallet's receive screen) | you | small |

### Should have (strongly advised before launch)

| # | What | Who | Effort |
|---|---|---|---|
| S1 | Readable charts on phones: labels at 12 px or more (F4) | me | small–medium |
| S2 | "Make it safer": a realistic higher liquidation LTV, +10 points, at most 90% (F5); the same in the comparison of levers on Insights | me | small |
| S3 | Text polish (F6) and Impressum/privacy links on the "not found" page (F7) | me | small |
| S4 | A short test with 3–5 people from the target group (ux/E-test-plan.md, round 1: 15 minutes each, mainly "what does the big number mean?") (F10) | you | 1–2 evenings |
| S5 | Cloudflare settings for the custom domain: "Always use HTTPS" and HSTS; check that the security headers arrive on the real domain | you (clicks), me (check) | small |

### Could have (after launch is fine)

| # | What | Effort |
|---|---|---|
| C1 | "Cost including the risk" as an extra row in the comparison table (F11) | medium |
| C2 | Pictures for the four steps and the test-against-history chart on "How it works" (F12) | medium |
| C3 | Own link-preview images for Insights and How it works (F8) | small |
| C4 | Insights also in euros (now US dollars, the longest single-exchange history) | small |
| C5 | A manual screen-reader pass (VoiceOver) in addition to the automatic checker | small |
| C6 | An automatic code style checker (linter) | small |

### Won't have (this launch, by decision)

- Lender directory (postponed until after launch, with a legal check)
- More languages (on request, via "Your language is missing?")
- A measuring script (host statistics and feedback only)
- Accounts, a server or saved calculations online

## Suggested order

1. M1, S1, S2, S3 (me, one round, then you review on the preview).
2. M2 privacy notice draft (me) → M3 legal check (you).
3. S4 test with people and M5/M6 checks (you), in parallel with 2.
4. M4 launch mechanics and S5 (together), once 1–3 are done.
