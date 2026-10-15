// Starting values for the form. These are made-up round numbers so they can
// never be mistaken for a real lender's quote. Every field shows the badge
// "example, replace with your offer" until the visitor changes it.
// Percentages are stored as fractions (0.5 = 50%).

export const EXAMPLE_TERMS = {
  isExample: true,
  currency: 'EUR',
  btcPrice: null, // filled with the live (or embedded) price
  loanAmount: 10000,
  startDate: null, // today
  durationMonths: 12,
  initialLtv: 0.5,
  marginCallLtv: 0.7,
  liquidationLtv: 0.8,
  rate: { type: 'fixed', annual: 0.1, path: [{ fromMonth: 0, annual: 0.08 }, { fromMonth: 6, annual: 0.12 }] },
  repayment: 'interestOnly',
  compounding: 'none',
  dayCount: '30/360',
  originationFee: { type: 'percent', value: 0.01 },
  liquidationFee: { value: 0.05, basis: 'debt' },
  earlyRepaymentFee: 0,
  curePeriodHours: 72,
  marginCallConsequence: 'warningOnly',
  cureTargetLtv: null, // empty = back to the starting LTV
  reserveAmount: 2000,
  taxRateNow: 0,
  taxRateAtMaturity: 0,
  taxJurisdiction: '',
  notes: '',
  simPaths: 10000,
  bootstrapBlockDays: 30,
  assumedTrend: 0,
};
