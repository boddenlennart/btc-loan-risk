---
name: handover
description: Write the end-of-session handover note for Bitcoin Loan Check, so the next session or the owner can continue without this chat. Use at the end of every working session or when the owner pauses.
---

# Handover note

Write it as a comment on the GitHub issue of the task (`gh issue comment <n>`), and put the same summary in the
pull-request text. Keep it under 20 lines, plain language:

- **State:** branch, last commit, pushed or not, pull request number.
- **Done:** what changed for visitors.
- **Tests:** what ran and the result (unit, five browser setups, numbers check); anything skipped and why.
- **Open:** what is left, and what needs the owner's decision (one question each).
- **Next step:** the exact first action for the next session.
- **New decisions:** link the record in `decisions/` if one was added.

Never put personal correspondence, contacts' names or marketing plans in a public issue.
