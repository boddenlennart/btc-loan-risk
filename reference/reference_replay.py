"""Independent reference for the historical replay of known crashes.

Reads the raw exchange candles (data/raw/*.csv) and, for a few fixed loans,
finds the first hour in which the candle LOW reached the liquidation price
(and the margin-call price). Writes tests/fixtures/replay-crashes.json.

Rules (the page's engine must follow the same ones):
  - The loan starts at the OPEN price of the start hour.
  - Collateral BTC = loan / (initial LTV x start price).
  - Debt = loan + interest owed but not yet paid, growing day by day
    (uses reference_loan.schedule for the monthly interest amounts).
  - From the hour AFTER the start hour until maturity: the loan is liquidated
    in the first hour whose LOW <= debt / (collateral BTC x liquidation LTV).
Usage: .tools/py/bin/python reference/reference_replay.py
"""
import csv
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from reference_loan import add_months, schedule  # noqa: E402

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "raw")


def load(currency):
    with open(os.path.join(RAW, f"btc-{currency.lower()}-1h.csv")) as f:
        r = csv.reader(f)
        next(r)
        return {int(row[0]): (float(row[1]), float(row[3])) for row in r}  # time -> (open, low)


def debt_on_day(terms, rows, day):
    """Debt (principal + unpaid interest) on calendar day `day` after start."""
    start = dt.date.fromisoformat(terms["startDate"])
    principal_before = terms["loanAmount"]
    accrued_before = 0.0
    for i, row in enumerate(rows):
        p0, p1 = add_months(start, i), add_months(start, i + 1)
        d0, d1 = (p0 - start).days, (p1 - start).days
        if day < d1:
            part = row["interest"] * (day - d0) / (d1 - d0)
            return principal_before + accrued_before + part
        if terms["repayment"] == "bullet":
            accrued_before += row["interest"]
        else:
            principal_before -= row["principal"]
    return principal_before + accrued_before


def replay(candles, scenario):
    t0 = int(dt.datetime.fromisoformat(scenario["start"].replace("Z", "+00:00")).timestamp())
    terms = dict(scenario["terms"])
    terms["startDate"] = scenario["start"][:10]
    rows = schedule(terms)
    open0 = candles[t0][0]
    btc = terms["loanAmount"] / (terms["initialLtv"] * open0)
    end_date = add_months(dt.date.fromisoformat(terms["startDate"]), terms["durationMonths"])
    t_end = t0 + (end_date - dt.date.fromisoformat(terms["startDate"])).days * 86400
    out = dict(startPrice=open0, collateralBtc=btc, liquidation=None, marginCall=None)
    t = t0 + 3600
    while t < t_end:
        if t in candles:
            low = candles[t][1]
            debt = debt_on_day(terms, rows, (t - t0) // 86400)
            if out["marginCall"] is None and terms.get("marginCallLtv") and low <= debt / (btc * terms["marginCallLtv"]):
                out["marginCall"] = dict(time=t, iso=iso(t), low=low, triggerPrice=debt / (btc * terms["marginCallLtv"]))
            if low <= debt / (btc * terms["liquidationLtv"]):
                out["liquidation"] = dict(time=t, iso=iso(t), low=low, triggerPrice=debt / (btc * terms["liquidationLtv"]), debt=debt)
                break
        t += 3600
    return out


def iso(t):
    return dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def terms(**kw):
    t = dict(loanAmount=10000.0, initialLtv=0.5, marginCallLtv=0.7, liquidationLtv=0.8, durationMonths=12,
             rate=dict(type="fixed", annual=0.0), repayment="interestOnly", compounding="none",
             dayCount="30/360", originationFee=dict(type="percent", value=0.0))
    t.update(kw)
    return t


SCENARIOS = [
    dict(name="Nov 2021 top, 50% / 80%", start="2021-11-10T00:00Z", terms=terms()),
    dict(name="Dec 2017 top (2018 crash), 50% / 80%", start="2017-12-17T00:00Z", terms=terms()),
    dict(name="Feb 2020 (March 2020 crash), 50% / 80%", start="2020-02-13T00:00Z", terms=terms()),
    dict(name="Mid 2019 top, bullet 12% compounding, 40% / 75%", start="2019-06-26T00:00Z",
         terms=terms(initialLtv=0.4, marginCallLtv=0.65, liquidationLtv=0.75, durationMonths=12,
                     rate=dict(type="fixed", annual=0.12), repayment="bullet", compounding="monthly", dayCount="act/365")),
    dict(name="Feb 2020, 25% / 90% (survives March 2020)", start="2020-02-13T00:00Z",
         terms=terms(initialLtv=0.25, marginCallLtv=None, liquidationLtv=0.9, durationMonths=6)),
]

if __name__ == "__main__":
    result = []
    for cur in sys.argv[1:] or ["USD", "EUR"]:
        candles = load(cur)
        for s in SCENARIOS:
            r = replay(candles, s)
            result.append(dict(currency=cur, **s, expected=r))
            liq = r["liquidation"]["iso"] if r["liquidation"] else "not liquidated"
            mc = r["marginCall"]["iso"] if r["marginCall"] else "-"
            print(f"{cur} {s['name']:50s} start {r['startPrice']:>9.2f}  margin call {mc:18s} liquidation {liq}")
    with open(os.path.join(HERE, "..", "tests", "fixtures", "replay-crashes.json"), "w") as f:
        json.dump(result, f, indent=1)
