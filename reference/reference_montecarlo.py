"""Independent reference for the page's simulation (weighted block bootstrap + lender rules).

Written separately from the page's JavaScript (src/engine/history.js, montecarlo.js, lender.js), in a
different language, from the rules as described in ux/K-math-audit.md, so the two check each other:

  - reads the RAW exchange candles (data/raw/*.csv), not the page's prepared data;
  - builds daily candles, daily log moves and daily lows itself;
  - takes the debt per day from the independent loan reference (reference_loan.py);
  - applies the lender's rules from their written description.

Only the random numbers are shared on purpose: the same generator (sfc32, one stream per path), so
both sides draw the very same 30-day pieces. Then every count must agree exactly; any difference
points to a mistake on one side.

Usage: .tools/py/bin/python reference/reference_montecarlo.py  -> tests/fixtures/montecarlo-reference.json
"""
import csv
import datetime as dt
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from reference_loan import schedule, add_months  # noqa: E402
from reference_replay import debt_on_day, r2  # noqa: E402

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "raw")
OUT = os.path.join(HERE, "..", "tests", "fixtures", "montecarlo-reference.json")
M32 = 0xFFFFFFFF
HALF_LIFE_DAYS = 3 * 365
BLOCK = 30


# ---------------------------------------------------------------- data
def hourly(currency, until):
    """Raw hourly candles in cents; hours without trades (exchange offline) carry the last close."""
    rows = {}
    with open(os.path.join(RAW, f"btc-{currency.lower()}-1h.csv")) as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            t = int(row[0])
            if t <= until:
                rows[t] = (r2(float(row[1])), r2(float(row[3])), r2(float(row[4])))
    t0, t1 = min(rows), max(rows)
    out = []
    last = None
    for t in range(t0, t1 + 1, 3600):
        if t in rows:
            last = rows[t]
            out.append((t,) + rows[t])
        else:
            c = last[2]
            out.append((t, c, c, c))
    return out


def daily(hours):
    """UTC days: open of the first hour, lowest hourly low, close of the last hour."""
    days = []
    for t, o, lo, c in hours:
        day = t // 86400
        if days and days[-1][0] == day:
            d = days[-1]
            days[-1] = (day, d[1], min(d[2], lo), c)
        else:
            days.append((day, o, lo, c))
    return days


def moves(days):
    """r_t = ln(C_t / C_t-1), l_t = ln(min(L_t, C_t) / C_t-1)."""
    r, l = [], []
    for k in range(1, len(days)):
        prev = days[k - 1][3]
        r.append(math.log(days[k][3] / prev))
        l.append(math.log(min(days[k][2], days[k][3]) / prev))
    return r, l


# ---------------------------------------------------------------- random numbers (same generator as the page)
def fmix(h):
    h = ((h ^ (h >> 16)) * 0x85EBCA6B) & M32
    h = ((h ^ (h >> 13)) * 0xC2B2AE35) & M32
    return (h ^ (h >> 16)) & M32


def mix_seed(a, b):
    return fmix((fmix((a ^ 0x9E3779B9) & M32) + (((b + 1) * 0x7F4A7C15) & M32)) & M32)


class Sfc32:
    def __init__(self, seed):
        self.a, self.b, self.c, self.d = 0x9E3779B9, 0x243F6A88, 0xB7E15162, seed & M32
        for _ in range(12):
            self.next()

    def next(self):
        a, b, c, d = self.a, self.b, self.c, self.d
        t = (a + b) & M32
        a = b ^ (b >> 9)
        b = (c + (c << 3)) & M32
        c = ((c << 21) | (c >> 11)) & M32
        d = (d + 1) & M32
        t = (t + d) & M32
        c = (c + t) & M32
        self.a, self.b, self.c, self.d = a, b, c, d
        return t / 4294967296

    def uniform(self):
        u = self.next()
        while u == 0:
            u = self.next()
        return u


# ---------------------------------------------------------------- the lender's rules (written from their description)
class Loan:
    """Per step: (1) low at or below the liquidation price -> sell all (or, partial rule, enough to reach the
    target); (2) a deadline that has passed: close still at or below the margin-call price -> sell all (or
    enough); otherwise the margin call is over; (3) low at or below the margin-call price -> margin call:
    a reserve is added once (as BTC at that price); if still too high: start the deadline, or (autoPartial)
    sell enough at once. warningOnly: only the first margin call counts, nothing is sold.
    Sale price (issue #7): a sale in (1), and the autoPartial sale in (3), happens at the step's low (the price
    fell through the level before the lender sold); a sale in (2) at the step's close."""

    def __init__(self, btc, t):
        self.c, self.scale, self.deadline = btc, 1.0, None
        self.first_margin = False
        self.topped_up = False
        self.partials = 0
        self.first_event = None  # day of the first sale of any kind (partial or full)
        self.liquidated = None  # (day, reason)
        self.sales = []  # (BTC sold, price) of every sale, for the cost of the risk
        self.t = t
        fee = t["liquidationFee"]
        self.k = (1 - fee["value"]) if fee["basis"] == "collateralSold" else 1 / (1 + fee["value"])
        self.target = t.get("cureTargetLtv") or t["initialLtv"]
        self.m = t.get("marginCallLtv")
        self.rule = t.get("marginCallConsequence", "warningOnly") if self.m else "none"

    def sell_enough(self, price, debt, day):
        proceeds = (debt - self.target * self.c * price) / (self.k - self.target)
        if proceeds <= 0:
            return True
        if proceeds / price >= self.c:
            return False
        self.c -= proceeds / price
        self.sales.append((proceeds / price, price))
        self.scale *= (debt - self.k * proceeds) / debt
        self.partials += 1
        if self.first_event is None:
            self.first_event = day
        return True

    def sell_all(self, price, debt):
        # the debt plus the fee, at most all the BTC: the fee is a share of the debt or of the sale
        self.sales.append((min(self.c, debt / self.k / price), price))

    def step(self, day, low, close, scheduled_debt, cure):
        if self.liquidated:
            return
        debt = scheduled_debt * self.scale
        liq = debt / (self.c * self.t["liquidationLtv"])
        if low <= liq:
            if self.m:
                self.first_margin = True
            if self.t.get("liquidationSale") == "partial" and self.sell_enough(low, debt, day):
                self.deadline = None
                return
            self.liquidated = (day, "liquidation")
            self.sell_all(low, debt)
            if self.first_event is None:
                self.first_event = day
            return
        if self.deadline is not None and day >= self.deadline:
            self.deadline = None
            if close <= debt / (self.c * self.m):
                if self.rule == "partialAfterCure" and self.sell_enough(close, debt, day):
                    return
                self.liquidated = (day, "deadline")
                self.sell_all(close, debt)
                if self.first_event is None:
                    self.first_event = day
                return
        if not self.m or self.deadline is not None:
            return
        if self.first_margin and self.rule == "warningOnly":
            return
        mc = debt / (self.c * self.m)
        if low > mc:
            return
        self.first_margin = True
        reserve = self.t.get("reserveAmount", 0)
        if reserve > 0 and not self.topped_up:
            self.topped_up = True
            self.c += reserve / mc
        if debt / (self.c * mc) < self.m - 1e-12:
            return
        if self.rule in ("liquidateAfterCure", "partialAfterCure"):
            self.deadline = day + cure
        elif self.rule == "autoPartial":
            self.sell_enough(low, debt, day)


# ---------------------------------------------------------------- the simulation
def simulate(r, l, t, s0, n_paths, seed, weights):
    n = len(r)
    w_sum = 0.0
    rw = 0.0
    for i in range(n):
        rw += r[i] * weights[i]
        w_sum += weights[i]
    shift = -rw / w_sum  # no trend: the weighted average move becomes 0
    rs = [x + shift for x in r]
    ls = [x + shift for x in l]
    starts = n - BLOCK + 1
    cum = []
    acc = 0.0
    for i in range(starts):
        acc += weights[i]
        cum.append(acc)
    total = cum[-1]
    rows = schedule(t)
    start = dt.date.fromisoformat(t["startDate"])
    days = (add_months(start, t["durationMonths"]) - start).days
    debts = [debt_on_day(t, rows, d) for d in range(days + 1)]
    btc = t["loanAmount"] / (t["initialLtv"] * s0)
    cure = max(1, math.ceil(t.get("curePeriodHours", 0) / 24))
    liq = part = margin = 0
    first_days = []
    ends, path_sales = [], []
    for p in range(n_paths):
        rng = Sfc32(mix_seed(seed, p))
        loan = Loan(btc, t)
        log_s = math.log(s0)
        pos = left = 0
        for d in range(1, days + 1):
            if left == 0:
                u = rng.uniform() * total
                lo, hi = 0, starts - 1
                while lo < hi:
                    mid = (lo + hi) >> 1
                    if cum[mid] > u:
                        hi = mid
                    else:
                        lo = mid + 1
                pos, left = lo, BLOCK
            ret, low_rel = rs[pos], min(ls[pos], 0.0, rs[pos])
            pos += 1
            left -= 1
            low = math.exp(log_s + low_rel)
            log_s += ret
            loan.step(d, low, math.exp(log_s), debts[d - 1], cure)
        ends.append(math.exp(log_s))
        path_sales.append(loan.sales)
        if loan.liquidated:
            liq += 1
        elif loan.partials:
            part += 1
        if loan.first_margin:
            margin += 1
        if p < 5:
            first_days.append(loan.first_event if loan.liquidated else None)  # as the page's chart: the first sale's day
    # the cost of the risk (ux/M-risk-cost-spec.md): end prices scaled to an average of today's price;
    # per sale, the part that repaid debt misses the rise above the sale price, the fee part is lost whole
    k = Loan(btc, t).k
    scale = s0 / (sum(ends) / n_paths)
    total = 0.0
    for end, sales in zip(ends, path_sales):
        e = end * scale
        for b, price in sales:
            total += k * b * max(0.0, e - price) + (1 - k) * b * e
    return dict(liquidated=liq, partial=part, marginCall=margin, firstPathsLiquidationDay=first_days, riskCost=total / n_paths)


def loan(**kw):
    t = dict(loanAmount=10000.0, initialLtv=0.5, marginCallLtv=0.7, liquidationLtv=0.8, durationMonths=12,
             rate=dict(type="fixed", annual=0.10), repayment="interestOnly", compounding="none", dayCount="30/360",
             originationFee=dict(type="percent", value=0.01), liquidationFee=dict(value=0.05, basis="debt"),
             marginCallConsequence="liquidateAfterCure", curePeriodHours=48, liquidationSale="all",
             reserveAmount=0, startDate="2026-01-15")
    t.update(kw)
    return t


CASES = [
    ("example", loan()),
    ("warning only", loan(marginCallConsequence="warningOnly")),
    ("no margin call", loan(marginCallLtv=None)),
    ("partial after the deadline", loan(marginCallConsequence="partialAfterCure")),
    ("partial at once", loan(marginCallConsequence="autoPartial", cureTargetLtv=0.55)),
    ("partial at liquidation, fee on BTC sold", loan(liquidationSale="partial", liquidationFee=dict(value=0.03, basis="collateralSold"))),
    ("reserve, 72 h", loan(reserveAmount=2000, curePeriodHours=72)),
    ("interest added, compounding, 24 months", loan(repayment="bullet", compounding="monthly", durationMonths=24, rate=dict(type="fixed", annual=0.12))),
    ("equal payments, 36 months, act/365", loan(repayment="amortizing", durationMonths=36, dayCount="act/365")),
    ("high LTV 65%, 6 months, 24 h", loan(initialLtv=0.65, marginCallLtv=0.75, liquidationLtv=0.85, durationMonths=6, curePeriodHours=24)),
    ("low LTV 25%, 12 months", loan(initialLtv=0.25)),
    ("variable rate", loan(rate=dict(type="variable", path=[dict(fromMonth=0, annual=0.08), dict(fromMonth=6, annual=0.14)]))),
]


def main():
    until = int(sys.argv[1]) if len(sys.argv) > 1 else 1792022399  # end of 13 Oct 2026 (inside the raw download)
    out = dict(until=until, nPaths=2000, seed=20240101, halfLifeDays=HALF_LIFE_DAYS, block=BLOCK, currencies={})
    for cur in ["EUR", "USD"]:
        days = daily(hourly(cur, until))
        r, l = moves(days)
        n = len(r)
        weights = [2 ** (-(n - 1 - i) / HALF_LIFE_DAYS) for i in range(n)]
        s0 = days[-1][3]
        res = {}
        for name, t in CASES:
            res[name] = dict(terms=t, s0=s0, **simulate(r, l, t, s0, out["nPaths"], out["seed"], weights))
            print(cur, name, res[name]["liquidated"], res[name]["partial"], res[name]["marginCall"], flush=True)
        out["currencies"][cur] = dict(days=len(days), firstDay=days[0][0] * 86400, lastClose=s0,
                                      sumR=sum(r), sumL=sum(l), cases=res)
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
    print("written", OUT)


if __name__ == "__main__":
    main()
