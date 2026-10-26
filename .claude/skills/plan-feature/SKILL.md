---
name: plan-feature
description: Plan a feature or larger change for Bitcoin Loan Check and present it to the owner for a "yes" before any building. Use at the start of every issue that is more than a small fix.
---

# Plan a feature (then stop and wait)

1. Read the issue, `CLAUDE.md`, the decision records it touches, and the code involved. Check `git status`/`git log`;
   start from current `origin/main` (if `main` lacks something the task needs, say so instead of guessing).
2. Find what is already decided (decisions/, issue text) and do not ask it again.
3. Send the owner one message, plain language, phone-friendly, no long dashes:
   - **Headline:** issue number, one line on what it is, how many decisions you need.
   - **What changes for visitors** (2–4 sentences); which numbers move and which stay.
   - **Your decisions:** numbered, each with your recommendation and one reason; options as (a)/(b).
     A default value shown to visitors needs a source, or it is 0 / off (no "typical" values without a source).
   - **Afterwards:** consequences (numbers moving, correction note, texts in EN/DE, golden file, other issues touched).
   - **Tests first:** which tests you will write and how you will prove they fail on today's code.
   - Close with: "Reply 'yes' plus your answers and I'll write the tests first."
4. Wait. Record the answers as a new decision record if they are standing rules; then follow `fix-with-test`
   discipline for building, and `release-check` before handing over.
