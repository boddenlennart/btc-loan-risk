# Launch steps (go-live)

Everything here is done by you, in GitHub Desktop, on github.com and in the Cloudflare dashboard. I cannot push or click there. Do the steps in this order; each one says how to check it worked. Time: about 45 minutes, plus waiting for builds.

## Before you start: your checks (M5, M6, S4)

1. **Real iPhone (15 min).** Push the latest commits, open https://ux-redesign.bitcoinloancheck.pages.dev on your iPhone and check:
   - Tap into "Loan amount": no result bar sits above the keyboard. Type a new amount: the field stays where it is while "Calculating…" floats at the top.
   - Close the keyboard ("Done"): the bar "xx of 100 liquidated · See the answer ↑" appears; tapping "See the answer" scrolls up.
   - The sun/moon button switches light and dark; reload: your choice stays.
   - Time the full answer after changing a number on an older phone (it should settle within a few seconds).
   - Compare two offers, then end the comparison: you choose which offer stays, and a line confirms it.
   - Change a number, close the tab, open the page again: the example is back (nothing kept). Tick "Remember my inputs" under your terms and repeat: your inputs are back.
   - Open "How it works": the sample future, the volatility chart and the tables are readable; "Show the formulas" opens the maths.
2. **Mail and donation (5 min).** Send yourself a test via "Help improve this page" → "Write e-mail" to boddenlennart@proton.me and check it arrives. Open your Bitcoin wallet's receive screen and confirm the address on the page (bc1qvj6c…pj8ld) is one of yours.
3. **Read the new texts (about 1–2 hours).** ux/review/texts-review.md lists every text, numbered, English and German side by side. About 250 are new since your review on 16 Oct (groups "Page: Insights", "Page: How it works", the legal texts, comparison). Note the number of anything unclear or wrong and send me the list.
4. **A short test with 3–5 people (S4, optional but advised).** Use round 1 of ux/E-test-plan.md: 15 minutes each, mainly "In your own words, what does the big number mean?".

## 1. GitHub: settings the weekly update needs

On github.com → repository **btc-loan-risk** → **Settings**:

1. **Actions → General → Workflow permissions:** choose **Read and write permissions** and tick **Allow GitHub Actions to create and approve pull requests**. Save. (The weekly data update opens a pull request; it never merges by itself.)
2. **Pages:** must stay **off** (the site is on Cloudflare).

Check: nothing to see yet; this is used in step 4.

## 2. GitHub: bring the site to `main`

1. In GitHub Desktop: **Push origin** (branch `ux-redesign`).
2. On github.com: a yellow bar offers **Compare & pull request** for `ux-redesign` (otherwise: **Pull requests → New → base: main, compare: ux-redesign**).
3. Title: "Launch: Bitcoin Loan Check". Create the pull request.
4. Wait until the check **"Tests"** shows a green tick (about 10 minutes: all unit and browser tests run on GitHub).
5. **Merge pull request** → **Confirm merge**. Do not delete the branch yet.

Check: on github.com the branch selector shows `main` with the newest commit; Cloudflare starts a production build (dashboard → Workers & Pages → bitcoinloancheck → Deployments: "Production" with the newest commit, status "Success").

## 3. Cloudflare: your domain

In the Cloudflare dashboard → **Workers & Pages** → **bitcoinloancheck** → **Custom domains**:

1. **Set up a custom domain** → `bitcoinloancheck.com` → Continue → **Activate domain**. Cloudflare adds the DNS record itself (the domain is managed in your Cloudflare account). Wait until the status is **Active** (usually a few minutes; the certificate can take up to 30 minutes).
2. Repeat for `www.bitcoinloancheck.com`.
3. **Redirect www to the main address:** dashboard → choose the domain **bitcoinloancheck.com** → **Rules → Redirect Rules → Create rule → from template "Redirect from WWW to root"**. Keep "301" and "Preserve query string". Deploy.

Check: https://bitcoinloancheck.com shows the page; https://www.bitcoinloancheck.com/method/ ends up at https://bitcoinloancheck.com/method/; https://bitcoinloancheck.com/de/ starts in German; https://bitcoinloancheck.com/xyz shows "This page does not exist."

## 4. Cloudflare: security settings (S5)

Domain **bitcoinloancheck.com** → **SSL/TLS**:

1. **Overview:** encryption mode **Full (strict)**.
2. **Edge Certificates:** **Always Use HTTPS: On**. **Automatic HTTPS Rewrites: On**.
3. **Edge Certificates → HTTP Strict Transport Security (HSTS) → Enable:** Max Age **6 months**, Apply HSTS to subdomains **On**, Preload **Off** (can be switched on later, once everything has run well for some weeks), No-Sniff header **On**.
4. Do **not** switch on Cloudflare Web Analytics or any "Zaraz"/tracking feature: the privacy notice promises none.

Check: http://bitcoinloancheck.com (without s) switches to https. Then send me the address and I will check the security headers from outside.

## 5. The weekly data update: run it once by hand

GitHub runs scheduled jobs only on `main`, so the weekly update starts working after step 2.

1. github.com → **Actions → Update price data → Run workflow → Branch: main → Run workflow**.
2. After about 15 minutes: a new **pull request** "Weekly price data update …" appears, with a green check mark (all tests ran before it was opened). If something failed, an **issue** appears instead; send it to me.
3. **Merge** that pull request. Cloudflare publishes the refreshed page automatically. From now on, this happens every Monday; your only job is merging the pull request (the README explains what to do if it fails).

Check: the page's small print says "last updated" with today's date.

## 6. After launch

- Keep `ux-redesign` for a week, then delete the branch on github.com (the preview address stops working).
- Feedback arrives at boddenlennart@proton.me; delete feedback mails after twelve months at the latest (the privacy notice promises this).
- If the page ever starts using another service or storing something new: update the privacy notice first (README, "Impressum and privacy notice").
