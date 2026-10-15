"""Download raw hourly BTC price candles from public exchange APIs.

Sources (raw exchange data, no aggregators):
  USD: Bitstamp BTC/USD hourly candles, 2014-01-01 until now.
  EUR: Kraken XBT/EUR individual trades, turned into hourly candles here,
       from 2014-01-01 until EUR_SWITCH; Bitstamp BTC/EUR hourly candles after.
       (Bitstamp's EUR market only starts in 2016 and was very thin at first.)

Output: data/raw/btc-usd-1h.csv and data/raw/btc-eur-1h.csv
        columns: unix_time_utc_hour_start,open,high,low,close,volume,source

Usage: python3 tools/fetch_history.py usd|eur
Only uses the Python standard library. Safe to re-run: Kraken progress is cached.
"""
import csv
import json
import os
import sys
import time
import urllib.request

START = 1388534400            # 2014-01-01 00:00 UTC
EUR_SWITCH = 1483228800       # 2017-01-01 00:00 UTC
ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")


def get_json(url, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "btc-loan-risk-research"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # network hiccup or rate limit: back off and retry
            print("retry", i, url, e, file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise RuntimeError("giving up on " + url)


def bitstamp(pair, start, end):
    rows = {}
    t = start
    while t < end:
        d = get_json(f"https://www.bitstamp.net/api/v2/ohlc/{pair}/?step=3600&limit=1000&start={t}")
        ohlc = d["data"]["ohlc"]
        if not ohlc:
            t += 1000 * 3600
            continue
        for c in ohlc:
            ts = int(c["timestamp"])
            if start <= ts < end:
                rows[ts] = [ts, c["open"], c["high"], c["low"], c["close"], c["volume"], "bitstamp"]
        last = int(ohlc[-1]["timestamp"])
        t = max(last + 3600, t + 3600)
        print(pair, time.strftime("%Y-%m-%d", time.gmtime(t)), file=sys.stderr)
        time.sleep(0.4)
    return rows


# The Kraken download is slow (several seconds per request for old data), so it
# is split into time segments that can run in parallel: `fetch_history.py eur-seg N`.
SEGMENTS = [START, 1412121600, 1435708800, 1459468800, EUR_SWITCH]  # 2014-01, 2014-10, 2015-07, 2016-04, 2017-01


def kraken_segment(n):
    start, end = SEGMENTS[n], SEGMENTS[n + 1]
    cache = os.path.join(ROOT, "kraken-xbteur-trades.jsonl" if n == 0 else f"kraken-xbteur-trades-{n}.jsonl")
    since = str(start * 10**9)
    if os.path.exists(cache):  # resume
        with open(cache) as f:
            lines = f.read().splitlines()
        if lines:
            since = json.loads(lines[-1])["last"]
    with open(cache, "a") as out:
        while int(since) // 10**9 < end:
            d = get_json(f"https://api.kraken.com/0/public/Trades?pair=XBTEUR&since={since}")
            if d.get("error"):
                print("kraken error", d["error"], file=sys.stderr)
                time.sleep(10)
                continue
            res = d["result"]
            trades = res["XXBTZEUR"]
            out.write(json.dumps({"last": res["last"], "t": [[x[0], x[1], x[2]] for x in trades]}) + "\n")
            out.flush()
            if res["last"] == since or not trades:
                break
            since = res["last"]
            print("kraken", time.strftime("%Y-%m-%d %H:%M", time.gmtime(int(since) // 10**9)), file=sys.stderr)
            time.sleep(1.2)


def kraken_trades_to_hours(start, end):
    rows = {}
    for n in range(len(SEGMENTS) - 1):
        seg_start, seg_end = SEGMENTS[n], SEGMENTS[n + 1]  # segments overlap at the edges: keep only own range
        cache = os.path.join(ROOT, "kraken-xbteur-trades.jsonl" if n == 0 else f"kraken-xbteur-trades-{n}.jsonl")
        with open(cache) as f:
            for line in f:
                for price, vol, ts in json.loads(line)["t"]:
                    ts = float(ts)
                    if not (max(start, seg_start) <= ts < min(end, seg_end)):
                        continue
                    h = int(ts // 3600 * 3600)
                    p, v = float(price), float(vol)
                    r = rows.get(h)
                    if r is None:
                        rows[h] = [h, p, p, p, p, v, "kraken"]
                    else:
                        r[2] = max(r[2], p); r[3] = min(r[3], p); r[4] = p; r[5] += v
    # Hours without trades: flat candle at the previous close, zero volume.
    filled, prev = {}, None
    for h in range(start, end, 3600):
        if h in rows:
            filled[h] = rows[h]; prev = rows[h][4]
        elif prev is not None:
            filled[h] = [h, prev, prev, prev, prev, 0.0, "kraken"]
    return filled


def write(name, rows):
    os.makedirs(ROOT, exist_ok=True)
    path = os.path.join(ROOT, name)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "open", "high", "low", "close", "volume", "source"])
        for k in sorted(rows):
            w.writerow(rows[k])
    print("wrote", path, len(rows), "hours", file=sys.stderr)


if __name__ == "__main__":
    now = int(time.time()) // 3600 * 3600
    which = sys.argv[1]
    if which == "usd":
        write("btc-usd-1h.csv", bitstamp("btcusd", START, now))
    elif which == "eur-seg":
        kraken_segment(int(sys.argv[2]))
    elif which == "eur":
        rows = kraken_trades_to_hours(START, EUR_SWITCH)
        rows.update(bitstamp("btceur", EUR_SWITCH, now))
        write("btc-eur-1h.csv", rows)
