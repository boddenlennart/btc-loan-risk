// Checks loan terms for impossible or contradictory values.
// Returns { ok, errors: [{ field, code }] }; the page turns each code into a
// plain-language message from the text files (src/content/text.*.js).
import { notImplemented } from './notImplemented.js';

export const ERROR_CODES = [
  'LOAN_AMOUNT_INVALID', 'PRICE_INVALID', 'LTV_OUT_OF_RANGE', 'LIQ_LTV_NOT_ABOVE_INITIAL',
  'LIQ_LTV_TOO_HIGH', 'MARGIN_LTV_OUT_OF_RANGE', 'DURATION_INVALID', 'NEGATIVE_RATE',
  'RATE_PATH_INVALID', 'NEGATIVE_FEE', 'FEE_EXCEEDS_LOAN', 'CURE_NEGATIVE', 'TAX_RATE_INVALID',
  'RESERVE_NEGATIVE', 'CURE_TARGET_INVALID',
];

export const validateTerms = (terms) => notImplemented('validateTerms');
