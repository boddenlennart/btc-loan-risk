---
name: weekly-data-review
description: Review the Monday "Weekly price data update" pull request of Bitcoin Loan Check and tell the owner whether it is safe to merge. Use on Mondays, when the owner mentions the data update, or when an update run failed.
---

# Weekly data review (never merge yourself)

Read-only via the public API (`curl https://api.github.com/repos/boddenlennart/btc-loan-risk/...`) or `gh`.

1. Find the run of "Update price data" and the open pull request "Weekly price data update YYYY-MM-DD".
   If there is no pull request, look for an issue "Price data update failed" and the failed job's annotations
   (`/check-runs/<job id>/annotations`).
2. Check the pull request text: new hours (gaps, duplicates, impossible values: none), Kraken agreement
   (typical difference well below 0.1%), "Nothing unusual" lines, reference-loan table (headline moves ≤ 3 of 100),
   drift guard (largest change below the limit of 5).
3. Check the files changed: only `data/` and `docs/` (pages and `og-*.png`). Anything else: stop and report.
4. Check the commit statuses `test` and "Weekly update: all tests and browser tests" (success). A separate
   "Tests" run on the pull request may also appear; if Safari's engine was cancelled while installing, advise
   "Re-run failed jobs" (see the issue "GitHub runners: slow browser install").
5. Report in a short table: data window, quality, effect on numbers, checks; then "safe to merge" or what is unusual.
6. After the owner merged: remind them that numbers quoted in posts may have moved (skill `live-numbers`).
