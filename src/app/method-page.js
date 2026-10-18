// "How it works": how the numbers are made, shown on the example loan. The example's results are
// computed by the build (tools/build.mjs) with the page's own calculation, so this page needs
// no price history and no background calculation. No wording lives here.
import { initLang, t, texts, rich, esc } from './i18n.js';
import { money0, pct, num, date } from './format.js';
import { fanChart, barChart } from './charts.js';
import { initShell, renderShell } from './shell.js';
import { SITE } from '../content/site.js';
import { liquidationPrices } from '../engine/loan.js';

const META = JSON.parse(document.getElementById('meta').textContent);
const $ = (sel) => document.querySelector(sel);
const of100 = (p) => Math.round(p * 100);
const signedPct = (x, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x), d)}`; // a real minus sign, as everywhere else
const list = (items) => items.map((x) => `<li>${rich(x)}</li>`).join('');

function render() {
  const tx = texts(); const M = tx.method; const ex = META.example; const r = ex.result; const tm = ex.terms; const cur = tm.currency;
  document.title = M.metaTitle;
  renderShell();
  $('#steps-list').innerHTML = list(M.steps);
  $('#example-note').textContent = t('method.example', {
    story: t('results.exampleStory', { amount: money0(tm.loanAmount, cur), months: tm.durationMonths, value: money0(tm.loanAmount / tm.initialLtv, cur), ltv: pct(tm.initialLtv, 0), liq: pct(tm.liquidationLtv, 0) }),
  });
  const lp = liquidationPrices(tm);
  const liqByMonth = [0, ...r.fanByMonth.map((f) => f.day)].map((d) => lp.byDay[d]);
  const monthLabel = (m) => (m === 0 ? t('ui.today') : t('ui.monthN', { n: m }));
  fanChart($('#fan-chart'), { s0: tm.btcPrice, fan: r.fanByMonth, liq: liqByMonth, fmt: (v) => money0(v, cur), monthLabel, labels: { title: M.fanTitle, ...M.fanTip, liq: tx.falls.ladderSale } });
  barChart($('#months-chart'), { values: r.cumulativeByMonth.map((x) => x * 100), fmtPct: (v) => `${Math.round(v)}`, monthLabel: (m) => t('ui.monthN', { n: m }), title: M.byMonthTitle });
  $('#methods-list').innerHTML = list(M.methods);
  const rows = M.compareRows;
  $('#compare').innerHTML = `<table><tbody>
    <tr><th scope="row">${esc(rows.bootstrap)}</th><td>${of100(r.bootstrap)}</td></tr>
    <tr><th scope="row">${esc(rows.garch)}</th><td>${of100(r.garch)}</td></tr>
    <tr><th scope="row">${esc(rows.replay)}</th><td>${of100(r.replay)}</td></tr>
    <tr><th scope="row">${esc(rows.barrier)}</th><td>${of100(r.barrier.p)}</td></tr></tbody></table>
    <p class="hint">${esc(t('method.barrierNote', { sigma: pct(r.barrier.sigma, 0) }))}</p>
    <p class="hint">${esc(t('method.settings', { paths: num(r.nPaths, 0), block: r.blockDays, from: date(r.history.from), to: date(r.history.to) }))}</p>`;
  $('#data-list').innerHTML = list(M.data);
  const p = META.prices[cur];
  $('#data-period').textContent = t('ui.dataThrough', { from: date(p.from), to: date(p.to), updated: date(META.dataUpdated || p.to) });
  const f = r.facts; const by = f.fourYearByStart; const a = by[0]; const z = by[by.length - 1];
  $('#trend-facts').innerHTML = `<p>${esc(t('history.trendUncertainty', { estimate: signedPct(f.trendRange.estimate), low: signedPct(f.trendRange.low), high: signedPct(f.trendRange.high) }))}</p>
    <p>${esc(t('history.trendPast', { worst: signedPct(f.fourYear.worst), median: signedPct(f.fourYear.median), best: signedPct(f.fourYear.best), firstFrom: a.from, firstTo: a.to, firstRate: signedPct(a.perYear), lastFrom: z.from, lastTo: z.to, lastRate: signedPct(z.perYear) }))}</p>
    <p>${esc(t('history.trendSwings', { deep: f.deepYears, years: f.years }))}</p>`;
  $('#limits-list').innerHTML = list(M.limits);
  const [before, after] = M.code.split('{link}');
  $('#code-line').innerHTML = `${esc(before)}<a href="${SITE.codeUrl}" rel="noopener">${esc(SITE.codeUrl.replace('https://', ''))}</a>${esc(after || '')}`;
  $('#verify-list').innerHTML = list(M.verify);
  document.body.dataset.ready = '1';
}

initLang();
initShell({ built: META.built });
render();
