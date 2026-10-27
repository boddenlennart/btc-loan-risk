// Starting values for the form. Made-up round numbers so they can never be mistaken
// for a real lender's quote. The answer is labelled "Example" and told as a story
// until the visitor changes one of the five main numbers. The build computes its result in
// advance (tools/build.mjs), so it appears at once.
// Percentages are in percent here (50 = 50%), as typed in the form.

export const EXAMPLE_FORM = {
  isExample: true,
  mode: 'new',
  currency: 'EUR',
  loanAmount: 10000,
  ltvInput: 'ltv',
  initialLtv: 50,
  collateralBtc: '',
  liquidationLtv: 80,
  durationMonths: 12,
  rateType: 'fixed',
  rateAnnual: 10,
  ratePath: [{ fromMonth: 0, rate: 8 }, { fromMonth: 6, rate: 12 }],
  purpose: 'spend',
  repayWith: 'sell',
  repayment: 'interestOnly',
  compounding: 'none',
  originationFee: { value: 1, type: 'percent' },
  marginCallLtv: 70,
  marginCallConsequence: 'warningOnly', // a sale only at the liquidation LTV (decision 022); the time to top up below then has no effect
  curePeriodHours: 48,
  liquidationSale: 'all',
  cureTargetLtv: '',
  liquidationFee: 5,
  liquidationFeeBasis: 'debt',
  reserveAmount: 0,
  taxRateNow: 0,
  taxRateAtMaturity: 0,
  startDate: '',
  dayCount: '30/360',
  simPaths: '10000',
  bootstrapBlockDays: 30,
};

// kept for the content test: every example is marked as such
export const EXAMPLE_TERMS = EXAMPLE_FORM;
