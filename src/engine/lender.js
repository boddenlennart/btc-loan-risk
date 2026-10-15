// What the lender does when the BTC price falls. One implementation, used by the
// historical replay (hourly steps) and by the simulations (daily steps), so both
// follow exactly the same rules. Reference: reference/reference_replay.py.
//
// Margin-call behaviour (terms.marginCallConsequence):
//   'warningOnly'        a warning only; nothing is sold at the margin-call LTV
//   'liquidateAfterCure' if the LTV is still at or above the margin-call LTV when the
//                        cure period ends, the lender sells everything (closes the loan)
//   'partialAfterCure'   same, but the lender sells only enough BTC to reach the target LTV
//   'autoPartial'        at the margin-call LTV the lender immediately sells enough BTC
//                        to reach the target LTV; the loan continues
// At the liquidation LTV (terms.liquidationSale):
//   'all' (default)      the lender sells enough BTC to repay everything plus the fee and
//                        returns the rest; the loan ends
//   'partial'            the lender sells only enough BTC to reach the target LTV
// Target LTV = terms.cureTargetLtv, or the starting LTV if empty.
// reserveAmount: money the borrower adds as BTC at the first margin call (at the
// margin-call price), before the lender acts.
//
// A partial sale repays part of the debt. Interest is proportional to the debt, so
// all later debt is scaled down by the same factor ("debt scale").

export function lenderRules(terms) {
  const mLtv = terms.marginCallLtv || null;
  const behaviour = mLtv ? (terms.marginCallConsequence || 'warningOnly') : 'none';
  const fee = terms.liquidationFee ?? { value: 0, basis: 'debt' };
  return {
    mLtv,
    lLtv: terms.liquidationLtv,
    behaviour,
    afterCure: behaviour === 'liquidateAfterCure' || behaviour === 'partialAfterCure',
    // the margin call can happen again after it was dealt with
    rearm: behaviour !== 'warningOnly',
    cureSale: behaviour === 'partialAfterCure' ? 'partial' : 'all',
    liquidationSale: terms.liquidationSale === 'partial' ? 'partial' : 'all',
    target: terms.cureTargetLtv || terms.initialLtv,
    feeValue: fee.value || 0,
    feeBasis: fee.basis === 'collateralSold' ? 'collateralSold' : 'debt',
    reserve: terms.reserveAmount > 0 ? terms.reserveAmount : 0,
  };
}

export function createLoanState(collateral) {
  return { c: collateral, scale: 1, deadline: null, marginCalls: 0, firstMargin: null, topUp: null, partialSales: [], liquidation: null };
}

/** Share of the sale proceeds that repays debt (the rest is the fee). */
const repaidShare = (rules) => (rules.feeBasis === 'collateralSold' ? 1 - rules.feeValue : 1 / (1 + rules.feeValue));

/**
 * Sell just enough BTC at `price` to bring the LTV down to the target.
 * Returns false if that would need all the collateral (then the caller closes the loan).
 */
function partialSale(s, rules, price, debt, time, reason) {
  const k = repaidShare(rules);
  const proceeds = (debt - rules.target * s.c * price) / (k - rules.target);
  if (proceeds <= 0) return true;
  const btc = proceeds / price;
  if (btc >= s.c) return false;
  s.c -= btc;
  s.scale *= (debt - k * proceeds) / debt;
  s.partialSales.push({ time, reason, btc, price });
  return true;
}

function closeLoan(s, rules, price, debt, time, reason, low) {
  const soldValue = rules.feeBasis === 'collateralSold' ? debt / (1 - rules.feeValue) : debt * (1 + rules.feeValue);
  const btcSold = Math.min(s.c, soldValue / price);
  s.liquidation = { time, low, price, reason, btcSold, btcReturned: s.c - btcSold };
}

/**
 * One time step. debt = scheduled debt for this step (before any partial sale);
 * low/close = lowest and last price in the step; time and cure in the caller's units
 * (seconds for the replay, days for the simulation).
 */
export function stepLoan(s, rules, { time, low, close, debt, cure }) {
  if (s.liquidation) return;
  const d = debt * s.scale;
  const liqPrice = d / (s.c * rules.lLtv);
  if (low <= liqPrice) {
    if (!s.firstMargin && rules.mLtv) { s.firstMargin = { time, low }; s.marginCalls++; }
    if (rules.liquidationSale === 'partial' && partialSale(s, rules, liqPrice, d, time, 'liquidationLtv')) { s.deadline = null; return; }
    closeLoan(s, rules, liqPrice, d, time, 'liquidationLtv', low);
    return;
  }
  if (s.deadline !== null && time >= s.deadline) {
    if (close <= d / (s.c * rules.mLtv)) {
      s.deadline = null;
      if (rules.cureSale === 'partial' && partialSale(s, rules, close, d, time, 'cureExpired')) return;
      closeLoan(s, rules, close, d, time, 'cureExpired', low);
      return;
    }
    s.deadline = null;
  }
  if (!rules.mLtv || s.deadline !== null) return;
  if (s.firstMargin && !rules.rearm) return;
  const mcPrice = d / (s.c * rules.mLtv);
  if (low > mcPrice) return;
  s.marginCalls++;
  if (!s.firstMargin) s.firstMargin = { time, low };
  if (rules.reserve && !s.topUp) {
    s.topUp = { time, btc: rules.reserve / mcPrice, price: mcPrice };
    s.c += s.topUp.btc;
  }
  if (d / (s.c * mcPrice) < rules.mLtv - 1e-12) return; // the top-up fixed it
  if (rules.afterCure) s.deadline = time + cure;
  else if (rules.behaviour === 'autoPartial') partialSale(s, rules, mcPrice, d, time, 'autoPartial');
}

/** Price below which this step needs a closer look (any rule could act). */
export function watchPrice(s, rules, debt) {
  const d = debt * s.scale;
  if (rules.mLtv && (!s.firstMargin || rules.rearm)) return d / (s.c * rules.mLtv);
  return d / (s.c * rules.lLtv);
}

/** BTC a partial sale at `price` would take to bring the LTV back to the target (for display). */
export function partialSaleBtc(rules, debt, collateral, price) {
  const k = repaidShare(rules);
  const proceeds = (debt - rules.target * collateral * price) / (k - rules.target);
  return Math.max(0, Math.min(collateral, proceeds / price));
}
