# 009 · Hosting on Cloudflare Pages

Date: 2026-10-17, live 2026-10-21 · Status: in force

## Decision
The built pages in docs/ are committed; Cloudflare Pages serves main at bitcoinloancheck.com (www redirects), with a preview per branch (<branch>.bitcoinloancheck.pages.dev). HTTPS, HSTS (6 months, subdomains), security headers from docs/_headers. Link-preview images carry a content stamp (?v=…) so apps fetch changed images anew.

## Why
Preview links per branch and security headers; GitHub Pages lacked both.

## Alternatives considered
GitHub Pages (original brief).

## Consequences
docs/ must be rebuilt and committed with every change (node tools/build.mjs).

## Sources
README "Publish it with Cloudflare Pages"; ux/J-launch-steps.md; commits 18ed842, 95d33b5.
