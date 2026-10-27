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
from reference_loan import add_months, r2, schedule  # noqa: E402

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "raw")


def load(currency):
    with open(os.path.join(RAW, f"btc-{currency.lower()}-1h.csv")) as f:
        r = csv.reader(f)
        next(r)
        return {int(row[0]): (r2(float(row[1])), r2(float(row[3])), r2(float(row[4]))) for row in r}  # time -> (open, low, close), in cents like the page


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

def replay_rules(candles, scenario):
    """Same loan, with the lender's full margin-call rules (written independently of the page's lender.js).

    Rules: see the header of src/engine/lender.js. In short, each hour, with debt = scheduled debt x scale:
      1. low <= debt / (BTC x liquidation LTV): sell everything (loan ends) or, if liquidationSale = partial,
         only enough to bring the LTV back to the target.
      2. a cure deadline has passed: if the hour's close is still <= debt / (BTC x margin LTV), sell everything
         (liquidateAfterCure) or only enough (partialAfterCure); otherwise the margin call is over.
      3. low <= debt / (BTC x margin LTV) (first time only for warningOnly): margin call. A reserve is added once
         as BTC at that price. If the LTV is still too high: start the cure deadline, or (autoPartial) sell enough
         at the hour's low.
    Sale price (issue #7): a sale in 1., and the sale at once in 3., happens at the hour's LOW (the price fell
    through the level before the lender sold); a sale in 2. at the hour's close.
    A sale of value S at price P repays k x S (k = 1/(1+fee) for a fee on the debt, 1 - fee for a fee on the BTC
    sold). Enough to reach target T: S = (debt - T x BTC x P) / (k - T). Later debt is scaled by (debt - kS) / debt.
    """
    t0 = int(dt.datetime.fromisoformat(scenario["start"].replace("Z", "+00:00")).timestamp())
    tm = dict(scenario["terms"])
    tm["startDate"] = scenario["start"][:10]
    rows = schedule(tm)
    open0 = candles[t0][0]
    btc = tm["loanAmount"] / (tm["initialLtv"] * open0)
    btc0 = btc
    start = dt.date.fromisoformat(tm["startDate"])
    t_end = t0 + (add_months(start, tm["durationMonths"]) - start).days * 86400
    M, L = tm.get("marginCallLtv"), tm["liquidationLtv"]
    beh = tm.get("marginCallConsequence", "warningOnly") if M else "none"
    target = tm.get("cureTargetLtv") or tm["initialLtv"]
    fee = tm.get("liquidationFee", {"value": 0.0, "basis": "debt"})
    k = 1 - fee["value"] if fee["basis"] == "collateralSold" else 1 / (1 + fee["value"])
    cure = tm.get("curePeriodHours", 0) * 3600
    reserve = tm.get("reserveAmount", 0)
    scale, deadline, first_margin, topped = 1.0, None, None, False
    partials, liquidation = [], None

    def sell_part(debt, price, t, why):
        nonlocal btc, scale
        S = (debt - target * btc * price) / (k - target)
        if S <= 0:
            return True
        if S / price >= btc:
            return False
        btc -= S / price
        scale *= (debt - k * S) / debt
        partials.append(dict(time=t, iso=iso(t), reason=why, btc=S / price))
        return True

    def close_all(debt, price, t, why):
        sold_value = debt / (1 - fee["value"]) if fee["basis"] == "collateralSold" else debt * (1 + fee["value"])
        sold = min(btc, sold_value / price)
        return dict(time=t, iso=iso(t), reason=why, btcReturned=btc - sold)

    t = t0 + 3600
    while t < t_end and liquidation is None:
        if t in candles:
            _, low, close = candles[t]
            debt = debt_on_day(tm, rows, (t - t0) // 86400) * scale
            liq_price = debt / (btc * L)
            if low <= liq_price:
                if first_margin is None and M:
                    first_margin = t
                if tm.get("liquidationSale") == "partial" and sell_part(debt, low, t, "liquidationLtv"):
                    deadline = None
                else:
                    liquidation = close_all(debt, low, t, "liquidationLtv")
                t += 3600
                continue
            if deadline is not None and t >= deadline:
                deadline = None
                if close <= debt / (btc * M):
                    if not (beh == "partialAfterCure" and sell_part(debt, close, t, "cureExpired")):
                        liquidation = close_all(debt, close, t, "cureExpired")
                    t += 3600
                    continue
            if M and deadline is None and not (first_margin is not None and beh == "warningOnly"):
                mc_price = debt / (btc * M)
                if low <= mc_price:
                    if first_margin is None:
                        first_margin = t
                    if reserve and not topped:
                        btc += reserve / mc_price
                        topped = True
                    if debt / (btc * mc_price) >= M - 1e-12:
                        if beh in ("liquidateAfterCure", "partialAfterCure"):
                            deadline = t + cure
                        elif beh == "autoPartial":
                            sell_part(debt, low, t, "autoPartial")
        t += 3600
    return dict(startPrice=open0, collateralBtc=btc0, marginCall=first_margin, liquidation=liquidation,
                partialSales=partials, collateralAtEnd=liquidation["btcReturned"] if liquidation else btc)


RULE_SCENARIOS = [
    dict(name="Nov 2021 top, lender sells part at the margin call, 4% fee", start="2021-11-10T00:00Z",
         terms=terms(marginCallConsequence="autoPartial", liquidationFee=dict(value=0.04, basis="debt"))),
    dict(name="Dec 2017 top, sells everything if not fixed in 48 h", start="2017-12-17T00:00Z",
         terms=terms(marginCallConsequence="liquidateAfterCure", curePeriodHours=48)),
    dict(name="Dec 2017 top, sells part if not fixed in 48 h, 2% fee on BTC sold", start="2017-12-17T00:00Z",
         terms=terms(marginCallConsequence="partialAfterCure", curePeriodHours=48, liquidationFee=dict(value=0.02, basis="collateralSold"))),
    dict(name="Feb 2020, warning only, partial sale at the liquidation LTV", start="2020-02-13T00:00Z",
         terms=terms(marginCallConsequence="warningOnly", liquidationSale="partial")),
    dict(name="Nov 2021 top, reserve 3,000 added, sells everything if not fixed in 72 h", start="2021-11-10T00:00Z",
         terms=terms(marginCallConsequence="liquidateAfterCure", curePeriodHours=72, reserveAmount=3000.0)),
    dict(name="Mid 2019 top, bullet 12%, sells part after 24 h, target 45%", start="2019-06-26T00:00Z",
         terms=terms(initialLtv=0.4, marginCallLtv=0.65, liquidationLtv=0.75, rate=dict(type="fixed", annual=0.12), repayment="bullet",
                     compounding="monthly", dayCount="act/365", marginCallConsequence="partialAfterCure", curePeriodHours=24, cureTargetLtv=0.45)),
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
    rules_result = []
    for cur in sys.argv[1:] or ["USD", "EUR"]:
        candles = load(cur)
        for s in RULE_SCENARIOS:
            r = replay_rules(candles, s)
            rules_result.append(dict(currency=cur, **s, expected=r))
            liq = f"{r['liquidation']['iso']} ({r['liquidation']['reason']})" if r["liquidation"] else "not liquidated"
            print(f"{cur} {s['name']:75s} partial sales {len(r['partialSales'])}  end BTC {r['collateralAtEnd']:.4f}  {liq}")
    with open(os.path.join(HERE, "..", "tests", "fixtures", "replay-rules.json"), "w") as f:
        json.dump(rules_result, f, indent=1)
