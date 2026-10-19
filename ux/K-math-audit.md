# Maths audit

Status: 19 Oct 2026 (branch `ux-redesign`). Requested by the owner before the simulation is explained in detail on "How it works": "our whole value proposition stands and falls with the math".

## Verdict

**The simulation, the lender's rules, the volatility model (GARCH) and the textbook formula compute what the page says they compute.** An independent second implementation agrees exactly in 24 of 24 loan cases. A standard statistics package reproduces the volatility model. Answers known in advance come out exactly.

Five problems were found and fixed; seven smaller effects were measured and are disclosed instead of changed.

**What this audit cannot replace:** the second implementation was written by the same AI that wrote the page, in a different language and from the written rules rather than from the code. That catches slips in the code, but not a shared misunderstanding of the rules. An outside review by a quant remains an option for later.

## What was checked, and how

| # | Check | How | Result |
|---|---|---|---|
| 1 | The whole simulation: daily data, 30-day pieces, weighting, trend removal, debt per day, every lender rule | An independent Python version (`reference/reference_montecarlo.py`) reads the **raw** exchange downloads, builds its own daily series, takes the debt from the independent loan reference and applies the lender rules from their description. Only the random-number generator is shared, so both draw the same pieces. | **Exact agreement** for 12 loans × EUR and USD: the number of liquidated, partly liquidated and margin-call futures, and the day of the first sale in the first paths. The daily series agree too (days, prices, sums). Permanent test: `tests/montecarlo-reference.test.js`. |
| 2 | Answers known in advance | Prices that never move; a steady 2% fall a day; a dip that recovers the same day; a margin call not fixed in time; a partial liquidation | All exact (`tests/math-audit.test.js`): no liquidation; liquidation on day 24 as calculated; the day's low counts; the sale at the end of the deadline; the LTV exactly at the target after a partial liquidation, fees included. |
| 3 | Lender rules | Line-by-line review of the formulas for partial sales, fees, reserve, deadlines | Correct. |
| 4 | Random numbers | Correlations between and within paths, evenness, distinct streams | Even and uncorrelated. **Found and fixed: runs with neighbouring seeds shared almost all paths** (see F1). |
| 5 | Precision of the number | The example loan with 40 different seeds | Varies by 0.48 points (statistics expects 0.50): **"precise to about ±1 point" is right** (95% range). |
| 6 | No built-in trend | Exact chance of every day being drawn; the simulated middle price after 12 months | Leftover trend 0.19% a year; middle price +0.2% after a year: negligible. |
| 7 | Volatility model (GARCH) | Fitted with the standard package `arch` on the same data; likelihood recomputed independently | α 0.1246 / 0.1246, β 0.8749 / 0.8754, ν 3.16 / 3.15; fit quality −11,427.6 / −11,427.5. **Same model.** |
| 8 | Textbook formula | Formula review; existing test against a simulation of the textbook model | Correct (reflection formula, no trend). |
| 9 | Test against history | Re-run with the page's settings; how many independent cases it really contains | Passes (simulation: "worst 5%" breached 0–3 times in 100). See L6 on its strength. |
| 10 | Data | Long stretches without trades; the largest daily moves | Largest moves are real events (12 Mar 2020: −38%). See L7 for the 2015 outage. |
| 11 | Cost of the risk (added 19 Oct 2026, `ux/M-risk-cost-spec.md`) | The Python version computes it from its own sale records; answers known in advance; the textbook barrier-option formula (Reiner and Rubinstein) on smooth prices; the margin-call premiums of the paper the definition comes from | **Exact agreement** in all 24 cases. Known answers exact (no sale, fee, partial sale with both fee bases). Simulation and formula agree within the simulation's precision. The paper's 0.6 / 2.1 / 4.8% are reproduced within 0.15 points. Tests: `tests/montecarlo-reference.test.js`, `tests/risk-cost.test.js`. |

## Found and fixed

| # | Problem | Effect | Fix |
|---|---|---|---|
| F1 | Seeds were mixed with path numbers by XOR first: runs 1001 and 1002 shared 9,998 of 10,000 paths | None on the page (one fixed seed, all paths within a run distinct); made precision measurements wrong and made neighbouring months in the test against history share random streams | The seed is mixed on its own first (`mixSeed` in `src/engine/random.js`); now 0 shared paths. All simulated numbers moved within the normal random variation (at most 1.3 points). |
| F2 | With recent years weighted more, the trend was removed with the plain average of all years, which put a downtrend into recent years | Would have raised the weighted results noticeably (found before release) | The trend is removed with the weighted average. |
| F3 | The textbook formula used the unweighted volatility (67%) while the simulation effectively uses 57% | Methods rested on different assumptions | Same weighted volatility everywhere. |
| F4 | "The simulation is the most cautious" was always shown | Not always true after the weighting | Shown only when true for the loan. |
| F5 | (Test detail) the Python reference recorded the final liquidation day, the page the first sale's day | None | Both record the first sale's day. |

## Measured and disclosed (not changed)

| # | Effect | Size | Why not changed |
|---|---|---|---|
| L1 | The simulation steps day by day: a margin-call deadline counts in whole days and is checked at the day's close (up to a day late; 30 hours count as 2 days) | Example: deadline 1 day 53.5, 2 days 52.7, 3 days 51.7: about half a point in the borrower's favour | Hourly simulation would be about 24 times slower; the real-history method checks hourly. To be stated on "How it works". |
| L2 | A liquidation is assumed to sell exactly at the liquidation price | In real liquidation hours, the price fell a further 1.5–1.8% below it in the middle case, 8–10% in 1 of 10 cases, at worst 18–25% | Affects only "you get back about X BTC" (optimistic in fast crashes), not how often a loan is liquidated. Already said under "What this does not include"; the numbers go on "How it works". |
| L3 | The most recent 29 days are drawn half as often as intended (1% instead of 2%), an edge effect of the 30-day pieces | Negligible | A circular fix would join 2026 to 2014. |
| L4 | GARCH's fitted persistence (α + β) sits at the fitting limit, 0.9995; the standard package finds 1.000 | Volatility shocks fade very slowly; the model carries today's volatility forward | A property of BTC's data, not a fitting error. One reason the simulation, not GARCH, gives the headline. |
| L5 | GARCH's fitted tails (ν ≈ 3.2) imply extremely rare, extremely large days | Wide price ranges in single paths | Realistic for BTC; it only affects the second method. |
| L6 | The test against history overlaps: 128 monthly forecasts of 90 days hold about 43 independent periods, 119 forecasts of 365 days only about 10 | With 10 independent years, "0 breaches" is consistent with an honest model (60% chance) as well as a cautious one | The test can catch a clearly optimistic model, not prove exact calibration. To be stated on "How it works". |
| L7 | The 2015 Bitstamp outage appears in the US-dollar data as 3 days without a move (EUR data come from Kraken then and are not affected) | 3 of about 4,600 days, little weight | Negligible. |

## Permanent safeguards added

- `tests/montecarlo-reference.test.js` with `tests/fixtures/montecarlo-reference.json` (from `reference/reference_montecarlo.py`): any change in the simulation or the lender rules that is not made in both implementations fails.
- `tests/math-audit.test.js`: answers known in advance, independent random streams, precision, no built-in trend.
- `tests/risk-cost.test.js`: the cost of the risk against answers known in advance, the textbook option formula and the paper's premiums; the Python version checks it in every reference case.
- The test against history checks the page's actual settings (weighted, no trend).

To regenerate the Python reference after an intended change: `.tools/py/bin/python reference/reference_montecarlo.py`.
