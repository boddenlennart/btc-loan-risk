// Form state -> engine terms. Shared by the page (main.js) and the build (tools/build.mjs),
// which computes the example result in advance so the page can show it at once.
export const today = () => new Date().toISOString().slice(0, 10);
export const numOr = (v, d = NaN) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
const pctOrNull = (v) => { const n = numOr(v, null); return n === null ? null : n / 100; };

/** Form state -> engine terms (fractions) and simulation settings. */
export function toTerms(s) {
  const price = numOr(s.btcPrice);
  const existing = s.mode === 'existing';
  const amount = numOr(s.loanAmount);
  const byBtc = existing || s.ltvInput === 'btc';
  const collateralInput = numOr(s.collateralBtc);
  const fee = s.originationFee;
  const terms = {
    mode: s.mode, ltvInput: s.ltvInput, collateralInput,
    currency: s.currency, btcPrice: price, loanAmount: amount, startDate: existing ? today() : (s.startDate || today()),
    durationMonths: numOr(s.durationMonths),
    initialLtv: byBtc ? amount / (collateralInput * price) : numOr(s.initialLtv) / 100,
    marginCallLtv: pctOrNull(s.marginCallLtv),
    liquidationLtv: numOr(s.liquidationLtv) / 100,
    rate: s.rateType === 'variable'
      ? { type: 'variable', path: s.ratePath.map((r) => ({ fromMonth: numOr(r.fromMonth), annual: numOr(r.rate) / 100 })) }
      : { type: 'fixed', annual: numOr(s.rateAnnual) / 100 },
    repayment: s.repayment, compounding: s.repayment === 'bullet' ? s.compounding : 'none', dayCount: s.dayCount,
    originationFee: existing ? { type: 'percent', value: 0 } : { type: fee.type, value: fee.type === 'percent' ? numOr(fee.value) / 100 : numOr(fee.value) },
    liquidationFee: { value: numOr(s.liquidationFee) / 100, basis: s.liquidationFeeBasis },
    earlyRepaymentFee: 0,
    curePeriodHours: numOr(s.curePeriodHours, 0), marginCallConsequence: s.marginCallConsequence, liquidationSale: s.liquidationSale,
    cureTargetLtv: pctOrNull(s.cureTargetLtv) ?? (existing ? 0.5 : null), reserveAmount: numOr(s.reserveAmount, 0),
    taxRateNow: (pctOrNull(s.taxRateNow) ?? 0), taxRateAtMaturity: (pctOrNull(s.taxRateAtMaturity) ?? 0),
    purpose: s.purpose, repayWith: s.repayWith,
  };
  const settings = {
    nPaths: Number(s.simPaths) || 10000,
    blockDays: Math.max(1, Math.round(numOr(s.bootstrapBlockDays, 30))),
    trend: 0, // the page always assumes no trend; the trend comparison is computed separately
  };
  return { terms, settings };
}


/** Everything that changes the liquidation chance, except the BTC price and the start date
 *  (with the LTV fixed, the chance does not depend on the price level). Two states with the
 *  same key have the same answer. */
export function exampleKey(s) {
  const { terms, settings } = toTerms(s);
  const { btcPrice, startDate, collateralInput, ...rest } = terms;
  return JSON.stringify({ ...rest, initialLtv: Math.round(rest.initialLtv * 1e6) / 1e6, settings });
}
