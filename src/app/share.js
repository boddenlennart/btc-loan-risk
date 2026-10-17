// Share link: the inputs are stored in the part of the link after "#", which browsers
// never send to a server. The BTC price is left out, so whoever opens the link gets the
// current price. A comparison (2-3 offers, or current loan and refinancing) is stored too.

const KEYS = ['mode', 'currency', 'loanAmount', 'ltvInput', 'initialLtv', 'collateralBtc', 'liquidationLtv', 'durationMonths', 'rateType',
  'rateAnnual', 'ratePath', 'purpose', 'repayWith', 'repayment', 'compounding', 'originationFee', 'marginCallLtv', 'marginCallConsequence',
  'curePeriodHours', 'liquidationSale', 'cureTargetLtv', 'liquidationFee', 'liquidationFeeBasis', 'reserveAmount', 'taxRateNow',
  'taxRateAtMaturity', 'dayCount', 'simPaths', 'bootstrapBlockDays', 'refi'];
const pickForm = (f) => Object.fromEntries(KEYS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));

const toB64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeState(state, compare = null) {
  const o = { v: 1, ...pickForm(state) };
  if (compare) o.compare = { kind: compare.kind, active: compare.active, names: compare.names || [], offers: compare.offers.map(pickForm) };
  return `#s=${toB64url(JSON.stringify(o))}`;
}

/** Returns { form, compare } from the link, or null if the hash is missing or broken. Unknown keys are ignored. */
export function decodeLink(hash) {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const o = JSON.parse(fromB64url(m[1]));
    if (!o || o.v !== 1) return null;
    const form = Object.fromEntries(KEYS.filter((k) => k in o).map((k) => [k, o[k]]));
    const c = o.compare;
    const ok = c && ['offers', 'refi'].includes(c.kind) && Array.isArray(c.offers) && c.offers.length >= 2 && c.offers.length <= 3
      && Number.isInteger(c.active) && c.active >= 0 && c.active < c.offers.length;
    const compare = ok ? { kind: c.kind, active: c.active, names: (c.names || []).map((n) => String(n).slice(0, 40)), offers: c.offers.map(pickForm) } : null;
    return { form, compare };
  } catch {
    return null;
  }
}

/** The stored inputs of the (selected) offer, or null. */
export const decodeState = (hash) => { const d = decodeLink(hash); return d ? d.form : null; };
