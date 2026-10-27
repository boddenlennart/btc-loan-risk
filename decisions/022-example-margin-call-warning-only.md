# 022 · The example's margin call is only a warning

Date: 2026-10-27 · Status: in force

## Decision
The check page's example keeps its margin call at LTV 70%, but as a warning only: the lender sells only when the liquidation LTV (80%) is reached. Before, the lender sold everything if a margin call was not fixed within 48 hours. The Insights reference loan keeps "margin call at 70% with 48 hours to top up", as its texts say; it was already its own loan (in US dollars). How it works shows what a deadline of 1, 2 or 3 days would do to the example, and a dated note says what changed.

## Why
A review of the published terms of ten lenders and lending protocols (27 Oct 2026; names in the owner's private notes, not here, decision 002) found: selling only at the liquidation level, or having no margin call at all, was the most common structure; a deadline followed by a sale of part of the BTC came next; a deadline followed by closing the whole loan was the rarest. About half the figures came from secondary sources. Apart from that: every loan has a liquidation level, while a sale at the end of a top-up deadline is an extra rule. Without a source for it, the example leaves it off; visitors whose offer has one set it in "What your lender does when BTC falls" (issue #11).

## Alternatives considered
Keep "48 hours, then everything is sold" (the most cautious, but the rarest structure found); "48 hours, then only enough is sold" (an extra rule without a clear majority); a line "if you top up in time: at most N of 100" under the answer (not needed once the example has only a warning).

## Consequences
The example's answer and its cost of the risk fall (52 → 46 of 100 on 27 Oct 2026); numbers quoted from the old example are out of date (skill live-numbers). The top-up assumption line no longer shows for the example. Link previews are rebuilt.

## Sources
Owner 2026-10-27 (option b); research in the session of 27 Oct 2026.
