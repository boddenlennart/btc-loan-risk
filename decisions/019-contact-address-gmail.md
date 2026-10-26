# 019 · Contact address: bitcoinloancheck@gmail.com

Date: 2026-10-26 · Status: in force

## Decision
The feedback e-mail, "Your language is missing?" and the Impressum contact use bitcoinloancheck@gmail.com (`src/content/site.js`). The privacy notice (section 7) names Google Ireland Limited as the mailbox provider, with the USA covered by Google LLC's Data Privacy Framework certification; version date 26 October 2026.

Accepted risk: a free Gmail account comes with no data processing agreement (Art. 28 GDPR), unlike Proton or paid Google Workspace. The owner accepts this small risk for a feedback inbox, in line with the best-practice approach of decision 014.

The old address boddenlennart@proton.me stays open without forwarding; the owner checks it by hand now and then (the site went live on 21 Oct 2026, so few people will have saved it).

## Why
A project address separate from the owner's personal mail; the owner's choice.

## Alternatives considered
Keeping boddenlennart@proton.me (has a processing agreement); Google Workspace with an address on the site's own domain (about 7 euros a month).

## Consequences
Changing the mail provider again means changing section 7 of the privacy notice (EN and DE) and its version date. `tests/content.test.js` checks the provider is named and Proton is gone; `e2e/page.spec.js` checks the address in the language menu. A daily summary of new mails and of the donation address runs on the owner's Mac as a scheduled Claude task, outside this repository.

## Sources
Owner 2026-10-26; issue #16.
