// Starting values for the form. Made-up round numbers so they can never be mistaken
// for a real lender's quote. The banner "Example values. Replace them with your offer."
// stays until the visitor changes one of the five main numbers.
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
  marginCallConsequence: 'liquidateAfterCure',
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
  notes: '',
};

// kept for the content test: every example is marked as such
export const EXAMPLE_TERMS = EXAMPLE_FORM;
