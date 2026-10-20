# Bitcoin Loan Check

**An independent check for any Bitcoin loan offer** (bitcoinloancheck.com; German: Bitcoin-Kredit-Check at `/de/`). A small site of three pages that helps you judge a bitcoin-backed loan: **Check a loan** (`/`), **Insights** (`/insights/`, 11 findings on what happened to loans since 2014, computed at every build on the real US-dollar history by `src/insights/compute.js`, so the weekly update refreshes them) and **How it works** (`/method/`). The check estimates:

- the **chance that the loan gets liquidated** before it ends (your BTC sold by the lender), and
- what the loan **costs compared with selling BTC** instead.

You enter the terms from your own offer, in EUR, USD, CHF, GBP, CAD, AUD, CZK or PLN. The page has no lender presets and no lender names. It is **not financial, investment or tax advice**. Your lender's own figures always win over this page.

Everything runs in your browser. There is no server, no tracking and no cookies. The only network requests are public price lookups (see [Data sources](#data-sources)). Nothing you type is sent anywhere.

---

## Open the page on your computer

Each finished page is one file per language: [`docs/index.html`](docs/index.html) (the check, English), [`docs/de/index.html`](docs/de/index.html) (German), and the same under `docs/insights/` and `docs/method/`. Header, footer and styles are shared (`src/app/partials/`, `src/app/shell.js`, `src/app/style.css`).

1. Download or clone this repository.
2. Double-click `docs/index.html`. It opens in your browser and works offline (with the stored price history). The language button switches to German.

If your browser refuses to start the background calculation from a local file, the page does the calculation directly instead. The page may then pause for a few seconds while it calculates.

## Publish it with Cloudflare Pages

The page is hosted by **Cloudflare Pages**; GitHub only stores the code, runs the tests and the weekly data update. GitHub Pages is not used (leave it switched off). Cloudflare publishes the `docs/` folder of the `main` branch, and makes a **preview address for every other branch and pull request**, so a change can be tried on a phone before it goes live.

One-time setup (the Cloudflare screens may be worded slightly differently):

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
2. Allow Cloudflare to read **only this repository** (`btc-loan-risk`) on GitHub.
3. Build settings:
   - Project name: `bitcoinloancheck`
   - Production branch: `main`
   - Framework preset: **None**; build command: **empty** (the page is already built and committed)
   - Build output directory: **`docs`**
4. **Save and Deploy.** The live address is `https://bitcoinloancheck.pages.dev` until the domain is connected (below).
5. Previews: each branch gets `https://<branch>.bitcoinloancheck.pages.dev`, for example `https://ux-redesign.bitcoinloancheck.pages.dev`. Each pull request gets its own link in a comment by Cloudflare. Preview addresses are not secret, but nobody can guess them, and Cloudflare tells search engines not to list them.
6. Do **not** switch on Cloudflare Web Analytics: the page promises no tracking.

## Hosting and privacy

- **Everything is self-hosted inside the page files**: styles, scripts, the price history, the exchange rates, the icon and the font. The serif font (Source Serif 4, [SIL Open Font License](licenses/OFL-source-serif-4.txt)) is embedded in the page; body text uses the device's own system font. No CDN, no Google Fonts, no analytics. A Content Security Policy in the page blocks any other outside request and lets only the page's own script run (identified by its SHA-256 fingerprint, computed at every build); `tests/hosting.test.js` checks all six built files ("Insights" and "How it works" may contact no outside address at all), and a browser test confirms that a smuggled-in script is refused.
- **The only outside requests** are made by the visitor's browser when the page opens (chosen: automatic on load):
  - current price and recent hourly prices: `www.bitstamp.net` (Bitstamp, EU); only if Bitstamp does not answer, the current price from `api.coinbase.com` (Coinbase, certified under the EU-US Data Privacy Framework). Other currencies use the euro price × the latest ECB rate. Fewer services means fewer recipients of the visitor's IP address (data minimisation, decided 18 Oct 2026).

  They carry no cookies, no referrer and nothing the visitor typed. The privacy notice names both services.
- **Browser storage, privacy by default:** the visitor's inputs are kept in this tab's **session storage** (`btc-loan-risk:form`; a reload keeps them, closing the tab deletes them). Only if the visitor ticks "Remember my inputs in this browser for my next visit" are they kept in **local storage** (`btc-loan-risk:remember`, `btc-loan-risk:form`). A chosen language or light/dark mode is kept in local storage (`btc-loan-risk:lang`, `btc-loan-risk:theme`). "Start over and forget my inputs" deletes all of it, ends any comparison and shows the example again.

### Impressum and privacy notice

Both are complete (18 Oct 2026, written by best practice, without a lawyer, at the owner's choice) in `src/content/text.de.js` and `src/content/text.en.js` under `legal:`. The German version is the original. Update them whenever the page starts contacting another service, stores something new in the browser, or the contact details change; a test checks that no «placeholder» is left and that the privacy notice names every outside service.

Known open points, accepted by the owner: the Impressum gives e-mail as the only fast contact (case law asks for a second quick way, such as a phone number or a contact form, at least on request); the address is a c/o service address.

### Connect your own domain (bitcoinloancheck.com)

The domain is registered at Cloudflare and its DNS is managed there, so Cloudflare sets up the records itself.

1. Already done: the domain is **verified on GitHub** (Settings → Pages → Verified domains; keep the TXT record `_github-pages-challenge-boddenlennart`). This stops anyone from attaching the domain to another GitHub page.
2. Already done: two **no-mail records** (the domain sends no e-mail): TXT `@` = `v=spf1 -all`, TXT `_dmarc` = `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s`.
3. At launch, in the Pages project: **Custom domains → Set up a custom domain →** `bitcoinloancheck.com`. Cloudflare adds the DNS record and the certificate (lock symbol) by itself; this takes a few minutes.
4. Add `www.bitcoinloancheck.com` the same way, then a **redirect rule** (Rules → Redirect Rules) from `www.bitcoinloancheck.com/*` to `https://bitcoinloancheck.com/$1` (status 301), so there is one address.
5. **Test:** open `https://bitcoinloancheck.com`, `https://bitcoinloancheck.com/de/` and `https://www.bitcoinloancheck.com`. All show the page with a lock symbol.
6. Account safety: two-factor login on the Cloudflare account, DNSSEC on, automatic domain renewal on.

## Rebuild after changes

You need the tools only to change the page, not to use it. They are installed inside the project folder (`.tools/`, `node_modules/`, not committed).

```bash
npm install                                  # test and build tools
python3 tools/fetch_history.py usd           # download USD price history (a few minutes)
python3 tools/fetch_history.py eur           # download EUR price history (slow: a few hours)
node tools/build-data.mjs                    # compress the history into data/
node tools/update-fx.mjs                     # refresh the ECB exchange rates in data/fx-ecb.csv
node tools/check-fx.mjs                      # compare the converted prices with real exchange prices
node tools/build.mjs                         # write the three pages in both languages (docs/…/index.html)
node tools/build-og.mjs                      # link-preview images and icons (only when name, headline or logo change)
npm test                                     # run all automated tests
npm run test:e2e                             # test the finished page in Chrome's, Safari's and Firefox's engine (first: npx playwright install chromium webkit firefox)
node tools/coverage-e2e.mjs                  # which page code the browser tests run
node tools/mutation-check.mjs                # plant 19 bugs one by one; the tests must catch each (~10 min)
```

**All page text** (German and English) is in [`src/content/text.de.js`](src/content/text.de.js) and [`src/content/text.en.js`](src/content/text.en.js). You can edit wording there without touching any calculation. The example values in the form are in [`src/content/examples.js`](src/content/examples.js).

---

## How to update and check the data

The page contains BTC price history up to a fixed date. A scheduled **GitHub Action** keeps it current. It does all the work, but **it never changes the published page by itself**: it proposes a change, and you approve it with one click.

### What happens every Monday (automatically)

1. GitHub runs the workflow **"Update price data"** (`.github/workflows/update-data.yml`).
2. It downloads the new hourly prices since the last update from **Bitstamp** (main source) and **Kraken** (second opinion).
3. It checks them:
   - no missing hours, no duplicates
   - no impossible values (zero, negative, low above high, more than a doubling or halving within one hour)
   - both exchanges agree: in a typical hour they differ by about 0.01%; the check fails above 0.5% typical, above 2% for more than 1 hour in 100, or above 5% in any single hour
4. It refreshes the **European Central Bank's exchange rates** (for CHF, GBP, CAD, AUD, CZK, PLN) and checks them: no gaps over 7 days, no impossible values, no day-to-day move over 10% (except the known 2015 franc event), earlier days unchanged. It compares the converted BTC prices with real exchange prices (Kraken, Bitstamp); the check fails above 0.5% in a typical hour or 2% in 95 of 100 hours.
5. It adds the hours, re-fits the model settings and rebuilds both language pages. Then it runs the **full regression**:
   - all 316 automated tests, among them:
     - the 12 reference loans on frozen history, which must match the stored results exactly
     - the same 12 loans on the newest data, where every result must be valid
     - the test against history
   - **the 91 browser tests of the finished pages, in Chrome's, Safari's and Firefox's engine**
   - the **drift guard**: if the new hours move the result of any reference loan by more than 5 of 100, the update stops and you get an issue instead of a pull request.
6. It opens a **pull request** called "Weekly price data update [date]". The description says, in plain words:
   - old and new end date
   - whether the exchanges agreed
   - any hours to look at
   - how the result for a reference loan changed

### When the tests run

- **Weekly update:** inside the workflow, after the new data is added and **before** the pull request is opened: all tests, the browser tests and the drift guard. Only if everything passes does a pull request appear, with a green check mark linking to that run. Pull requests opened by a workflow don't start other checks on their own (a GitHub rule), which is why the workflow attaches its result to the pull request itself.
- **Every other change** (your own pushes, edits on the GitHub website, normal pull requests): the workflow **"Tests"** (`.github/workflows/tests.yml`) runs all tests and the browser tests.
- **On your computer:** `npm test` and `npm run test:e2e`.

### How you are notified

The pull request is **assigned to you and asks for your review**. GitHub always notifies you about that: by e-mail and with the bell icon on github.com, whatever your "watch" settings. A failed run opens (or comments on) an issue that is also assigned to you.

### What you do (about 2 minutes a week, or once a month)

1. On GitHub, open the **Pull requests** tab and click the newest "Weekly price data update".
2. Read the summary. Check that:
   - the end date moved forward,
   - there is no "Please look at these hours" (if there is, see below),
   - the reference loan moved by 3 of 100 or less.
3. The pull request shows a green check mark **"Weekly update: all tests and browser tests"**. The tests already ran *before* the pull request was opened: if any test fails, there is no pull request, only an issue. The check mark links to the full test run.
4. Click **Merge pull request**, then **Confirm merge**. Cloudflare Pages republishes the page within a few minutes. (Before merging you can open the pull request's preview link from Cloudflare's comment.)

If you skip a week, that's fine. The next update contains both weeks and closes the older pull request by itself.

**"Please look at these hours":** an hourly low was more than 10% apart between the two exchanges. That is often a real, very short crash on one exchange, exactly the kind of moment that triggers liquidations. Look the hour up on both exchanges' charts. If it looks like an error (one exchange only, no trading volume, recovered within the hour), don't merge and tell me. Otherwise merge.

### If the update fails

- GitHub opens an **issue** called "Price data update failed", assigned to you, and GitHub's notification e-mail tells you. Check under GitHub → Settings → Notifications → "Actions" that you receive these e-mails.
- Read the issue: it says which check failed.
- Often it's a temporary problem with an exchange's API. Click **Actions → Update price data → Run workflow** to try again a day later.
- If the same check keeps failing, an exchange may have changed something. Nothing on the page changes until a run passes. The page itself warns visitors once the data is more than 45 days old.

### Run it by hand

- On GitHub: **Actions → Update price data → Run workflow**.
- On your computer: `node tools/update-data.mjs`, then `node tools/build.mjs` and `npm test`.

### One-time setup on GitHub (before the first run)

1. **Settings → Actions → General → Workflow permissions:** choose **"Read and write permissions"** and tick **"Allow GitHub Actions to create and approve pull requests"**. Without this, the workflow cannot open its pull request. It still never merges by itself.
2. **Settings → Notifications** (your account): make sure e-mails for **Actions** and **Issues** are switched on.
3. Optional: **Settings → Branches →** add a rule for `main` that requires a pull request. That way nothing reaches the page without your click, not even by mistake.

### The 60-day rule (important)

In a public repository, **GitHub switches off scheduled workflows after 60 days without activity in the repository**. Commits to the repository count as activity, and merging the weekly pull request is one. If nothing is merged or changed for 60 days, the Monday update stops silently. GitHub e-mails a warning shortly before.

- **To prevent it:** merge an update at least every few weeks.
- **To restart it:** **Actions → Update price data → "Enable workflow"**, then **Run workflow** once.
- **The safety net:** the page shows the period of the price data and the date of the last update under the answer (for example "Price data: 1 Jan 2014 to 15 Oct 2026 · last updated 15 Oct 2026"), and a red warning when the stored history is more than **45 days** old, so a stopped update is noticed before visitors are misled.

### Yearly review checklist

Once a year (for example in January):

- [ ] **Sources:** Bitstamp and Kraken still publish hourly candles via the same public APIs, and their terms still allow this use. If not, choose new sources and update `tools/update-data.mjs`, the privacy notice and the README.
- [ ] **Full re-download:** run `python3 tools/fetch_history.py usd` and `eur`, then `npm test`. The data test compares the embedded history with a fresh raw download to the cent; any difference shows an error or a later correction by an exchange.
- [ ] **Known data issues** (`tests/fixtures/data-known-issues.json`): new extreme hours or exchange outages reviewed and noted.
- [ ] **History test:** the calibration results in the test output are still within the limits (README → "Calibration results"). If they get close, discuss whether the default "no trend" assumption still holds.
- [ ] **Cross-check limits:** look at the typical differences reported in the year's pull requests. If they rose (for example, a thinner market), consider whether the 0.5% / 2% / 5% limits still fit.
- [ ] **Live price sources:** the four price services still answer from a web page (README → "Live-price check"); update the privacy notice if a service changed.
- [ ] **Privacy notice and Impressum:** still correct (address, e-mail, services named, legal basis); date updated.
- [ ] **Tools:** run `npm outdated` and update the build and test tools; check that GitHub has not announced the end of `actions/checkout@v4` or `actions/setup-node@v4`.
- [ ] **Feedback:** go through the year's feedback e-mails against the success criteria in `ux/A4-success-criteria.md`.
- [ ] **Custom domain** (if any): renewed, HTTPS still on.

---

## How the page works

| Method | What it does | File |
|---|---|---|
| Historical replay | Starts the same loan on every day since 2014 and checks the real **hourly lowest price** (candle low) against the liquidation price. | `src/engine/replay.js` |
| Monte Carlo, block bootstrap | Builds 10,000 possible future price paths by gluing together random 30-day blocks of real daily price moves (including each day's low). | `src/engine/montecarlo.js` |
| Monte Carlo, GARCH(1,1) with Student-t errors | Second simulation with a model in which wild days cluster and large moves are more frequent. Cross-check for the bootstrap. | `src/engine/garch.js` |
| Textbook barrier formula | Closed-form chance that a geometric Brownian motion touches the liquidation price. Sanity check only. | `src/engine/barrier.js` |
| Loan arithmetic | Payment plan, interest, APR (XIRR), collateral, trigger prices, top-up, cost of liquidation, breakeven. | `src/engine/loan.js` |
| Lender rules | What the lender does when BTC falls: margin call as a warning only, top-up deadline with full or partial sale, automatic partial sale, full or partial sale at the liquidation LTV, fees, a cash reserve. **One implementation used by both the replay and the simulations.** | `src/engine/lender.js` |
| Result counted in BTC | For "buy more BTC": BTC held at the end compared with not borrowing, in every simulated future. | `src/engine/montecarlo.js` |

All simulations run in a background Web Worker. The GARCH model is fitted once when the page is built (it was the slowest step in the browser).

### What the visitor sees (UX redesign and review, see `ux/`)

Design and reasons: [ux/C-design-spec.md](ux/C-design-spec.md) (look, layout, logo), [ux/D-share-preview.md](ux/D-share-preview.md) (link previews), [ux/E-test-plan.md](ux/E-test-plan.md) (tests with people). Screenshots: [phone, light](ux/redesign/phone-light.jpg), [phone, dark](ux/redesign/phone-dark.jpg).

- **First screen:** the name, the headline "An independent check for any Bitcoin loan offer", a trust line (runs only in your browser · no tracking · open source), and the answer. A first-time visitor sees an example answer at once: the build computes it in advance.
- **The answer:** one large number ("60 of 100 simulated futures end with this loan liquidated within 12 months"), 100 dots, the one change that lowers it most, and key figures: sale price, margin call, full cost, break-even. The number is in ink, not red: the page checks terms, it does not warn against loans.
- **Your terms:** folded into a short summary on phones ("Change" opens the form), a side panel on desktop. On phones, while the terms are open, a bar at the bottom shows the answer and the number before the last change ("40 of 100 liquidated (was 60) · See the answer ↑").
- **Reading the answer:** the assumption behind it (no top-up after a margin call), what a sale leaves you ("you get back about 0.04 of your 0.27 BTC"), the other two methods in the small print, and a plain break-even tile ("Beats selling if BTC +11% by the end"). The slider says what it changed, with Undo.
- **Compare offers:** "+ Compare an offer" puts up to three offers side by side (liquidated of 100, sale price, full cost, cash received; margin call on wide screens). No offer is marked as better. All offers run on the same simulated futures, so differences come only from the terms; the answer below follows the selected offer.
- **Refinancing:** for "a loan I already have", "+ Compare with a refinancing offer" asks one question (same amount, borrow more, or take back BTC), copies the current terms and adds switching costs. Both loans are compared over the same months, plus the whole new term, cash received now and full cost. Not modelled, but listed as questions to ask a lender: how the transfer between lenders works and how long the BTC is in transit.
- **Make it safer:** an LTV slider and the effect of each other option, on the same simulated futures as the answer (so "your terms" equals the headline exactly).
- **Does the price trend matter?** In "Your loan in every crash since 2014": the loan at five fixed yearly trends (−30%, none, +20%, +50%, +100%), and why the page assumes none.
- **Sections, closed by default:** what happens when BTC falls; costs and borrow-or-sell / is the leverage worth it; your loan in every crash since 2014; how these numbers are made; what this does not include; feedback.
- **Also:** "a loan I already have", entering BTC instead of the LTV, eight currencies, Share (system share sheet on phones with a short summary; link and summary copied elsewhere), a feedback e-mail built in the visitor's own mail app with an optional language question, "Your language is missing?", a donation box with a QR code, and the maker line in the footer.

### Assumptions (all visible and editable on the page)

- **Debt** for the LTV = loan plus interest owed but not yet paid, growing day by day. So the liquidation price rises over time if interest is added to the loan.
- **Interest** per month = balance × yearly rate ÷ 12 (preset). It can also be actual days ÷ 365 or ÷ 360. Each month's interest is rounded to the cent.
- **Assumed price trend** = 0% a year (preset). The models remove the strong past upward trend of BTC. With the past trend kept, the calibration test (below) showed the models were too optimistic.
- **Margin call**: only a warning; top up within the cure period, otherwise the lender sells everything or only enough to reach the target LTV; or the lender sells part at once. At the liquidation LTV: everything, or only enough. A partial sale repays part of the debt; later interest shrinks in proportion. A cash reserve is added as BTC at the first margin call.
- **Breakeven**: assumes you repay the loan by selling BTC at the end, with the tax rates you enter for "now" and "at the end".
- The page checks the **lowest price of every hour on one exchange**. Your lender may measure the price differently (another exchange, an index, an average). The page explains this to visitors.

### What the page does not capture

Model risk (the future can be wilder than the past), lender failure, custody and [rehypothecation](https://en.wikipedia.org/wiki/Rehypothecation) risk, sudden price gaps through the liquidation price, and the lender's own way of measuring the price. The page says so next to the headline number.

---

## Data sources

| Data | Source | Notes |
|---|---|---|
| BTC/USD hourly candles, 2014 to build date | Bitstamp public API (`/api/v2/ohlc/btcusd`) | raw exchange candles |
| BTC/EUR hourly candles, 2014–2016 | Kraken public API (`/0/public/Trades`, pair XBTEUR), every single trade grouped into hourly candles by `tools/fetch_history.py` | Kraken was the larger EUR market then |
| BTC/EUR hourly candles, 2017 to build date | Bitstamp public API (`/api/v2/ohlc/btceur`) | |
| Recent hours after the build date | Bitstamp public API, fetched by the page on load | optional; the page works without it |
| Current price | Bitstamp (close of the latest minute) → Coinbase (first that answers within 4 s); CHF, GBP, CAD, AUD, CZK, PLN: euro price × latest ECB rate | Bitstamp's ticker address does not allow requests from web pages; its minute candles do. Works on the published page and locally; **not** in a private claude.ai test copy, whose host blocks outside requests (the page then uses the stored price and says so) |
| Fallback price | Last close stored in the page | shown with a "not current" warning |
| CHF, GBP, CAD, AUD, CZK, PLN | hourly BTC/EUR × the [European Central Bank's](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/) daily reference rate (`src/data/fx.js`, rates in `data/fx-ecb.csv`); weekends use the last published rate | Checked against real exchange prices on 17 Oct 2026 (`tools/check-fx.mjs`): Kraken CHF/GBP/CAD/AUD, last 30 days: typical difference 0.07–0.13%, 95% of hours within 0.23–0.54%; Bitstamp GBP, 2021–2024: 0.10–0.16%, within 0.38–0.84%. Effect on the answer: the example loan gives 60.0–60.3 of 100 in every currency (EUR 60.0). The weekly update repeats the check (limits 0.5% typical, 2% in 95 of 100 hours). Known real move: 15 Jan 2015, the Swiss National Bank ended its minimum franc rate. |

Prices are stored in cents in a compact compressed format (`src/data/codec.js`, `data/*.bin.gz`). A test checks that they equal the raw downloads to the cent.

**Known data issues** (reviewed by hand, listed in `tests/fixtures/data-known-issues.json`):

- Bitstamp was offline after a hack from 5 to 9 January 2015 (107 hours with a flat price). The replay cannot see prices in those days.
- 14 January 2015, 07:00 UTC: a real hourly drop from 207 to 152 USD (18,263 BTC traded in that hour). Kept.
- 4 November 2015, 21:00 UTC (EUR, Kraken): a real flash crash to 305 EUR after 427.50 (956 separate trades below 350 EUR; the USD market fell sharply in the same hour). Kept.
- EUR source switch from Kraken to Bitstamp at 2017-01-01 00:00 UTC; prices on both sides are within 0.3%.

The exchanges' terms for re-publishing their price data were not reviewed in detail; the project owner accepted this risk.

**Live-price check (CORS).** Checked with `curl -H "Origin: …"` (18 Oct 2026: Bitstamp candles send `access-control-allow-origin: *`; Bitstamp's ticker sends none, so it is not used) and earlier with `fetch()` from the page in a real browser (15 Oct 2026):

| Source | Result in browser |
|---|---|
| Bitstamp candles (hourly and minute) | OK, ~80 ms |
| Coinbase (BTC-EUR, BTC-USD) | OK, ~170 ms |

Public APIs can change their rules at any time; the page then falls back to the next source and finally to the stored price.

---

## Tests and how each was verified

Run with `npm test` (411 tests) and `npm run test:e2e` (91 browser tests, each in Chrome's, Safari's and Firefox's engine). Quality measurements: [ux/G-quality-report.md](ux/G-quality-report.md) (coverage, planted bugs, hostile input, browsers, speed, accessibility, security). Tests 1–9 were written **before** the engine (phase 1) and approved by the project owner; the tests marked UX were added in the UX redesign (phase C).

| # | Test | How it was verified |
|---|---|---|
| 1 | Textbook formula and Monte Carlo agree (`tests/barrier.test.js`) | Simulated GBM paths with 40,000 paths in 4 scenarios must match the formula within 4 standard errors. One formula value was also worked out by hand (0.65623). |
| 2 | Replay of real crashes gives the expected liquidation hour (`tests/replay.test.js`) | Expected hours come from a separate program, `reference/reference_replay.py`, reading the same candles. USD results: Nov 2021 top → liquidated 2022-01-07 03:00 UTC; Dec 2017 top → 2017-12-22 14:00; Feb 2020 → 2020-03-12 10:00; a cautious loan survives March 2020. EUR: 2022-01-07 15:00; 2017-12-22 07:00; 2020-03-12 10:00; the cautious loan survives. These match the known crash dates. |
| 3 | Interest and repayment match a spreadsheet (`tests/loan.test.js`) | `reference/loan-reference.xlsx` uses live formulas (ROUND, PMT, IPMT, FV, EDATE, XIRR) for 12 loan types. An independent formula engine (Python `formulas`) recalculated the spreadsheet, and its results equal the Python reference in all 12 cases. The page must match to the cent. |
| 4 | Out-of-sample calibration (`tests/calibration.test.js`) | For every month from 2016 on, the model only sees earlier prices and predicts the lowest price of the next 90 or 365 days. Reality may fall below the "worst 5%" level at most 10% of the time, and below the "worst 10%" level at most 20%. Results below. |
| 5 | Common-sense rules (`tests/properties.test.js`) | Hundreds of random loans: a higher LTV never lowers the liquidation price; a longer loan never lowers the chance of liquidation (formula, all three simulations, replay); liquidating after an unfixed margin call never lowers it; a reserve never raises it. |
| 6 | Input validation (`tests/validation.test.js`) | 27 kinds of impossible terms must each be rejected with the right code. Each code has a "what is wrong" and a "how to fix it" text in both languages (test 7). |
| 7 | Completeness and wording (`tests/content.test.js`, revised in the UX redesign as approved) | A "?" help text exists at exactly the six agreed places, each with a number example; every input and every result is explained somewhere (help, hint, glossary or its section); glossary entries exist; German and English have the same texts; no sentence over 30 words, average at most 14. A word scan rejects "typical", "usually", "üblich", "meist", "you should", "empfehlen" and similar, and any lender name, unless a `[source: …]` is given. |
| 8 | Plain-language review | Done by the project owner (phase 3). |
| 9 | Real-offer check | Done by the project owner (phase 3); see below. |
| + | Data quality (`tests/data.test.js`) | Embedded data equals the raw downloads to the cent; no gaps over 6 hours, no extreme wicks and no offline periods that were not reviewed by hand. |
| + | GARCH fitting (`tests/garch.test.js`) | Data invented from known GARCH settings; the fit must recover them. |
| Regression | Golden master (`tests/regression.test.js`) | 12 reference loans that together use every main function: all repayment types, fees, variable rate, every margin-call rule, partial sales, reserve, existing loan, buy-more-BTC both ways, five price trends, taxes. On the frozen history (up to 1 Oct 2026, which new data never changes), every result must equal `tests/fixtures/regression-golden.json` to 9 decimal places: payment plans, trigger prices, APR, simulation, GARCH, replay, stories, levers, slider, result in BTC, history facts. **Checked by deliberately breaking the code three times:** a fee off by 1%, 31-day instead of 30-day price stretches, interest 0.01% too high. Each was caught and named. Regenerate with `node tools/update-golden.mjs` only when a change is intended, and say why in the commit. |
| Regression | Newest data (`tests/current-data.test.js`) | The same 12 loans on the full current history: no missing or invalid numbers, chances between 0 and 1, monthly chance never falling, price bands in order, 100 sample paths (five sets of 20), history stories present, lower LTV never clearly riskier, slider in order, buy-more-BTC shares add up, a stronger price trend never clearly riskier. |
| Regression | Finished page in a browser (`e2e/page.spec.js`, Playwright + Chromium) | 23 scenarios:<br>• the page loads without errors, and its answer equals the engine run directly on the same data<br>• the example answer is there the moment the page opens, and the live calculation confirms it<br>• only the named price services are contacted<br>• a lower LTV gives a lower answer; the slider works<br>• impossible terms show the error<br>• German works; the German address /de/ starts in German and the language button switches the address<br>• "a loan I already have", "buy more BTC", the five price trends and "sells part at once" all work<br>• Swiss francs: computed from the converted euro history, close to the euro answer, no new outside addresses<br>• all charts, the QR code, the Impressum and the privacy notice render<br>• the shared link restores the inputs, says it was shared and opens on the answer (phone)<br>• "Make it safer" shows exactly the headline number for your own terms; the best option sits under the answer<br>• compare offers: each column equals that offer's own answer, no winner marked, the shared link brings the comparison back<br>• refinancing: current loan vs. a cash-out offer over the same months; too much extra cash is explained at once<br>• Share copies a summary with the visitor's numbers and the link<br>• the feedback text is correct<br>• first phone screen (375 × 812) holds name, headline, trust line and the answer; the number is in ink, not red<br>• no sideways scrolling at 375 px<br>• offline, the stored price is used with a warning |
| UX | Design rules (`tests/design.test.js`) | Every text colour reaches at least 4.5:1 on page, panel and tile backgrounds, white on buttons 4.5:1, field borders and data marks 3:1, in light and dark mode; only the sizes of the type scale are used; the main number uses the text colour; "nothing happened" is a ring. Accessibility (axe-core): a browser test checks every page in light and dark mode, 0 issues (`e2e/site.spec.js`). |
| UX | Share preview (`tests/share-preview.test.js`) | Both language pages carry language, title, description, canonical and language links, and the preview tags for messengers and X; preview images are 1200 × 630 and under 300 KB; texts fit the platforms' length limits; no tracking parameters. |
| UX | Instant example (`tests/terms.test.js`) | The key that decides whether the example answer computed by the build can be shown does not depend on the BTC price or start date, and changes with every term that changes the answer. |
| UX | Comparing offers and refinancing (`tests/compare.test.js`, `tests/app.test.js`) | Refinancing terms derived from the current loan (same amount, borrow more, take back BTC) and switching costs; on the real history: two identical offers give identical numbers, an offer differing only in fees differs only in cost, each table value equals that offer's own result, and refinancing with the same amount and terms equals the current loan over the same months; the share link carries the comparison and ignores broken ones. Accessibility audit with a comparison open: 0 issues. |
| + | Currencies (`tests/fx.test.js`, `tests/current-data.test.js`) | Reading the ECB file, the rate for each hour (weekends: last published), the conversion, gaps and jumps caught (the 2015 franc event listed as known), the stored rates file passes all checks; on the full history every converted currency gives the example loan within 3 of 100 of the euro answer. |
| + | Data update checks (`tests/candles.test.js`, `tests/workflow.test.js`) | Gaps, duplicates, impossible values, jumps and disagreement between exchanges are caught; a deep low on one exchange is listed for review; the 45-day page warning; the workflow runs weekly, tests before opening a pull request, reports failures, never merges and uses no stored secrets. |
| + | Live price (`tests/liveprice.test.js`) | Fallback order, timeouts, bad answers, stale fallback, and that no user data is in any request (with fake network answers). |
| + | Hosting (`tests/hosting.test.js`) | The built page has no external scripts, styles, fonts or images; every web address in it is one of the named price services (or a plain text link); the Content Security Policy allows exactly those services. The privacy notice must name every service (`tests/content.test.js`). |
| + | Speed-up is exact (`tests/replay.test.js`) | The replay skips quiet days for speed; on 300 random loans (all margin-call rules) it gives exactly the same results as the plain hour-by-hour check. |
| UX | Lender rules, hand-calculated (`tests/replay.test.js`) | Partial sale at the margin call (0.4 BTC sold at 71.43, debt 50 → 21.43), with a 5% fee, after an unfixed margin call, at the liquidation LTV, sell-everything after the deadline: each number worked out by hand. |
| UX | Lender rules on real crashes (`tests/replay.test.js`) | `reference/reference_replay.py` implements the rules a second time, independently, in Python. On 12 real-crash scenarios (USD and EUR) the page gives the same sale hours, BTC amounts and remaining BTC. |
| UX | Simulation uses the same rules; result counted in BTC (`tests/leverage.test.js`) | On a fixed made-up price path: margin call, partial sale, liquidation and the BTC held at the end (e.g. 0.6 + 0.3 − 21.43/100 = 0.6857 BTC) match hand calculations. |
| UX | Share link and feedback e-mail (`tests/app.test.js`) | Inputs round-trip through the link; the BTC price and the private note are left out; the feedback e-mail contains the four answers, version, language and device, and loan terms only when ticked. |
| UX | Donation QR code (`tests/donation.test.js`) | The address passes the Bitcoin checksum (a one-character typo fails); an independent QR reader (jsQR) decodes the code to exactly `bitcoin:` + the address; the built page contains exactly that code. |
| UX | Equal payments near 0% (`tests/loan.test.js`) | Found by the random tests: the textbook payment formula breaks down for rates near 0%. Replaced by a numerically stable form (engine and Python reference); a 0.0000000000025% rate now gives the same plan as 0%. |

### UX success criteria measured on the built page (A4, phase C)

| Criterion | Target | Before | After |
|---|---|---|---|
| C1 Words before the first result | ≤ 300 | ≈ 1,170 (EN) / 1,090 (DE) | **124 / 109** |
| C2 Input fields visible before the first result | ≤ 6 | 23 | **6** |
| C3 "?" buttons visible by default | ≤ 6 | 23 | **3** (6 in total) |
| C4 Answer, dots and slider on the first phone screen | yes | no | **yes** |
| D3 Readability | short sentences | 11 words average | ≤ 14 average, none over 30 (test) |
| D4 Accessibility (axe-core, WCAG 2.2 AA), light + dark, 320 px to desktop | 0 serious/critical | – | **0** (browser test in `e2e/site.spec.js`, every page) |
| D5 Phone layout at 320 px | no sideways scrolling, 44 px targets | – | **passes** (links inside running text excepted, as WCAG allows) |
| D6 First answer on a phone | ≤ 5 s | – | **1–2 s** on the owner's phone (2026-10-16, private test copy) |

### Calibration results (assumed trend 0%)

The simulation (bootstrap) weights recent days more since 19 Oct 2026: a day from three years ago counts half as much as today's (`HALF_LIFE_YEARS` in `src/app/riskjob.js`, `recencyWeights` in `src/engine/history.js`). Reason: BTC's swings have shrunk as the market grew (about 80–90% a year in 2017–2021, 42–52% since 2023). The test cannot decide between weightings (all candidates passed and stayed cautious: half-lives of 1–4 years and equal weights); the choice is a judgement backed by the falling volatility. Example loan: 60 of 100 with equal weights, 53 with the 3-year half-life.

| Currency | Model | Horizon | Below "worst 5%" | Below "worst 10%" | Below median |
|---|---|---|---|---|---|
| USD | bootstrap | 90 days | 2.3% | 6.3% | 32.8% |
| USD | bootstrap | 365 days | 0.0% | 1.7% | 33.6% |
| USD | GARCH | 90 days | 4.7% | 10.9% | 44.5% |
| USD | GARCH | 365 days | 0.0% | 4.2% | 39.5% |
| EUR | bootstrap | 90 days | 3.1% | 5.5% | 35.2% |
| EUR | bootstrap | 365 days | 0.0% | 1.7% | 33.6% |
| EUR | GARCH | 90 days | 5.5% | 10.9% | 46.9% |
| EUR | GARCH | 365 days | 0.0% | 3.4% | 40.3% |

Measured 19 Oct 2026, after the maths audit fixed the random streams per run (ux/K-math-audit.md, F1). The forecasts overlap: the 90-day test holds about 43 independent periods, the 365-day test about 10, so it can catch a clearly optimistic model but cannot prove exact calibration.

Limits: below "worst 5%" at most 10%, below "worst 10%" at most 20%, below median between 20% and 80%. All pass. So the bootstrap model is on the cautious side, and GARCH over 90 days is close to what it promises. With the past trend kept instead of 0%, GARCH over 365 days failed (21.8% below "worst 10%").

---

## Final check: compare with a real offer to the cent

1. Open the page and press **Reset to example values**.
2. Enter every term from your offer: currency, loan amount, start date, duration, LTVs, rate, repayment type, fees. Use the **BTC price your offer names** ("BTC price used" → change).
3. Compare these three numbers with your offer or loan agreement:
   - **Liquidation price** (results, the line under the dots; also in "What happens when BTC falls")
   - **Total interest** and **total you pay back** (section "What it costs"). Open **Show the monthly payment plan** to compare month by month.
4. If something differs, check in this order:
   - **Day count**: under "Expert settings", try "actual days ÷ 365" or "÷ 360".
   - **Rounding**: this page rounds every month's interest to the cent. Some lenders round only the total.
   - **Fees**: is the origination fee taken off the payout, or paid separately? Is it a percentage or a fixed amount?
   - **Liquidation price**: does your lender include unpaid interest in the debt? Which price does it use (see "How your lender measures the price")?
   - **Start date and payment dates**.
5. Write down every difference and its likely cause. Where the lender differs, the lender's number is right.

---

## Project structure

```
docs/index.html          the check, English (built); docs/de/: German; docs/insights/, docs/method/: the other two pages
docs/og-*.png, favicon…  link-preview images and icons (tools/build-og.mjs)
src/engine/              calculations (loan, replay, Monte Carlo, GARCH, barrier, validation)
src/content/             all page text (de, en) and the example values
src/app/                 page layout, charts, worker, styles; shell.js + partials/: header and footer of every page
src/pages/               the "Insights" and "How it works" page layouts
src/insights/            the 11 insights, computed from the real history at build time
src/live/price.js        live price fallback chain
src/data/codec.js        compact price-history format
src/data/fx.js           ECB exchange rates and the converted currencies
src/app/terms.js         form → loan terms (shared by page and build)
licenses/                licence of the embedded font (SIL Open Font License)
data/                    compressed price history, meta.json, fx-ecb.csv (data/raw/ is not committed)
reference/               independent Python reference + spreadsheet
tests/                   automated tests and their fixtures (incl. regression golden file)
e2e/                     browser tests of the finished pages (page.spec.js: the check; site.spec.js: navigation, other pages, accessibility)
tools/                   download, weekly data update, data build, page build, audit copy, local preview server
.github/workflows/       the weekly data-update workflow
ux/                      UX redesign and review: decisions, profiles, critique, design spec, share preview, test plan, sketches, screenshots
```

No keys or secrets are needed or stored. All APIs used are public.

---

## Licence

[MIT](LICENSE). The software is provided **"as is", without warranty of any kind**; the page footer says so too. The BTC price history in `data/` and inside `docs/index.html` comes from the public APIs of the exchanges Bitstamp and Kraken and is not covered by the MIT licence. The exchange rates come from the European Central Bank (free to use with the source named). The embedded font Source Serif 4 is under the [SIL Open Font License 1.1](licenses/OFL-source-serif-4.txt).

## Repository check before the first push (2026-10-15)

Scanned: all tracked files and the full history of all branches (`git log --all -p`), plus the reference spreadsheet's metadata. Patterns searched:
- private key blocks
- AWS, GitHub, OpenAI/Anthropic, Slack and Google keys
- JWTs
- password, secret and token assignments
- Bitcoin private keys (WIF) and extended private keys (xprv)
- German IBANs and phone numbers
- e-mail addresses
- home-folder paths
- Bitcoin addresses

The embedded price data is excluded from the pattern search because random base64 gives false hits; it contains only prices.

| Found | Where | Assessment |
|---|---|---|
| No keys, tokens, passwords, private keys, IBANs, phone numbers or home paths | – | clean |
| `boddenlennart@proton.me` | `src/content/site.js`, page | intended: feedback and Impressum contact |
| `bc1qvj6c…pnpj8ld` | `src/content/site.js`, page | intended: donation address (public by design) |
| `boddenlennart@gmail.com` | author of the very first commit only (`d45cd11`, made on GitHub; metadata, not file content) | already public; not rewritten (that would need a force-push). All later commits use the GitHub no-reply address `217341961+boddenlennart@users.noreply.github.com` (repository git setting). |
| Spreadsheet creator | `reference/loan-reference.xlsx` | "openpyxl" only, no personal data |

**Re-checked on 2026-10-17** before pushing the `ux-redesign` branch: same result, all 31 new commits use the no-reply address. The maker line names Lennart Bodden (owner's decision); the Impressum will show a service address (c/o), no home address.

Not committed (in `.gitignore`): `.tools/`, `node_modules/`, `data/raw/`, `ux/audit/`, logs, `.claude/`, `.env*`, key files.
