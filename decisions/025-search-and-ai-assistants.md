# 025 · Search engines and AI assistants: readable without scripts, no lender names, crawlers allowed

Date: 2026-11-12 · Status: in force

## Decision
- **Readable without scripts.** The build writes every page's texts and the example's numbers into the page files. A crawler that runs no scripts reads what a visitor reads. Nothing a visitor sees changes; no number moves.
- **No lender names, also not for search.** Searches that contain a lender's name are not targeted. Decision 002 stays as it is.
- **AI crawlers are allowed**, those that fetch a page to answer a question and those that collect training data. The setting is in Cloudflare (the owner's part); `robots.txt` keeps allowing everyone.
- **"Crypto loan" appears once**, in the page description that search results show (German: "Krypto-Kredit"). The page itself keeps the words of decision 024.
- **Order of work.** First branch: the pre-written texts, a guard that the check page works from its first 2 MB, structured data (JSON-LD), and a summary file for AI assistants (`llms.txt`). Own addresses for the Insights findings and explainer pages are each planned separately afterwards.
- **Left out:** pages aimed at lender names, tax advice pages, paid links.

## Why
On 27 Oct 2026 a crawler without scripts found 19 words on the check page and 9 on Insights; all text was written by the page's script. The crawlers of the large AI assistants run no scripts. At the same time, the AI answers checked said that no source gives the chance that a Bitcoin loan is liquidated, which is what this site computes. Neutrality is the reason such an answer would cite the site, so the lender rule stays. The code is open source already, so allowing training crawlers gives away nothing new. "Crypto loan" is searched about as often as "bitcoin loan".

Google reads only the first 2 MB of a page file and the check page is 2.5 MB, hence the guard.

## How it is measured
Search Console and Bing (impressions, clicks, position), a fixed list of questions asked monthly in AI assistants, and crawler visits in Cloudflare, each against the baseline taken before the build. No on-page tracking; the privacy notice is unchanged (decision 001).

## Sources
Issue #18 (report of 27 Oct 2026); owner 2026-11-12 ("I agree").
