# Go / no-go for the launch

Status: 20 Oct 2026, release candidate 090d79e (+ 2bd43fa: weekly update reports the `test` check). Checked on the live preview https://ux-redesign.bitcoinloancheck.pages.dev, which runs exactly this build.

## Verdict: not yet. Your launch clicks remain (the code fixes G1–G3 are done, see the update below)

The page, its numbers, security and legal texts are ready. Four blocking criteria still need you: the data update run, the rollback trial, the iPhone and the reading. The check page also misses the speed target we fixed before any design work (A4, D6) on a slow mobile connection; one smaller fix belongs with it.

## Update 20 Oct: G1–G3 fixed

| # | Fix | Measured | Test |
|---|---|---|---|
| G1 | The page's script comes before the 1.7 MB price history; the example answer shows first, everything that needs the history waits for it | Lighthouse, mid-range phone, slow mobile connection, real throttling: answer **2.7 s instead of 10.0 s**, performance **96 instead of 52** (measured locally, uncompressed; the live preview is measured again after the push) | Browser test on a 1.6 Mbit/s connection: the answer shows within 5 s, before the history has arrived, and the first calculation waits for it without errors |
| G2 | How it works and Insights stay invisible until drawn (Insights jumped on a slow phone too) | Lighthouse: layout shift 0 on all pages; How it works performance **97** | The slow-phone test now checks all three pages |
| G3 | The text export for your reading is regenerated (808 texts) | – | A test compares a fresh export with the stored one |
| B3 | Privacy notice: "You are not obliged to provide any data …" (Art. 13(2)(e)); version 20 Oct 2026 | – | Content tests |

**Measured on the live preview after the push (20 Oct, mid-range phone, slow mobile connection, real throttling):**

| Page | Performance | Accessibility | Best practices | First content | Answer / main content | Layout shift |
|---|---|---|---|---|---|---|
| Check (EN, DE) | **98–99** | 100 | 96 | 1.0 s | **1.7 s** | 0 |
| How it works | 100 | 100 | 100 | 0.9 s | 1.4 s | 0 |
| Insights | 100 | 100 | 100 | 0.9 s | 1.3 s | 0 |

The check page's 96 for best practices comes from Bitstamp refusing Lighthouse's repeated automated runs (rate limit; its refusal lacks the permission header). In a normal browser both Bitstamp requests answer 200, the recent hours are added and the console stays empty (checked on the live preview). D6 (≤ 5 s on a mid-range phone) is met.

Note: Lighthouse's default mode estimates timings as if a page could only be drawn once its whole file has arrived, so it still reports about 10 s for the check page. Real browsers draw while the file arrives, which the measurement with real throttling and the browser test show.

## Blocking criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| B1 | Numbers correct | **Go** | 410 unit tests, 261 browser runs green on 090d79e; exact agreement with the Python version; test against history passes |
| B2 | Live security | **Go on the preview**; HSTS and the domain open | Mozilla Observatory **A+** (135, 12/12); SSL Labs **A** on all 4 addresses (A+ needs HSTS: launch step 4); http → https; all security headers; no known vulnerability in any package (`npm audit`: 0); the page ships one library (fflate, MIT) and one font (OFL, licence in `licenses/`); no secrets in the repository |
| B3 | Legal texts | **Go** | Impressum: § 5 DDG and § 18 MStV complete. Privacy notice: GDPR Art. 13 complete; every outside service the page contacts is named (Cloudflare, Bitstamp, Coinbase, Proton, GitHub links); browser storage under § 25 TDDDG. Accepted risks (yours, 18 Oct): the c/o address of an Impressum service, e-mail as the only fast contact. One small addition: Art. 13(2)(e) asks whether visitors must provide data; one sentence could say "you are not obliged; without the IP address the page cannot be delivered" |
| B4 | Data fresh, update works | **Open (you)** | Data through 15 Oct (5 days old today). The weekly update has never run on GitHub: run it once after the merge (launch step 5); it must open a pull request with the `test` check and e-mail you. The 45-day page warning is tested |
| B5 | Rollback possible | **Open (you)** | Steps below; try once after the launch |
| B6 | Real phone | **Open (you)** | `ux/uat/iphone-voiceover-checklist.md` |
| B7 | Wording | **Go (automatic), open (you)** | Advice and market-claim checks green. Your reading: the export `ux/review/texts-review.md` is out of date and must be regenerated first (finding G3) |

## New findings of this review

| # | Finding | Severity | Proposed fix |
|---|---|---|---|
| G1 | **The check page needs about 10 s on a slow mobile connection** (Lighthouse, mid-range phone: first content 9.3 s, answer 10.2 s; performance 55). The agreed launch criterion D6 is ≤ 5 s. Cause: the page carries the price history (1.7 MB transferred; Insights, without it, 114 KB, 1.8 s). | 3 (agreed launch gate) | Put the price history after the page's own script: the example answer (precomputed) shows as soon as the first part arrives, and the history follows for the first recalculation. Expected: answer within 2–3 s on the same connection. Medium effort, with a test. |
| G2 | **How it works shifts its layout on opening** (Lighthouse CLS 0.79; the check page was fixed yesterday, this page not) | 2 | The same fix: invisible until drawn, plus the test at 6× slowdown for this page |
| G3 | **The text export for your reading is out of date** | 2 | Regenerate it (one command) before you read |
| G4 | Bitstamp refused one request for the recent hours from Lighthouse's automated browser (its bot protection answers without the permission header). Plain requests work; the page falls back to the stored history silently. | 1 (note) | None; watch the feedback |
| G5 | Search engines: the preview says "noindex" (Cloudflare does this for previews, correctly). On the real domain this must be absent | – | Launch-day check |

## Non-blocking

| # | Criterion | Status |
|---|---|---|
| N1 | Lighthouse on the live preview, phone | Accessibility **100** on all pages; best practices 96–100; performance: Insights 98, How it works 76 (G2), check page 55 (G1); SEO 58 only because of the preview's noindex (G5) |
| N2 | Link previews | Title, description, image (1200 px, EN and DE), language alternates, robots.txt and sitemap correct on all six pages. The images point to bitcoinloancheck.com: check with the debuggers on launch day |
| N3 | Uptime monitor | Steps below; launch day |
| N4 | User test, outside review | After launch (`ux/uat/`) |
| N5 | Open items in ux/A–N | Mapped below |
| N6 | "No liquidation during the term", quant review | After launch (`ux/J-launch-steps.md`) |
| N7 | E-mail notifications, protected `main` | Done by you (19/20 Oct); confirmed by the first update run |

## Open items from the earlier reports (N5)

| From | Item | Now |
|---|---|---|
| A4 D5 | No sideways scrolling at 320 px | Done and tested (UAT finding 11) |
| A4 D6 | First answer ≤ 5 s on a mid-range phone | **Open: G1** |
| I F9, L C4, I C5 | Real iPhone, VoiceOver | Your launch step (B6) |
| I F10, I S4, A2 | Comprehension by outsiders | After launch: user test and feedback checkpoints (A2 section 5: after 15 e-mails or 6 weeks) |
| I S5 | HSTS and headers on the real domain | Launch step 4, then my check |
| L S6 | Your reading of the texts | B7 (after G3) |
| I C1 / L C1 | Cost including the risk in the comparison | Done (M) |
| I C3 / L C3 | Own preview images for Insights and How it works | After launch (they use the main images now) |
| I C4 / L C2 | Insights also in euros | After launch |
| I C2 | More pictures on How it works | Partly done (worked future, option view); rest after launch |
| I C6 | Code style checker | After launch |
| L C5, K | Outside quant review | After launch (reviewer brief prepared) |
| I Won't | Lender directory, more languages, accounts, measuring script | Not this launch, by decision |
| Legal | c/o address, e-mail as only fast contact | Accepted by you (18 Oct) |

## Pre-mortem: five ways the launch could cause harm

| # | It went wrong because … | Already in place | To add |
|---|---|---|---|
| 1 | **A number was wrong**, and someone took a loan relying on it | Independent Python version, known-answer tests, test against history, properties on random loans, every number agrees everywhere | The correction plan below |
| 2 | **The data went stale** unnoticed for weeks | Weekly update with tests, e-mail on success and failure, page warning after 45 days | Your first update run (B4) |
| 3 | **A text was read as advice** or as a judgement of a lender | Automatic wording checks, no lender names, "No offer is marked as better", disclaimer | Your reading (B7) |
| 4 | **The site was down or changed** without you noticing | Cloudflare, tests before every change to `main` | Uptime monitor (N3), rollback (B5) |
| 5 | **A visitor's privacy** was affected | No accounts, no cookies, no tracking, inputs never leave the device, strict security policy, privacy notice | Update the notice before any new outside service |

### If a published number turns out to be wrong

1. Fix it on a branch, with a test that reproduces the error; merge (tests must pass).
2. Add a dated line to How it works ("Correction on …: what changed, by how much, for which loans").
3. If the error was larger than the page's stated precision (about ±1 point), add a short note at the top of the check page for four weeks.
4. Reply to feedback e-mails that reported it.

## Rollback (two minutes)

Cloudflare dashboard → **Workers & Pages** → **bitcoinloancheck** → **Deployments** → the previous production deployment → **⋯** → **Rollback to this deployment** → confirm. The previous version is live within seconds. Afterwards, fix the cause on GitHub; the next merge deploys normally. Try it once after the launch, then roll forward again.

## Uptime monitor (launch day, ten minutes)

A free monitor that checks every 5 minutes and e-mails you: for example UptimeRobot or Better Stack (free plans). Add one HTTP(S) monitor for https://bitcoinloancheck.com/ with the keyword "Bitcoin Loan Check" (so a broken page also counts as down), alert by e-mail.

## Launch day and the first week

**Launch day (you, then me):**
1. Merge `ux-redesign` into `main` (the `test` check must be green).
2. Set the domain and HTTPS/HSTS in Cloudflare (launch steps 3–4).
3. I check the real domain: headers, HSTS, no "noindex", SSL Labs A+, Observatory, Lighthouse, link previews.
4. Run the weekly update once by hand (launch step 5): a pull request with the `test` check, and an e-mail.
5. Set up the uptime monitor.

**First week:** read every feedback e-mail; look at Cloudflare's statistics once (visits, errors); merge the first weekly update; try the rollback once.

## Your clicks, in order

1. Approve G1–G3 (I fix them; you push).
2. Read the regenerated texts (B7) and do the iPhone check (B6).
3. Launch day: steps 1–5 above.
4. First week: rollback trial (B5), first weekly merge.
