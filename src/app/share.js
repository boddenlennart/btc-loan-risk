// "Copy link to this calculation": the inputs are stored in the part of the link
// after "#", which browsers never send to a server. The BTC price is left out, so
// whoever opens the link gets the current price.

const KEYS = ['mode', 'currency', 'loanAmount', 'ltvInput', 'initialLtv', 'collateralBtc', 'liquidationLtv', 'durationMonths', 'rateType',
  'rateAnnual', 'ratePath', 'purpose', 'repayWith', 'repayment', 'compounding', 'originationFee', 'marginCallLtv', 'marginCallConsequence',
  'curePeriodHours', 'liquidationSale', 'cureTargetLtv', 'liquidationFee', 'liquidationFeeBasis', 'reserveAmount', 'taxRateNow',
  'taxRateAtMaturity', 'dayCount', 'simPaths', 'bootstrapBlockDays'];

const toB64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeState(state) {
  const pick = Object.fromEntries(KEYS.filter((k) => state[k] !== undefined).map((k) => [k, state[k]]));
  return `#s=${toB64url(JSON.stringify({ v: 1, ...pick }))}`;
}

/** Returns the stored inputs, or null if the hash is missing or broken. Unknown keys are ignored. */
export function decodeState(hash) {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const o = JSON.parse(fromB64url(m[1]));
    if (!o || o.v !== 1) return null;
    return Object.fromEntries(KEYS.filter((k) => k in o).map((k) => [k, o[k]]));
  } catch {
    return null;
  }
}
