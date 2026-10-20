// "How it works": how the numbers are made, on the example loan. Every figure is computed by the build
// (tools/build.mjs, src/app/method-data.js) with the page's own calculation on the embedded history, so
// this page needs no price history and no background calculation. No wording lives here.
import { initLang, t, texts, rich, esc, pageHref } from './i18n.js';
import { money0, pct, num, date } from './format.js';
import { fanChart, barChart, onePathChart, volChart } from './charts.js';
import { initShell, renderShell } from './shell.js';
import { SITE } from '../content/site.js';
import { CALIBRATION } from '../content/calibration.js';
import { liquidationPrices, dropToLiquidation, loanSummary } from '../engine/loan.js';

const META = JSON.parse(document.getElementById('meta').textContent);
const $ = (sel) => document.querySelector(sel);
const of100 = (p) => Math.round(p * 100);
let shownP = null; let shownN = null; // the example's number exactly as the check page rounds it
const show = (p) => (shownP !== null && Math.abs(p - shownP) < 1e-12 ? shownN : of100(p));
const signedPct = (x, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x), d)}`; // a real minus sign, as everywhere else
const list = (items) => items.map((x) => `<li>${rich(x)}</li>`).join('');
const monthYear = (unix) => new Intl.DateTimeFormat(document.documentElement.lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(unix * 1000));
const codeLink = (path) => `${SITE.codeUrl}/blob/main/${path}`;
// links to other websites (GitHub) open in a new tab, so this page stays open; screen readers hear that
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗<span class="visually-hidden">${esc(texts().ui.newTab)}</span></a>`;

function render() {
  const tx = texts(); const M = tx.method; const ex = META.example; const r = ex.result; const md = ex.method; const tm = ex.terms; const cur = tm.currency;
  shownP = md.p; shownN = md.shown;
  document.title = M.metaTitle;
  renderShell();
  const story = t('results.exampleStory', { amount: money0(tm.loanAmount, cur), months: tm.durationMonths, value: money0(tm.loanAmount / tm.initialLtv, cur), ltv: pct(tm.initialLtv, 0), liq: pct(tm.liquidationLtv, 0) });
  const monthLabel = (m) => (m === 0 ? t('ui.today') : t('ui.monthN', { n: m }));

  // 1. one simulated future, piece by piece
  const op = md.onePath;
  $('#one-lead').textContent = t('method.oneLead', { story, drop: pct(dropToLiquidation(tm), 1) });
  if (op) {
    const pieceOf = (day) => op.pieces.reduce((a, p) => (p.fromDay <= day ? p : a), op.pieces[0]);
    onePathChart($('#one-chart'), {
      weekly: op.weekly, days: op.days, liq: op.liq, mc: op.mc, event: op.event, fmt: (v) => money0(v, cur), monthLabel,
      pieces: op.pieces.map((p) => ({ fromDay: p.fromDay, label: monthYear(p.origin) })),
      labels: { title: M.oneChartTitle, liq: tx.falls.ladderSale, margin: tx.falls.ladderMargin, piece: (origin) => t('method.onePiece', { origin }) },
    });
    const why = op.event ? (M.oneWhy[op.event.kind] || M.oneWhy.liquidationLtv).replace('{hours}', tm.curePeriodHours) : '';
    const v = { first: monthYear(op.pieces[0].origin), day: op.event ? op.event.day : '–', crash: op.event ? monthYear(pieceOf(op.event.day - 1).origin) : '–', why };
    $('#one-steps').innerHTML = M.oneSteps.map((s) => `<li>${esc(s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`))}</li>`).join('');
  }

  // 2. which volatility
  volChart($('#vol-chart'), {
    rows: md.volByYear, sim: md.simVol, fmtPct: (x) => pct(x, 0),
    labels: { title: M.volChartTitle, sim: t('method.volSim', { vol: pct(md.simVol, 0) }), tip: (year, vol, weight) => t(year === md.volByYear.at(-1).year ? 'method.volTipSoFar' : 'method.volTip', { year, vol: pct(vol, 0), weight: pct(weight, 1) }) },
  });
  $('#vol-chart').nextElementSibling.textContent = t('method.volChartNote', { h: md.halfLifeYears });
  $('#vol-why').textContent = t('method.volWhy', { pre: pct(md.sharePre2019, 0) });
  const rowName = (w) => (w.id === 'equal' ? M.volRows.equal : w.id === 'since2022' ? M.volRows.since2022 : `${t('method.volRows.half', { n: w.halfLifeYears })}${w.current ? ` ${M.volRows.current}` : ''}`);
  $('#vol-table').innerHTML = `<thead><tr>${M.volHead.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${md.weighting.map((w) => `<tr${w.current ? ' class="us"' : ''}><th scope="row">${esc(rowName(w))}</th><td>${pct(w.vol, 0)}</td><td>${show(w.p)}</td></tr>`).join('')}</tbody>`;
  $('#vol-limit').textContent = M.volLimit;
  $('#vol-wrap').setAttribute('aria-label', M.volHead[0]); $('#methods-wrap').setAttribute('aria-label', M.methodsHead[0]); // unique names for the scrollable tables

  // 3. from 10,000 futures to the number
  const shown = md.shown;
  $('#num-dots').innerHTML = `<div class="dots" role="img" aria-label="${esc(`${shown} / 100`)}">${Array.from({ length: 100 }, (_, i) => `<i class="${i < shown ? 'd-liq' : 'd-none'}"></i>`).join('')}</div>`;
  const nv = { k: num(Math.round(md.p * md.nPaths), 0), n: num(md.nPaths, 0), p: num(md.p * 100, 1), shown, ci: num(1.96 * md.se * 100, 1) };
  $('#num-list').innerHTML = M.num.map((s) => `<li>${esc(s.replace(/\{(\w+)\}/g, (_, k) => nv[k] ?? `{${k}}`))}</li>`).join('');

  // 4. the lender's rules in the simulation
  const dl = (d) => show(md.deadline.find((x) => x.days === d).p);
  const rv = { d1: dl(1), d2: dl(2), d3: dl(3), none: of100(md.noMarginCall), median: pct(md.gap.median, 1), p90: pct(md.gap.p90, 0) };
  $('#rules-list').innerHTML = M.rules.map((s) => `<li>${esc(s.replace(/\{(\w+)\}/g, (_, k) => rv[k] ?? `{${k}}`))}</li>`).join('');

  // 5. the cost of the risk (ux/M-risk-cost-spec.md), on the example and the one future above
  const rk = md.risk; const sum = loanSummary(tm);
  if (rk.one) {
    const o = rk.one;
    $('#risk-one').textContent = t(o.end > o.price ? 'method.riskOne' : 'method.riskOneFell', { day: o.day, price: money0(o.price, cur), repaid: num(o.repaid, 4), fee: num(o.fee, 4),
      end: money0(o.end, cur), missed: money0(o.missed, cur), feeValue: money0(o.feeValue, cur), total: money0(o.total, cur) });
  }
  $('#risk-all').textContent = t('method.riskAll', { none: of100(rk.noSale), risk: money0(rk.value, cur), ci: money0(1.96 * rk.se, cur), total: money0(sum.totalCost + rk.value, cur), cost: money0(sum.totalCost, cur) });
  $('#risk-scale').textContent = t('method.riskScale', { up: pct(rk.up, 0) });
  $('#risk-table').innerHTML = `<thead><tr>${M.riskHead.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>
    <tr><th scope="row" class="wrap">${esc(t('method.riskRowFormula', { vol: pct(md.simVol, 0) }))}</th><td>${money0(rk.textbook, cur)}</td></tr>
    <tr class="us"><th scope="row" class="wrap">${esc(M.riskRowSim)}</th><td>${money0(rk.value, cur)}</td></tr></tbody>`;
  $('#risk-read').innerHTML = M.riskRead.map((s) => `<li>${esc(s.replace('{none}', of100(rk.noSale)))}</li>`).join('');
  $('#risk-wrap').setAttribute('aria-label', M.riskHead[1]);

  // 6. three methods
  const R = M.methodsRows;
  const row = ([name, what], value, cls = '') => `<tr${cls}><th scope="row">${rich(name)}</th><td class="wrap">${rich(what)}</td><td>${value}</td></tr>`;
  $('#methods-table').innerHTML = `<thead><tr>${M.methodsHead.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${row(R.sim, show(r.bootstrap), ' class="us"')}
    ${row([R.garch[0], t('method.methodsRows.garch.1', { today: pct(md.garch.todayVol, 0) })], of100(r.garch))}
    ${row(R.replay, of100(r.replay))}
    ${row([R.barrier[0], t('method.methodsRows.barrier.1', { vol: pct(r.barrier.sigma, 0) })], of100(r.barrier.p))}</tbody>`;
  const lp = liquidationPrices(tm);
  const liqByMonth = [0, ...r.fanByMonth.map((f) => f.day)].map((d) => lp.byDay[d]);
  fanChart($('#fan-chart'), { s0: tm.btcPrice, fan: r.fanByMonth, liq: liqByMonth, fmt: (v) => money0(v, cur), monthLabel, labels: { title: M.fanTitle, ...M.fanTip, liq: tx.falls.ladderSale } });
  barChart($('#months-chart'), { values: r.cumulativeByMonth.map((x) => x * 100), fmtPct: (v) => `${Math.round(v)}`, monthLabel: (m) => t('ui.monthN', { n: m }), title: M.byMonthTitle });

  // 7. the test against history (measured values, kept current by tests/calibration.test.js)
  $('#test-bars').innerHTML = CALIBRATION.rows.map((x) => `<div class="lv"><span>${esc(t('method.testRow', { model: M.testModels[x.model], days: x.days }))}</span><span class="b"><i style="width:${Math.min(100, x.below05 * 10)}%"></i></span><b>${num(x.below05, 1)}</b></div>`).join('')
    + `<p class="sub">${esc(M.testUnit)}</p>`;
  const ind = (d) => CALIBRATION.rows.find((x) => x.days === d).independent;
  $('#test-strength').textContent = t('method.testStrength', { n90: ind(90), n365: ind(365) });

  // 8.–10. data, trend, limits
  $('#data-list').innerHTML = list(M.data);
  const [m0, m1] = M.measure.split('{link}');
  $('#measure').innerHTML = `${esc(m0)}<a href="${pageHref('insights/')}#i-measure">${esc(M.measureLink)}</a>${esc(m1 || '')}`;
  const p = META.prices[cur];
  $('#data-period').textContent = t('ui.dataThrough', { from: date(p.from), to: date(p.to), updated: date(META.dataUpdated || p.to) });
  const f = r.facts; const by = f.fourYearByStart; const a = by[0]; const z = by[by.length - 1];
  $('#trend-facts').innerHTML = `<p>${esc(t('history.trendUncertainty', { estimate: signedPct(f.trendRange.estimate), low: signedPct(f.trendRange.low), high: signedPct(f.trendRange.high) }))}</p>
    <p>${esc(t('history.trendPast', { worst: signedPct(f.fourYear.worst), median: signedPct(f.fourYear.median), best: signedPct(f.fourYear.best), firstFrom: a.from, firstTo: a.to, firstRate: signedPct(a.perYear), lastFrom: z.from, lastTo: z.to, lastRate: signedPct(z.perYear) }))}</p>
    <p>${esc(t('history.trendSwings', { deep: f.deepYears, years: f.years }))}</p>`;
  $('#limits-list').innerHTML = list(M.limits);

  // 11. the maths (values from the build)
  $('#m-h').textContent = md.halfLifeYears; $('#m-block').textContent = md.blockDays;
  $('#m-n').textContent = num(md.nPaths, 0); $('#m-se').textContent = `${num(md.se * 100, 2)} ${t('ui.percentPoints')}`;
  $('#m-sigma').textContent = pct(r.barrier.sigma, 1);
  const g = md.garch;
  $('#m-garch').textContent = t('method.mathsGarchValues', { alpha: num(g.alpha, 3), beta: num(g.beta, 3), persistence: num(g.alpha + g.beta, 4), nu: num(g.nu, 2), today: pct(g.todayVol, 0) });
  $('#m-code').innerHTML = ['src/engine/montecarlo.js', 'src/engine/history.js', 'src/engine/lender.js', 'src/engine/garch.js', 'src/engine/barrier.js', 'src/engine/replay.js', 'reference/reference_montecarlo.py']
    .map((path) => `<li>${ext(codeLink(path), path)}</li>`).join('');

  // 12. verify
  const [before, after] = M.code.split('{link}');
  $('#code-line').innerHTML = `${esc(before)}${ext(SITE.codeUrl, SITE.codeUrl.replace('https://', ''))}${esc(after || '')}`;
  const [v0a, v0b] = M.verify[0].split('{audit}');
  $('#verify-list').innerHTML = `<li>${esc(v0a)}${ext(codeLink('ux/K-math-audit.md'), 'ux/K-math-audit.md')}${esc(v0b || '')}</li>${list(M.verify.slice(1))}`;
  $('#top').classList.remove('boot'); // drawn: show it (invisible until now, so nothing jumps on slow phones: go/no-go G2)
  document.body.dataset.ready = '1';
}

initLang();
initShell({ built: META.built });
render();
