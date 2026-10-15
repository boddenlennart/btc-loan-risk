// Number formatting in the page language.
import { getLang } from './i18n.js';

const locale = () => (getLang() === 'de' ? 'de-DE' : 'en-GB');

export const money = (x, cur, digits = 2) => (Number.isFinite(x)
  ? new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x)
  : '–');
export const money0 = (x, cur) => money(x, cur, 0);
export const pct = (x, digits = 1) => (Number.isFinite(x)
  ? new Intl.NumberFormat(locale(), { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x)
  : '–');
export const num = (x, digits = 2) => (Number.isFinite(x)
  ? new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x)
  : '–');
export const btc = (x) => (Number.isFinite(x) ? `${num(x, x < 0.01 ? 6 : 4)} BTC` : '–');
export const date = (unix) => new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(unix * 1000));
export const dateTime = (unix) => new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }).format(new Date(unix * 1000));
export const isoDate = (s) => new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${s}T00:00:00Z`));
