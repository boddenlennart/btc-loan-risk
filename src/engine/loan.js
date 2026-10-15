// Loan arithmetic: payment schedule, totals, APR, collateral, trigger prices.
// Amounts are in the loan currency; LTVs, rates and fees are fractions (0.5 = 50%).
// Rules are documented in reference/reference_loan.py and must match it to the cent.

/** Round to cents, halves away from zero (like spreadsheet ROUND). */
export function round2(x) {
  const s = x >= 0 ? 1 : -1;
  return (s * Math.floor(Math.abs(x) * 100 + 0.5 + 1e-9)) / 100;
}

const DAY = 86400000;
const parseDate = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Calendar month arithmetic from a fixed start; day clamped to the month's end (like EDATE). */
export function addMonths(iso, n) {
  const d = new Date(parseDate(iso));
  const m = d.getUTCMonth() + n;
  const y = d.getUTCFullYear() + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
  return isoDate(Date.UTC(y, mm, Math.min(d.getUTCDate(), lastDay)));
}

export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);

/** Yearly rate that applies in period i (0-based). */
export function rateFor(terms, i) {
  if (terms.rate.type !== 'variable') return terms.rate.annual;
  let r = terms.rate.path[0].annual;
  for (const step of terms.rate.path) if (step.fromMonth <= i) r = step.annual;
  return r;
}

function periodInterest(balance, annual, days, dayCount) {
  if (dayCount === 'act/365') return (balance * annual * days) / 365;
  if (dayCount === 'act/360') return (balance * annual * days) / 360;
  return (balance * annual) / 12; // '30/360', the preset
}

// Equal payment for n periods. 1 - (1 + r)^-n is written with expm1/log1p, which stays
// accurate for rates close to 0 (the plain formula breaks down there).
function pmt(rate, n, pv) {
  if (rate === 0) return pv / n;
  return (pv * rate) / -Math.expm1(-n * Math.log1p(rate));
}

/** Monthly schedule rows: { month, date, rate, days, interest, principal, payment, balanceAfter }. */
export function buildSchedule(terms) {
  const n = terms.durationMonths;
  const dayCount = terms.dayCount ?? '30/360';
  let bal = terms.loanAmount;
  let accrued = 0;
  let payment = null;
  let lastRate = null;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const p0 = addMonths(terms.startDate, i);
    const p1 = addMonths(terms.startDate, i + 1);
    const days = daysBetween(p0, p1);
    const annual = rateFor(terms, i);
    const last = i === n - 1;
    if (terms.repayment === 'bullet') {
      const base = bal + (terms.compounding === 'monthly' ? accrued : 0);
      const interest = round2(periodInterest(base, annual, days, dayCount));
      accrued = round2(accrued + interest);
      rows.push({
        month: i + 1, date: p1, rate: annual, days, interest,
        principal: last ? round2(bal) : 0,
        payment: last ? round2(bal + accrued) : 0,
        balanceAfter: last ? 0 : round2(bal + accrued),
      });
    } else if (terms.repayment === 'amortizing') {
      if (payment === null || annual !== lastRate) {
        payment = round2(pmt(annual / 12, n - i, bal));
        lastRate = annual;
      }
      const interest = round2(periodInterest(bal, annual, days, dayCount));
      const pay = last ? round2(bal + interest) : payment;
      const principal = round2(pay - interest);
      bal = round2(bal - principal);
      rows.push({ month: i + 1, date: p1, rate: annual, days, interest, principal, payment: pay, balanceAfter: bal });
    } else { // interestOnly
      const interest = round2(periodInterest(bal, annual, days, dayCount));
      const principal = last ? bal : 0;
      rows.push({
        month: i + 1, date: p1, rate: annual, days, interest, principal: round2(principal),
        payment: round2(interest + principal), balanceAfter: round2(bal - principal),
      });
      bal = round2(bal - principal);
    }
  }
  return rows;
}

export function originationFeeAmount(terms) {
  const f = terms.originationFee ?? { type: 'percent', value: 0 };
  return f.type === 'fixed' ? round2(f.value) : round2(terms.loanAmount * f.value);
}

/** XIRR: yearly rate r with sum(amount / (1 + r)^(days / 365)) = 0, found by bisection. */
export function xirr(flows) {
  const t0 = parseDate(flows[0].date);
  const ys = flows.map((f) => (parseDate(f.date) - t0) / DAY / 365);
  const npv = (r) => flows.reduce((s, f, i) => s + f.amount / (1 + r) ** ys[i], 0);
  let lo = -0.99;
  let hi = 10;
  for (let k = 0; k < 300; k++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** { schedule, originationFee, amountReceived, totalInterest, totalPayback, totalCost, interestShareOfPayback, effectiveApr } */
export function loanSummary(terms) {
  const schedule = buildSchedule(terms);
  const originationFee = originationFeeAmount(terms);
  const totalInterest = round2(schedule.reduce((s, r) => s + r.interest, 0));
  const totalPayback = round2(schedule.reduce((s, r) => s + r.payment, 0));
  const amountReceived = round2(terms.loanAmount - originationFee);
  const flows = [{ date: terms.startDate, amount: amountReceived }]
    .concat(schedule.filter((r) => r.payment).map((r) => ({ date: r.date, amount: -r.payment })));
  return {
    schedule, originationFee, amountReceived, totalInterest, totalPayback,
    totalCost: round2(totalPayback - terms.loanAmount + originationFee),
    interestShareOfPayback: totalInterest / totalPayback,
    effectiveApr: xirr(flows),
  };
}

/** BTC you must pledge: loanAmount / (initialLtv * btcPrice). */
export const collateralBtc = (terms) => terms.loanAmount / (terms.initialLtv * terms.btcPrice);

/** Number of calendar days from start to maturity. */
export const loanDays = (terms) => daysBetween(terms.startDate, addMonths(terms.startDate, terms.durationMonths));

/**
 * Debt (principal + interest owed but not yet paid, growing day by day) for
 * each day 0..days. The last value is the debt just before the final payment.
 */
export function debtByDay(terms, schedule = buildSchedule(terms)) {
  const days = loanDays(terms);
  const out = new Float64Array(days + 1);
  let principalBefore = terms.loanAmount;
  let accruedBefore = 0;
  let d = 0;
  for (let i = 0; i < schedule.length; i++) {
    const d0 = daysBetween(terms.startDate, addMonths(terms.startDate, i));
    const d1 = daysBetween(terms.startDate, addMonths(terms.startDate, i + 1));
    const last = i === schedule.length - 1;
    for (; d < d1 || (last && d === d1); d++) {
      out[d] = principalBefore + accruedBefore + (schedule[i].interest * (d - d0)) / (d1 - d0);
    }
    if (terms.repayment === 'bullet') accruedBefore += schedule[i].interest;
    else principalBefore -= schedule[i].principal;
  }
  return out;
}

function triggerPrices(terms, ltv) {
  const btc = collateralBtc(terms);
  const byDay = debtByDay(terms).map((debt) => debt / (btc * ltv));
  return { atStart: byDay[0], atMaturity: byDay[byDay.length - 1], byDay };
}

/** { atStart, atMaturity, byDay } price at which the lender liquidates. */
export const liquidationPrices = (terms) => triggerPrices(terms, terms.liquidationLtv);

/** Same as liquidationPrices but for the margin-call LTV; null if the offer has none. */
export const marginCallPrices = (terms) => (terms.marginCallLtv ? triggerPrices(terms, terms.marginCallLtv) : null);

/** How far BTC can fall from today's price before liquidation, as a fraction (0.375 = 37.5%). */
export const dropToLiquidation = (terms) => 1 - liquidationPrices(terms).atStart / terms.btcPrice;

/** At a margin call: { btc, value } extra collateral to get back to targetLtv, and { repayInstead } cash alternative. */
export function topUpToCure(terms, { price, debt, targetLtv, collateral = collateralBtc(terms) }) {
  const btc = Math.max(0, debt / (targetLtv * price) - collateral);
  return { btc, value: btc * price, repayInstead: Math.max(0, debt - targetLtv * collateral * price) };
}

/** If liquidated at `price` with `debt` owed: { btcSold, btcReturned, feeAmount, valueReturned }. */
export function costIfLiquidated(terms, { price, debt, collateral = collateralBtc(terms) }) {
  const f = terms.liquidationFee ?? { value: 0, basis: 'debt' };
  const soldValue = f.basis === 'collateralSold' ? debt / (1 - f.value) : debt * (1 + f.value);
  const btcSold = Math.min(collateral, soldValue / price);
  const btcReturned = collateral - btcSold;
  return { btcSold, btcReturned, feeAmount: soldValue - debt, valueReturned: btcReturned * price };
}

/**
 * BTC price change over the loan needed for borrowing to beat selling now
 * (0.12 = +12%). Assumes the loan is repaid by selling BTC at maturity:
 * borrowing wins if  totalPayback / ((1 - taxAtMaturity) x P_end)  <  received / ((1 - taxNow) x P_now).
 */
export function breakevenReturn(terms, { taxRateNow = 0, taxRateAtMaturity = 0 } = {}) {
  const s = loanSummary(terms);
  return (s.totalPayback * (1 - taxRateNow)) / (s.amountReceived * (1 - taxRateAtMaturity)) - 1;
}

/** Cost to repay everything at the end of `month`, including the early-repayment fee. */
export function earlyRepaymentCost(terms, month) {
  const rows = buildSchedule(terms);
  const outstanding = month <= 0 ? terms.loanAmount : rows[Math.min(month, rows.length) - 1].balanceAfter;
  return round2(outstanding * (1 + (terms.earlyRepaymentFee ?? 0)));
}
