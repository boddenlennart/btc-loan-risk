// Loan arithmetic: payment schedule, totals, APR, collateral, trigger prices.
// Amounts are in the loan currency; LTVs, rates and fees are fractions (0.5 = 50%).
// Rules are documented in reference/reference_loan.py and must match it to the cent.
import { notImplemented } from './notImplemented.js';

/** Monthly schedule rows: { month, date, rate, days, interest, principal, payment, balanceAfter }. */
export const buildSchedule = (terms) => notImplemented('buildSchedule');

/** { schedule, originationFee, amountReceived, totalInterest, totalPayback, totalCost, interestShareOfPayback, effectiveApr } */
export const loanSummary = (terms) => notImplemented('loanSummary');

/** BTC you must pledge: loanAmount / (initialLtv * btcPrice). */
export const collateralBtc = (terms) => notImplemented('collateralBtc');

/** Debt (principal + unpaid interest, growing day by day) for each day 0..days of the loan. */
export const debtByDay = (terms) => notImplemented('debtByDay');

/** { atStart, atMaturity, byDay } price at which the lender liquidates. */
export const liquidationPrices = (terms) => notImplemented('liquidationPrices');

/** Same as liquidationPrices but for the margin-call LTV; null if the offer has none. */
export const marginCallPrices = (terms) => notImplemented('marginCallPrices');

/** How far BTC can fall from today's price before liquidation, as a fraction (0.375 = 37.5%). */
export const dropToLiquidation = (terms) => notImplemented('dropToLiquidation');

/** At a margin call: { btc, value } extra collateral to get back to targetLtv, and { repayInstead } cash alternative. */
export const topUpToCure = (terms, { price, debt, targetLtv }) => notImplemented('topUpToCure');

/** If liquidated at `price` with `debt` owed: { btcSold, btcReturned, feeAmount, valueReturned }. */
export const costIfLiquidated = (terms, { price, debt }) => notImplemented('costIfLiquidated');

/** BTC price change over the loan needed for borrowing to beat selling now (0.12 = +12%). */
export const breakevenReturn = (terms, { taxRateNow, taxRateAtMaturity }) => notImplemented('breakevenReturn');

/** Cost to repay everything at the end of `month`, including the early-repayment fee. */
export const earlyRepaymentCost = (terms, month) => notImplemented('earlyRepaymentCost');
