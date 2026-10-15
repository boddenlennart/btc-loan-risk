// Checks loan terms for impossible or contradictory values.
// Returns { ok, errors: [{ field, code }] }; the page turns each code into a
// plain-language message from the text files (src/content/text.*.js).

export const ERROR_CODES = [
  'LOAN_AMOUNT_INVALID', 'PRICE_INVALID', 'LTV_OUT_OF_RANGE', 'LIQ_LTV_NOT_ABOVE_INITIAL',
  'LIQ_LTV_TOO_HIGH', 'MARGIN_LTV_OUT_OF_RANGE', 'DURATION_INVALID', 'NEGATIVE_RATE',
  'RATE_PATH_INVALID', 'NEGATIVE_FEE', 'FEE_EXCEEDS_LOAN', 'CURE_NEGATIVE', 'TAX_RATE_INVALID',
  'RESERVE_NEGATIVE', 'CURE_TARGET_INVALID',
];

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const empty = (x) => x === null || x === undefined || x === '';

export function validateTerms(t) {
  const errors = [];
  const add = (field, code) => errors.push({ field, code });

  if (!num(t.loanAmount) || t.loanAmount <= 0) add('loanAmount', 'LOAN_AMOUNT_INVALID');
  if (!num(t.btcPrice) || t.btcPrice <= 0) add('btcPrice', 'PRICE_INVALID');

  const initialOk = num(t.initialLtv) && t.initialLtv > 0 && t.initialLtv < 1;
  if (!initialOk) add('initialLtv', 'LTV_OUT_OF_RANGE');
  const liqNum = num(t.liquidationLtv);
  if (!liqNum || t.liquidationLtv > 1) add('liquidationLtv', 'LIQ_LTV_TOO_HIGH');
  else if (initialOk && t.liquidationLtv <= t.initialLtv) add('liquidationLtv', 'LIQ_LTV_NOT_ABOVE_INITIAL');

  if (!empty(t.marginCallLtv)) {
    if (!num(t.marginCallLtv) || (initialOk && t.marginCallLtv <= t.initialLtv) || (liqNum && t.marginCallLtv >= t.liquidationLtv)) {
      add('marginCallLtv', 'MARGIN_LTV_OUT_OF_RANGE');
    }
  }

  if (!Number.isInteger(t.durationMonths) || t.durationMonths < 1) add('durationMonths', 'DURATION_INVALID');

  const rate = t.rate ?? {};
  if (rate.type === 'variable') {
    const p = Array.isArray(rate.path) ? rate.path : [];
    const months = p.map((s) => s.fromMonth);
    const ordered = months.every((m, i) => Number.isInteger(m) && (i === 0 ? m === 0 : m > months[i - 1]));
    const inside = months.every((m) => !Number.isInteger(t.durationMonths) || m < t.durationMonths);
    if (!p.length || !ordered || !inside) add('rate', 'RATE_PATH_INVALID');
    if (p.some((s) => !num(s.annual) || s.annual < 0)) add('rate', 'NEGATIVE_RATE');
  } else if (!num(rate.annual) || rate.annual < 0) add('rate', 'NEGATIVE_RATE');

  const of = t.originationFee ?? { type: 'percent', value: 0 };
  if (!num(of.value) || of.value < 0) add('originationFee', 'NEGATIVE_FEE');
  else if (num(t.loanAmount) && t.loanAmount > 0) {
    const fee = of.type === 'fixed' ? of.value : of.value * t.loanAmount;
    if (fee >= t.loanAmount) add('originationFee', 'FEE_EXCEEDS_LOAN');
  }
  const lf = t.liquidationFee ?? { value: 0 };
  if (!num(lf.value) || lf.value < 0 || lf.value >= 1) add('liquidationFee', 'NEGATIVE_FEE');
  if (!empty(t.earlyRepaymentFee) && (!num(t.earlyRepaymentFee) || t.earlyRepaymentFee < 0)) add('earlyRepaymentFee', 'NEGATIVE_FEE');

  if (!empty(t.curePeriodHours) && (!num(t.curePeriodHours) || t.curePeriodHours < 0)) add('curePeriodHours', 'CURE_NEGATIVE');
  if (!empty(t.cureTargetLtv)) {
    const cap = !empty(t.marginCallLtv) ? t.marginCallLtv : t.liquidationLtv;
    if (!num(t.cureTargetLtv) || t.cureTargetLtv <= 0 || (num(cap) && t.cureTargetLtv >= cap)) add('cureTargetLtv', 'CURE_TARGET_INVALID');
  }
  if (!empty(t.reserveAmount) && (!num(t.reserveAmount) || t.reserveAmount < 0)) add('reserveAmount', 'RESERVE_NEGATIVE');
  for (const f of ['taxRateNow', 'taxRateAtMaturity']) {
    if (!empty(t[f]) && (!num(t[f]) || t[f] < 0 || t[f] >= 1)) add(f, 'TAX_RATE_INVALID');
  }
  return { ok: errors.length === 0, errors };
}
