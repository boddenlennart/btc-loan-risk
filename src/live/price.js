// Fetches today's BTC price from a chain of public sources, falling back to the
// last known price embedded in the page. Never sends anything about the user.
import { notImplemented } from '../engine/notImplemented.js';

export const SOURCES = ['coinbase', 'kraken', 'binance', 'coingecko'];

/** Returns { price, source, time, stale }. fetchImpl and timeoutMs are injectable for tests. */
export const getSpotPrice = (currency, { fetchImpl, timeoutMs, embedded }) => notImplemented('getSpotPrice');
