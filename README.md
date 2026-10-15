# BTC loan risk check

A single web page that helps you judge a bitcoin-backed loan. It estimates:

- the **chance that the loan gets liquidated** before it ends (your BTC sold by the lender), and
- what the loan **costs compared with selling BTC** instead.

You enter the terms from your own offer. The page has no lender presets and no lender names. It is **not financial, investment or tax advice**. Your lender's own figures always win over this page.

Everything runs in your browser. There is no server, no tracking and no cookies. The only network requests are public price lookups (see [Data sources](#data-sources)). Nothing you type is sent anywhere.

---

## Open the page on your computer

The finished page is one file: [`docs/index.html`](docs/index.html).

1. Download or clone this repository.
2. Double-click `docs/index.html`. It opens in your browser and works offline (with the stored price history).

If your browser refuses to start the background calculation from a local file, the page does the calculation directly instead. The page may then pause for a few seconds while it calculates.

## Publish it with GitHub Pages

1. On GitHub, open the repository **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Choose branch **`main`** and folder **`/docs`**, then **Save**.
4. After a minute the page is live at `https://<your-user-name>.github.io/btc-loan-risk/`.

The repository must be public for free GitHub Pages.

## Hosting and privacy

- **Everything is self-hosted inside `docs/index.html`**: styles, scripts, the price history and the icon. The page uses the device's own system fonts, so no font is downloaded. No CDN, no Google Fonts, no analytics. A Content Security Policy in the page blocks any other outside request, and `tests/hosting.test.js` checks the built file.
- **The only outside requests** are made by the visitor's browser when the page opens (chosen: automatic on load):
  - current price: `api.coinbase.com`; only if that fails, `api.kraken.com`, `api.binance.com`, `api.coingecko.com`, one after the other
  - recent hourly prices: `www.bitstamp.net`
  
  They carry no cookies, no referrer and nothing the visitor typed. The page names these services in its privacy section and in the privacy notice.
- The page stores the visitor's inputs and language in the browser's **local storage** (`btc-loan-risk:form`, `btc-loan-risk:lang`). The button "Forget my inputs" deletes them.

### What you need to fill in before publishing

The Impressum and the privacy notice are **templates**. They are in `src/content/text.de.js` and `src/content/text.en.js`, under `legal:`. Every part in «angle quotes» must be replaced, in both files. Until then, the page shows a "Template" note above both sections, and `node tools/build.mjs` prints how many placeholders are left.

| Placeholder | What to enter |
|---|---|
| «Vor- und Nachname» / «First and last name» | Your full name (or the name of whoever publishes the page) |
| «Straße und Hausnummer», «PLZ und Ort», «Land» | A postal address where you can be reached (a P.O. box is generally not enough) |
| «E-Mail-Adresse» | An e-mail address you read |
| «… Anschrift wie oben» (§ 18 MStV) | Name and address of the person responsible for the content, usually you |
| «Rechtsgrundlage der Übermittlung in die USA …» | The legal basis for GitHub's data transfer to the USA, for example the EU-US Data Privacy Framework, if GitHub is certified at that time |
| «Vollständigen Firmennamen und Anschrift jedes Dienstes …» | Company name and address of Coinbase, Kraken, Binance, CoinGecko and Bitstamp (from each service's own privacy policy or legal notice), and the legal basis for transfers outside the EU |
| «Diese Einschätzung prüfen.» | Confirm (or correct) that the local storage falls under § 25 (2) No. 2 TDDDG |
| «Name der für Sie zuständigen Behörde» | The data protection authority of your federal state (for example "Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen") |
| «Datum» | The date of this version |

Delete the sentence in «…» brackets once you have dealt with it. Then run `node tools/build.mjs` again.

**Whether you need an Impressum at all** depends on whether the page counts as a business-like service (§ 5 DDG) or contains journalistic-editorial content (§ 18 MStV). The template assumes you show one. These templates are a starting point, not legal advice. Have them checked by a lawyer before you publish.

### Connect your own domain (custom domain)

You need a domain from a domain registrar (for example the company where you bought it) and access to its DNS settings. Example below: `example.com`; replace it with yours.

1. **Verify the domain with GitHub first** (this stops others from using your domain on GitHub). On GitHub, click your profile picture → **Settings → Pages → Add a domain**. Enter `example.com`. GitHub shows a TXT record. Add that TXT record in your registrar's DNS settings, wait a few minutes, then press **Verify**.
2. **Choose the address.** Either `www.example.com` (simplest) or the bare `example.com`. You can set up both. GitHub then redirects one to the other.
3. **Add DNS records at your registrar:**
   - For `www.example.com`: a **CNAME** record, name `www`, value `boddenlennart.github.io`.
   - For the bare `example.com`: four **A** records, name `@`, with the values `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. For IPv6, four **AAAA** records with `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - Remove any other A/AAAA/CNAME records for the same names (for example a registrar's "parking page").
4. **Tell GitHub Pages the domain.** In the repository: **Settings → Pages → Custom domain**, enter `www.example.com` (or `example.com`), press **Save**. GitHub commits a file `docs/CNAME` containing the domain. Keep this file. A later `node tools/build.mjs` does not delete it.
5. **Wait** until GitHub shows "DNS check successful". This can take from a few minutes up to 24 hours.
6. **Switch on HTTPS:** tick **Enforce HTTPS** in the same Pages settings. GitHub sets up the certificate automatically. This can take up to an hour after the DNS check.
7. **Test:** open `https://www.example.com` and `https://example.com`. Both should show the page with a lock symbol.
8. **Update the privacy notice** if needed: if your domain registrar or DNS provider also processes visitor data (for example a proxy or CDN service in front of GitHub), name it there.

GitHub's own guide: "Managing a custom domain for your GitHub Pages site" in the GitHub Pages documentation.

## Rebuild after changes

You need the tools only to change the page, not to use it. They are installed inside the project folder (`.tools/`, `node_modules/`, not committed).

```bash
npm install                                  # test and build tools
python3 tools/fetch_history.py usd           # download USD price history (a few minutes)
python3 tools/fetch_history.py eur           # download EUR price history (slow: a few hours)
node tools/build-data.mjs                    # compress the history into data/
node tools/build.mjs                         # write docs/index.html
npm test                                     # run all automated tests
```

**All page text** (German and English) is in [`src/content/text.de.js`](src/content/text.de.js) and [`src/content/text.en.js`](src/content/text.en.js). You can edit wording there without touching any calculation. The example values in the form are in [`src/content/examples.js`](src/content/examples.js).

---

## How the page works

| Method | What it does | File |
|---|---|---|
| Historical replay | Starts the same loan on every day since 2014 and checks the real **hourly lowest price** (candle low) against the liquidation price. | `src/engine/replay.js` |
| Monte Carlo, block bootstrap | Builds 10,000 possible future price paths by gluing together random 30-day blocks of real daily price moves (including each day's low). | `src/engine/montecarlo.js` |
| Monte Carlo, GARCH(1,1) with Student-t errors | Second simulation with a model in which wild days cluster and large moves are more frequent. Cross-check for the bootstrap. | `src/engine/garch.js` |
| Textbook barrier formula | Closed-form chance that a geometric Brownian motion touches the liquidation price. Sanity check only. | `src/engine/barrier.js` |
| Loan arithmetic | Payment plan, interest, APR (XIRR), collateral, trigger prices, top-up, cost of liquidation, breakeven. | `src/engine/loan.js` |

All simulations run in a background Web Worker.

### Assumptions (all visible and editable on the page)

- **Debt** for the LTV = loan plus interest owed but not yet paid, growing day by day. So the liquidation price rises over time if interest is added to the loan.
- **Interest** per month = balance × yearly rate ÷ 12 (preset). It can also be actual days ÷ 365 or ÷ 360. Each month's interest is rounded to the cent.
- **Assumed price trend** = 0% a year (preset). The models remove the strong past upward trend of BTC. With the past trend kept, the calibration test (below) showed the models were too optimistic.
- **Margin call**: either a warning only, or the lender sells when the margin call is not fixed within the cure period (your choice). Optionally you add a reserve as extra BTC at the first margin call.
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
| Current price | Coinbase → Kraken → Binance → CoinGecko (first that answers within 4 s) | Binance has no BTC/USD market; BTC/USDT is used for USD there |
| Fallback price | Last close stored in the page | shown with a "not current" warning |

Prices are stored in cents in a compact compressed format (`src/data/codec.js`, `data/*.bin.gz`). A test checks that they equal the raw downloads to the cent.

**Known data issues** (reviewed by hand, listed in `tests/fixtures/data-known-issues.json`):

- Bitstamp was offline after a hack from 5 to 9 January 2015 (107 hours with a flat price). The replay cannot see prices in those days.
- 14 January 2015, 07:00 UTC: a real hourly drop from 207 to 152 USD (18,263 BTC traded in that hour). Kept.
- 4 November 2015, 21:00 UTC (EUR, Kraken): a real flash crash to 305 EUR after 427.50 (956 separate trades below 350 EUR; the USD market fell sharply in the same hour). Kept.
- EUR source switch from Kraken to Bitstamp at 2017-01-01 00:00 UTC; prices on both sides are within 0.3%.

The exchanges' terms for re-publishing their price data were not reviewed in detail; the project owner accepted this risk.

**Live-price check (CORS).** On 2026-10-15 every source was tested twice: with `curl -H "Origin: …"` (all send an `access-control-allow-origin` header) and with `fetch()` from the page in a real browser (Chromium):

| Source | Result in browser |
|---|---|
| Coinbase (BTC-EUR, BTC-USD) | OK, ~170 ms |
| Kraken (XBTEUR) | OK, ~100 ms |
| Binance (BTCEUR, BTCUSDT) | OK, ~260 ms |
| CoinGecko | OK, ~180 ms |
| Bitstamp hourly candles | OK, ~80 ms |

Public APIs can change their rules at any time; the page then falls back to the next source and finally to the stored price.

---

## Tests and how each was verified

Run with `npm test`. All tests were written **before** the engine (phase 1) and approved by the project owner.

| # | Test | How it was verified |
|---|---|---|
| 1 | Textbook formula and Monte Carlo agree (`tests/barrier.test.js`) | Simulated GBM paths with 40,000 paths in 4 scenarios must match the formula within 4 standard errors. One formula value was also worked out by hand (0.65623). |
| 2 | Replay of real crashes gives the expected liquidation hour (`tests/replay.test.js`) | Expected hours come from a separate program, `reference/reference_replay.py`, reading the same candles. USD results: Nov 2021 top → liquidated 2022-01-07 03:00 UTC; Dec 2017 top → 2017-12-22 14:00; Feb 2020 → 2020-03-12 10:00; a cautious loan survives March 2020. EUR: 2022-01-07 15:00; 2017-12-22 07:00; 2020-03-12 10:00; the cautious loan survives. These match the known crash dates. |
| 3 | Interest and repayment match a spreadsheet (`tests/loan.test.js`) | `reference/loan-reference.xlsx` uses live formulas (ROUND, PMT, IPMT, FV, EDATE, XIRR) for 12 loan types. An independent formula engine (Python `formulas`) recalculated the spreadsheet, and its results equal the Python reference in all 12 cases. The page must match to the cent. |
| 4 | Out-of-sample calibration (`tests/calibration.test.js`) | For every month from 2016 on, the model only sees earlier prices and predicts the lowest price of the next 90 or 365 days. Reality may fall below the "worst 5%" level at most 10% of the time, and below the "worst 10%" level at most 20%. Results below. |
| 5 | Common-sense rules (`tests/properties.test.js`) | Hundreds of random loans: a higher LTV never lowers the liquidation price; a longer loan never lowers the chance of liquidation (formula, all three simulations, replay); liquidating after an unfixed margin call never lowers it; a reserve never raises it. |
| 6 | Input validation (`tests/validation.test.js`) | 27 kinds of impossible terms must each be rejected with the right code. Each code has a "what is wrong" and a "how to fix it" text in both languages (test 7). |
| 7 | Completeness and wording (`tests/content.test.js`) | Every input has label, hint, "where to find this" and a "?" text with a number example; every output has a "What does this mean?" text; glossary entries exist; German and English have the same texts. A word scan rejects "typical", "usually", "üblich", "meist", "you should", "empfehlen" and similar, and any lender or platform name, unless a `[source: …]` is given. |
| 8 | Plain-language review | Done by the project owner (phase 3). |
| 9 | Real-offer check | Done by the project owner (phase 3); see below. |
| + | Data quality (`tests/data.test.js`) | Embedded data equals the raw downloads to the cent; no gaps over 6 hours, no extreme wicks and no offline periods that were not reviewed by hand. |
| + | GARCH fitting (`tests/garch.test.js`) | Data invented from known GARCH settings; the fit must recover them. |
| + | Live price (`tests/liveprice.test.js`) | Fallback order, timeouts, bad answers, stale fallback, and that no user data is in any request (with fake network answers). |
| + | Hosting (`tests/hosting.test.js`) | The built page has no external scripts, styles, fonts or images; every web address in it is one of the named price services (or a plain text link); the Content Security Policy allows exactly those services. The privacy notice must name every service (`tests/content.test.js`). |
| + | Speed-up is exact (`tests/replay.test.js`) | The replay skips quiet days for speed; on 300 random loans it gives exactly the same results as the plain hour-by-hour check. |

### Calibration results (assumed trend 0%)

| Currency | Model | Horizon | Below "worst 5%" | Below "worst 10%" | Below median |
|---|---|---|---|---|---|
| USD | bootstrap | 90 days | 2.3% | 3.9% | 30.5% |
| USD | bootstrap | 365 days | 0.0% | 1.7% | 31.9% |
| USD | GARCH | 90 days | 5.5% | 10.9% | 47.7% |
| USD | GARCH | 365 days | 0.0% | 4.2% | 39.5% |
| EUR | bootstrap | 90 days | 3.1% | 5.5% | 32.0% |
| EUR | bootstrap | 365 days | 0.0% | 1.7% | 31.9% |
| EUR | GARCH | 90 days | 5.5% | 10.2% | 47.7% |
| EUR | GARCH | 365 days | 0.0% | 2.5% | 41.2% |

Limits: below "worst 5%" at most 10%, below "worst 10%" at most 20%, below median between 20% and 80%. All pass. So the bootstrap model is on the cautious side, and GARCH over 90 days is close to what it promises. With the past trend kept instead of 0%, GARCH over 365 days failed (21.8% below "worst 10%").

---

## Final check: compare with a real offer to the cent

1. Open the page and press **Reset to example values**.
2. Enter every term from your offer: currency, loan amount, start date, duration, LTVs, rate, repayment type, fees. Use the **BTC price your offer names** (type it into "BTC price today").
3. Compare these three numbers with your offer or loan agreement:
   - **Liquidation price** (results, top)
   - **Total interest** (results, "Total interest")
   - **Total you pay back** (results, "Total you pay back"). Open **Show the monthly payment plan** to compare month by month.
4. If something differs, check in this order:
   - **Day count**: under "Interest and repayment → More settings", try "actual days ÷ 365" or "÷ 360".
   - **Rounding**: this page rounds every month's interest to the cent. Some lenders round only the total.
   - **Fees**: is the origination fee taken off the payout, or paid separately? Is it a percentage or a fixed amount?
   - **Liquidation price**: does your lender include unpaid interest in the debt? Which price does it use (see "How your lender measures the price")?
   - **Start date and payment dates**.
5. Write down every difference and its likely cause. Where the lender differs, the lender's number is right.

---

## Project structure

```
docs/index.html          the finished page (built)
src/engine/              calculations (loan, replay, Monte Carlo, GARCH, barrier, validation)
src/content/             all page text (de, en) and the example values
src/app/                 page layout, charts, worker, styles
src/live/price.js        live price fallback chain
src/data/codec.js        compact price-history format
data/                    compressed price history + meta.json (data/raw/ is not committed)
reference/               independent Python reference + spreadsheet
tests/                   automated tests and their fixtures
tools/                   download, data build, page build, local preview server
```

No keys or secrets are needed or stored. All APIs used are public.
