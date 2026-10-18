// Breaks the calculation on purpose, one small bug at a time, and checks that the tests notice.
// Each "mutation" is a realistic slip (wrong sign, wrong unit, close instead of low, off-by-one).
// The file is always restored, also when the run is interrupted.
// Usage: node tools/mutation-check.mjs        (takes ~10 minutes; runs the unit tests per bug)
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const M = [
  ['src/engine/loan.js', 'return (balance * annual) / 12; // \'30/360\', the preset', 'return (balance * annual) / 11; // \'30/360\', the preset', 'monthly interest divided by 11 instead of 12'],
  ['src/engine/loan.js', 'if (dayCount === \'act/365\') return (balance * annual * days) / 365;', 'if (dayCount === \'act/365\') return (balance * annual * days) / 360;', 'actual/365 counted as /360'],
  ['src/engine/loan.js', 'return (pv * rate) / -Math.expm1(-n * Math.log1p(rate));', 'return (pv * rate) / -Math.expm1(-(n + 1) * Math.log1p(rate));', 'equal payment over one period too many'],
  ['src/engine/loan.js', 'const byDay = debtByDay(terms).map((debt) => debt / (btc * ltv));', 'const byDay = debtByDay(terms).map((debt) => debt / (btc * (ltv + 0.01)));', 'trigger price at an LTV 1 point too high'],
  ['src/engine/loan.js', 'const soldValue = f.basis === \'collateralSold\' ? debt / (1 - f.value) : debt * (1 + f.value);', 'const soldValue = f.basis === \'collateralSold\' ? debt / (1 - f.value) : debt;', 'liquidation fee on the debt forgotten'],
  ['src/engine/loan.js', 'const ys = flows.map((f) => (parseDate(f.date) - t0) / DAY / 365);', 'const ys = flows.map((f) => (parseDate(f.date) - t0) / DAY / 360);', 'APR with a 360-day year'],
  ['src/engine/lender.js', 'if (low <= liqPrice) {', 'if (low < liqPrice * 0.999) {', 'liquidation only 0.1% below the sale price'],
  ['src/engine/lender.js', 'if (s.deadline !== null && time >= s.deadline) {', 'if (s.deadline !== null && time > s.deadline) {', 'margin-call deadline one step late'],
  ['src/engine/lender.js', 'if (close <= d / (s.c * rules.mLtv)) {', 'if (low <= d / (s.c * rules.mLtv)) {', 'deadline check on the low instead of the close'],
  ['src/engine/lender.js', 'const proceeds = (debt - rules.target * s.c * price) / (k - rules.target);', 'const proceeds = (debt - rules.target * s.c * price) / (1 - rules.target);', 'partial sale ignores the fee'],
  ['src/engine/lender.js', 'target: terms.cureTargetLtv || terms.initialLtv,', 'target: terms.cureTargetLtv || terms.liquidationLtv,', 'wrong default target LTV'],
  ['src/engine/montecarlo.js', 'const lowLog = logS + lowRel;', 'const lowLog = logS;', 'simulation checks the day\'s open instead of its low'],
  ['src/engine/montecarlo.js', 'hitsByMonth[firstMonthForDay[d]]++;', 'hitsByMonth[Math.max(0, firstMonthForDay[d] - 1)]++;', 'liquidations counted one month early'],
  ['src/engine/replay.js', 'if (hourly.low[j] < lo) lo = hourly.low[j];', 'if (hourly.close[j] < lo) lo = hourly.close[j];', 'history replay uses hourly closes instead of lows'],
  ['src/data/fx.js', 'while (j + 1 < days.length && days[j + 1] <= d) j++;', 'while (j + 1 < days.length && days[j + 1] <= d + 1) j++;', 'exchange rate of the next day used one day early'],
  ['src/app/riskjob.js', 'logDriftPerDay: Math.log(1 + trend) / 365,', 'logDriftPerDay: Math.log(1 + trend) / 36.5,', 'price trend ten times too strong'],
  ['src/app/terms.js', 'const extra = ch.change === \'more\' ? numOr(ch.extra, 0) : 0;', 'const extra = ch.change === \'more\' ? -numOr(ch.extra, 0) : 0;', 'cash-out refinancing lowers the debt'],
  ['src/engine/history.js', 'if (h < tl && low[j] <= k * close[q[h]]) return true;', 'if (h < tl && close[j] <= k * close[q[h]]) return true;', 'fastest fall uses hourly closes instead of lows'],
  ['src/engine/validate.js', 'initialLtv', 'initialLtvX', 'validation reads a field that does not exist (first use)'],
];

let caught = 0; const missed = [];
for (const [file, from, to, what] of M) {
  const path = root + file; const orig = readFileSync(path, 'utf8');
  if (!orig.includes(from)) { console.log(`SKIP (pattern not found) ${what}`); continue; }
  writeFileSync(path, orig.replace(from, to));
  let failed = false;
  try { execSync('npx vitest run --exclude tests/calibration.test.js --bail 1', { cwd: root, stdio: 'pipe', timeout: 300000 }); }
  catch { failed = true; }
  finally { writeFileSync(path, orig); }
  if (failed) caught++; else missed.push(`${file}: ${what}`);
  console.log(`${failed ? 'caught' : 'MISSED'}  ${what}`);
}
console.log(`\n${caught} of ${M.length} planted bugs caught by the tests.`);
if (missed.length) console.log(`Not caught:\n  ${missed.join('\n  ')}`);
