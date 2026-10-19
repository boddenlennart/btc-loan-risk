// Form state -> engine terms. Shared by the page (main.js) and the build (tools/build.mjs),
// which computes the example result in advance so the page can show it at once.
export const today = () => new Date().toISOString().slice(0, 10);
export const numOr = (v, d = NaN) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
const pctOrNull = (v) => { const n = numOr(v, null); return n === null ? null : n / 100; };

/** A refinancing offer starts from the current loan (`base`, a form in "a loan I already have"):
 *  the new loan repays today's debt, against the same BTC, changed by one choice:
 *  same amount (rollover or lender switch), borrow more (cash-out) or take back BTC.
 *  Returns the refinancing form as an ordinary new-loan form with the BTC entered. */
export function refiForm(r, base) {
  const ch = r.refi || {};
  const owed = numOr(base.loanAmount); const btc = numOr(base.collateralBtc);
  const extra = ch.change === 'more' ? numOr(ch.extra, 0) : 0;
  const back = ch.change === 'back' ? numOr(ch.back, 0) : 0;
  return { ...r, mode: 'new', ltvInput: 'btc', currency: base.currency, btcPrice: base.btcPrice, startDate: '',
    loanAmount: owed + extra, collateralBtc: String(btc - back) };
}

/** Costs of switching to the refinancing offer that are not part of the new loan itself
 *  (early-repayment fee of the current loan, transfer and other costs), in money. */
export const switchCosts = (r) => (r && r.refi ? numOr(r.refi.exitFee, 0) + numOr(r.refi.transferFee, 0) : 0);

/** Engine terms with the switching costs added to the origination fee, for the cost figures only
 *  (amount received, full cost, yearly rate, breakeven). The simulation keeps the plain terms. */
export function withSwitching(terms, costs) {
  if (!costs) return terms;
  const f = terms.originationFee ?? { type: 'percent', value: 0 };
  const fee = f.type === 'fixed' ? f.value : terms.loanAmount * f.value;
  return { ...terms, originationFee: { type: 'fixed', value: fee + costs } };
}

/** Form state -> engine terms (fractions) and simulation settings.
 *  `base`: for a refinancing offer, the current loan it starts from. */
export function toTerms(form, { base = null } = {}) {
  const s = form.refi && base ? refiForm(form, base) : form;
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
    purpose: existing ? 'spend' : s.purpose, repayWith: s.repayWith, // a loan already running has no money left to invest
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
