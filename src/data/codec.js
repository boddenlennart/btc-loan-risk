// Compact format for the hourly price history embedded in the page.
// Header: count, first hour, first open price. Prices are stored in cents. Each hour is 5 numbers, written as variable-length
// integers (small numbers take 1 byte):
//   1. hours since the previous candle minus 1, times 2, plus 1 if no trade happened
//   2. close  - previous close   (signed)
//   3. open   - previous close   (signed)
//   4. high   - max(open, close) (never negative)
//   5. min(open, close) - low    (never negative)
// The whole thing is then gzip-compressed and stored as base64 text.

const MAGIC = [0x42, 0x54, 0x43, 0x31]; // "BTC1"

export const toCents = (x) => Math.floor(x * 100 + 0.5 + 1e-9);

function writeVarint(out, n) {
  while (n >= 128) { out.push((n % 128) + 128); n = Math.floor(n / 128); }
  out.push(n);
}
const zig = (n) => (n >= 0 ? n * 2 : -n * 2 - 1);
const unzig = (z) => (z % 2 === 0 ? z / 2 : -(z + 1) / 2);

/** rows: [{ time, open, high, low, close, volume }] in price units. Returns a byte array (not yet compressed). */
export function encodeHourly(rows) {
  const out = [...MAGIC];
  writeVarint(out, rows.length);
  writeVarint(out, rows[0].time / 3600);
  writeVarint(out, toCents(rows[0].open)); // the first "previous close" is the first open
  let prevT = rows[0].time - 3600;
  let prevC = toCents(rows[0].open);
  for (const r of rows) {
    const o = toCents(r.open); const h = toCents(r.high); const l = toCents(r.low); const c = toCents(r.close);
    writeVarint(out, ((r.time - prevT) / 3600 - 1) * 2 + (r.volume === 0 ? 1 : 0));
    writeVarint(out, zig(c - prevC));
    writeVarint(out, zig(o - prevC));
    writeVarint(out, h - Math.max(o, c));
    writeVarint(out, Math.min(o, c) - l);
    prevT = r.time; prevC = c;
  }
  return Uint8Array.from(out);
}

/** bytes: uncompressed Uint8Array. Returns { time, open, high, low, close } (Float64Array, prices) and noTrade (Uint8Array). */
export function decodeHourly(bytes) {
  let p = 0;
  const read = () => {
    let n = 0; let mul = 1; let b;
    do { b = bytes[p++]; n += (b & 127) * mul; mul *= 128; } while (b >= 128);
    return n;
  };
  for (let i = 0; i < 4; i++) if (bytes[p++] !== MAGIC[i]) throw new Error('not a price history file');
  const n = read();
  let t = read() * 3600 - 3600;
  let prevC = read();
  const time = new Float64Array(n); const open = new Float64Array(n); const high = new Float64Array(n);
  const low = new Float64Array(n); const close = new Float64Array(n); const noTrade = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = read();
    t += (Math.floor(a / 2) + 1) * 3600;
    noTrade[i] = a % 2;
    const dc = unzig(read()); const doo = unzig(read()); const dh = read(); const dl = read();
    const c = prevC + dc; const o = prevC + doo;
    time[i] = t; close[i] = c / 100; open[i] = o / 100;
    high[i] = (Math.max(o, c) + dh) / 100; low[i] = (Math.min(o, c) - dl) / 100;
    prevC = c;
  }
  return { time, open, high, low, close, noTrade };
}
