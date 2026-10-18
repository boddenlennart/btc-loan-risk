# Quality report: tests, robustness, consistency, non-functional requirements

Measured on 17 Oct 2026, updated 18 Oct 2026 for the three-page site (branch `ux-redesign`). How to repeat each measurement is given in brackets.

## 1. Is the functionality covered by tests?

| Part | Measured coverage | How |
|---|---|---|
| Calculations (loan, lender rules, replay, simulation, GARCH, validation) | 92–100% of lines | unit tests (`npx vitest run --coverage --coverage.include='src/**'`) |
| Data (price history, exchange rates, checks) | 96–100% of lines | unit tests |
| Page code (form, answer, comparison, share link, language) | main page logic 88.7%, texts and languages 91%, form conversion 94%, charts 76% | browser tests with Chromium's coverage recorder (`node tools/coverage-e2e.mjs`) |
| Live price chain | 93% | unit tests with fake network answers; Kraken, Binance and CoinGecko are reached only there, not in the browser tests |

Not run by any test: rare fallback branches inside library code (compression), and a few chart tooltip details. Every feature visible on the page has at least one browser test.

## 2. Breaking things on purpose

**Planted bugs** (`node tools/mutation-check.mjs`): 19 realistic slips in the calculation code, one at a time. Examples:
- interest divided by 11 instead of 12
- the trigger price at an LTV 1 point too high
- the simulation checks the day's open instead of its low
- the margin-call deadline one step late
- a cash-out refinancing lowers the debt
- the exchange rate used one day early

**Result: all 19 caught** (18 Oct 2026, including the new "fastest fall" calculation). One planted change in the first run turned out to compute exactly the same numbers ("equivalent"); it was replaced by a real look-ahead bug, which three tests catch.

**Hostile input and broken environments** (browser tests): all pass after fixing the defects they found.
- a share link with HTML/script in offer names is shown as text; nothing is injected or executed
- a share link with nonsense values: the page explains the problem and doesn't crash
- corrupted saved inputs: the page starts from the example. **Defect found and fixed:** it used to stay empty.
- browser storage blocked (private mode): the page works
- background calculation blocked: the direct calculation gives the same answer
- garbled recent price hours from the exchange are ignored
- earlier tests: 27 kinds of impossible terms; offline (stored price with warning); price services failing, slow or answering nonsense; bad or disagreeing price data and exchange rates in the weekly update; the drift guard

## 3. Consistency

- Every number shown twice on the page is tested to be the same number:
  - the headline equals "your terms" in Make it safer, equals the slider at your own LTV, equals the "no trend" row, equals the comparison column
  - the instant example equals the live calculation
- **Defect found and fixed earlier:** the trend rows counted partial sales; the answer didn't.
- German and English have the same texts; the content rules (no market claims, no advice, no lender names, short sentences) are checked automatically.
- The documentation counts (tests, reference loans) were updated with this report.

## 4. Non-functional requirements

| Requirement | Result |
|---|---|
| **Browsers** | all 62 browser tests (the check, the navigation, the two other pages) pass in Chrome's, Safari's (WebKit, used by every iPhone browser) and Firefox's engine: 182 runs, 4 skipped because reading the clipboard works only in Chrome's test mode. The GitHub workflows now install all three. |
| **Speed** | example answer visible after 0.06 s (desktop) to 0.24 s (4× slower phone simulation); new number about 1 s after a change; everything recalculated in 2.5–3.2 s. Download 1.70 MB compressed (mostly the price history). The phone simulation slows only the page, not the background calculation, so the owner's own phone measurement (1–2 s for the answer) is the more reliable figure. |
| **Accessibility** | axe-core: 0 issues in light and dark mode, with comparison, language menu, undo line and all sections open. Since the three-page site, a browser test runs axe on every page (light and dark, footer opened) at every test run; it found one defect, fixed: the privacy notice's headings skipped a level on the new pages. **Defects found and fixed:** an unlabelled table corner, and a button whose spoken name did not contain its visible text. Every text colour is at least 4.5:1 (checked automatically); tap targets 44 px; keyboard: slider and menu work by keyboard. |
| **Security** | no outside scripts, styles, fonts or images; the Content Security Policy allows only the named price services ("Insights" and "How it works" may contact no outside address at all), and **only the page's own script may run**: it is identified by its SHA-256 fingerprint, computed at every build (added 18 Oct 2026; there is no general permission for inline scripts or inline handlers). In all three browsers, a script smuggled into the page is refused. Security headers: no embedding in other sites, no MIME sniffing, no referrer, no device features. All 40 places that insert HTML escape outside text (reviewed; tested with a hostile link). No dynamic code execution. |
| **Privacy** | no tracking, no cookies; inputs stay in the browser (local storage, "Forget my inputs"); share links keep inputs after "#" (never sent to a server) and leave out the price and private details. |
| **Robustness** | see section 2. |
| **Search engines** | title, description, canonical and language links per language, preview tags. **Defect found and fixed:** the hosting answered every unknown address, including `robots.txt`, with the full page and "200 OK". Now there are a `robots.txt`, a `sitemap.xml` with both languages, and a real "not found" page. |
| **Maintainability** | all wording in two text files; tests document every rule; reference results to 9 decimals; README explains every command. Not in place: an automatic style checker (linter). |

## 5. Open recommendations

1. ~~Stricter script rule~~: done (18 Oct 2026), see Security above.
2. **Real-phone speed check** of the full recalculation on an older phone, using the preview link.
3. **A style checker (linter)** for the code: optional; it catches careless mistakes early but doesn't change what the page does.
