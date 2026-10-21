// "Insights": what happened to BTC-backed loans since 2014. The numbers are computed by the build
// (src/insights/compute.js, on the real history) and only shown here. No wording lives here.
import { initLang, t, texts, esc } from './i18n.js';
import { money0, pct, num, date } from './format.js';
import { lineChart } from './charts.js';
import { initShell, renderShell } from './shell.js';

const META = JSON.parse(document.getElementById('meta').textContent);
const $ = (sel) => document.querySelector(sel);
const of100 = (p) => Math.round(p * 100);
const usd = (v) => money0(v, 'USD');
// shares that add up to exactly 100 (largest remainder), for a table that splits one whole
function to100(parts) {
  const raw = parts.map((p) => Math.max(0, p) * 100); const fl = raw.map(Math.floor); let rest = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return fl;
}

// each table scrolls inside its own box on narrow screens; `label` names the box (unique on the page)
const table = (label, head, rows, cls = '') => `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(label)}"><table class="itable${cls}"><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => (typeof c === 'object' ? c.html : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
// one insight: title, what was measured, the takeaway in one sentence (if any), then the table(s)
const block = (id, title, lead, take, rest) => { $(`#i-${id}`).innerHTML = `<h3>${esc(title)}</h3><p class="sub">${esc(lead)}</p>${take ? `<p class="take">${esc(take)}</p>` : ''}${rest}`; };
const hint = (s) => `<p class="hint">${esc(s)}</p>`;

function render() {
  const I = META.insights; const T = texts().insights;
  document.title = T.metaTitle;
  renderShell();
  if (!I) return;
  $('#basis').textContent = t('insights.basis', { from: date(I.from), to: date(I.to) });
  $('#reference').textContent = t('insights.reference', { story: T.story });

  // 1. survival map: shaded by the number
  const S = I.survival; const cell = (c) => ({ html: `<td class="heat" style="--heat:${Math.round(Math.min(c.liquidated, 0.75) * 60)}%">${of100(c.liquidated)}</td>` });
  const some = S.neverAbove.find((x) => x.months === 12 && x.ltv !== null);
  const at20 = S.cells.find((c) => c.ltv === 0.2 && c.months === 12);
  block('survival', T.survival.title, T.survival.lead,
    some ? t('insights.survival.takeSome', { ltv: pct(some.ltv, 0), months: 12 }) : t('insights.survival.takeNone', { n: of100(at20.liquidated) }),
    table(T.survival.title, [T.survival.colLtv, ...[6, 12, 24, 36].map((m) => t('insights.survival.months', { n: m }))],
      [...new Set(S.cells.map((c) => c.ltv))].map((ltv) => [pct(ltv, 0), ...S.cells.filter((c) => c.ltv === ltv).sort((a, b) => a.months - b.months).map(cell)]), ' heatmap') + hint(T.survival.unit));

  // 2. worst falls by time window
  const yr = I.falls.find((f) => f.days === 365);
  block('falls', T.falls.title, T.falls.lead, t('insights.falls.take', { q90: pct(yr.q90, 0), worst: pct(yr.worst, 0), date: date(yr.worstStart) }),
    table(T.falls.title, T.falls.head, I.falls.map((f) => [t('insights.falls.days', { n: f.days }), `−${pct(f.q50, 0)}`, `−${pct(f.q90, 0)}`, `−${pct(f.q95, 0)}`, `−${pct(f.worst, 0)}`])) + hint(T.falls.unit) + hint(T.falls.bridge));

  // 3. speed of crashes
  const sp = I.speed;
  block('speed', T.speed.title, T.speed.lead, t('insights.speed.take', { a: of100(sp.within24) }),
    table(T.speed.title, T.speed.head, [T.speed.within, t('insights.speed.between', { a: 24, b: 48 }), t('insights.speed.between', { a: 48, b: 72 }), T.speed.later, T.speed.never]
      .map((label, k) => [label, String(to100([sp.within24, sp.within48 - sp.within24, sp.within72 - sp.within48, sp.liquidatedLater - sp.within72, 1 - sp.liquidatedLater])[k])])) + `<p>${esc(t('insights.speed.night', { n: of100(sp.outsideOfficeHours) }))}</p>` + hint(T.speed.note));

  // 4. one change at a time
  const L = I.levers;
  block('levers', T.levers.title, t('insights.levers.lead', { base: of100(L.base) }), '',
    `<div class="levers"><div class="lv base"><span>${esc(T.levers.base)}</span><span class="b"><i style="width:${L.base * 100}%"></i></span><b>${of100(L.base)}</b></div>${L.levers.map((l) => `<div class="lv"><span>${esc(T.levers.names[l.id])}</span><span class="b"><i style="width:${l.liquidated * 100}%"></i></span><b>${of100(l.liquidated)}</b></div>`).join('')}</div>` + hint(T.levers.unit) + hint(T.levers.note));

  // 5. reserve sizing
  const r50 = I.reserve.find((r) => r.ltv === 0.5); const more = (x) => (x < 0.005 ? pct(0, 0) : `+${pct(x, 0)}`);
  block('reserve', T.reserve.title, T.reserve.lead, t('insights.reserve.take', { q90: pct(r50.q90, 0), max: pct(r50.max, 0) }),
    table(T.reserve.title, T.reserve.head, I.reserve.map((r) => [pct(r.ltv, 0), more(r.q50), more(r.q90), more(r.q95), more(r.max)])) + hint(T.reserve.note));

  // 6. partial vs full sale
  const P = I.partial;
  block('partial', T.partial.title, t('insights.partial.lead', { n: num(P.saleDays, 0) }), t('insights.partial.take', { n: of100(P.partialBetter) }),
    table(T.partial.title, T.partial.head, [[T.partial.full, pct(P.fullMedian, 0)], [T.partial.part, pct(P.partialMedian, 0)]]) + hint(T.partial.note));

  // 7. cost including the risk
  const C = I.cost; const [A, B] = C.offers;
  block('cost', T.cost.title, T.cost.lead, t(A.expected > B.expected ? 'insights.cost.takeMore' : 'insights.cost.takeLess', { a: usd(A.expected), b: usd(B.expected) }),
    `<h4>${esc(T.cost.offersTitle)}</h4>${table(T.cost.offersTitle, [T.cost.offer, T.cost.offerA, T.cost.offerB], [
      [T.cost.head[1], usd(A.cost), usd(B.cost)], [T.cost.head[2], String(of100(A.liquidated)), String(of100(B.liquidated))],
      [T.cost.head[3], usd(A.avgLoss), usd(B.avgLoss)], [T.cost.head[4], usd(A.expected), usd(B.expected)]])}
    ${table(T.cost.title, [T.cost.head[0], ...T.cost.head.slice(2)], C.rows.map((r) => [pct(r.ltv, 0), String(of100(r.liquidated)), usd(r.avgLoss), usd(r.expected)]))}`
    + hint(t('insights.cost.sameCost', { cost: usd(C.rows[0].cost) })) + hint(T.cost.note) + `<p>${esc(T.cost.differs)}</p>`);

  // 8. hourly lows vs. a smoother price
  const M = I.measure;
  block('measure', T.measure.title, T.measure.lead, t('insights.measure.take', { n: Math.max(...M.map((m) => Math.abs(of100(m.lows) - of100(m.closes)))) }),
    table(T.measure.title, T.measure.head, M.map((m) => [pct(m.ltv, 0), String(of100(m.lows)), String(of100(m.closes))])) + hint(T.measure.note));

  // 9. buying more BTC
  const Bu = I.buy; const c12 = (ltv) => Bu.cells.find((c) => c.ltv === ltv && c.months === 12);
  block('buy', T.buy.title, T.buy.lead, t('insights.buy.take', { a: of100(c12(0.2).more), b: of100(c12(0.5).more) }),
    table(T.buy.title, [T.survival.colLtv, ...[6, 12, 24, 36].map((m) => t('insights.survival.months', { n: m }))],
      [...new Set(Bu.cells.map((c) => c.ltv))].map((ltv) => [pct(ltv, 0), ...Bu.cells.filter((c) => c.ltv === ltv).sort((a, b) => a.months - b.months).map((c) => String(of100(c.more)))])) + hint(T.buy.unit)
    + `<h4>${esc(T.buy.neededTitle)}</h4>${table(T.buy.neededTitle, T.buy.neededHead, Bu.needed.map((n) => [t('insights.survival.months', { n: n.months }), `+${pct(n.need, 1)}`, String(of100(n.rose))]))}` + hint(T.buy.neededNote));

  // 10. borrowing instead of selling
  const Sp = I.spend; const won = (ltv, tax) => String(of100(Sp.find((x) => x.ltv === ltv && x.tax === tax).borrowWon));
  block('spend', T.spend.title, T.spend.lead, t('insights.spend.take', { n: won(0.3, 'none') }),
    table(T.spend.title, T.spend.head, [0.3, 0.5].map((ltv) => [pct(ltv, 0), won(ltv, 'none'), won(ltv, 'sellNowTaxed')])) + hint(T.spend.note));

  // 11. today's price swings
  const W = I.swings;
  block('swings', T.swings.title, T.swings.lead, t('insights.swings.take', { now: pct(W.now, 0), n: of100(W.calmerShare) }),
    `<p>${esc(t('insights.swings.range', { q50: pct(W.q50, 0), q10: pct(W.q10, 0), q90: pct(W.q90, 0) }))}</p><p>${esc(t('insights.swings.vsSim', { sim: pct(W.simVol, 0) }))}</p><div id="swings-chart"></div>` + hint(t('insights.swings.now', { now: pct(W.now, 0) })) + hint(T.swings.note));
  // the halvings: the new supply of BTC was cut in half (block heights 420,000, 630,000 and 840,000)
  const HALVINGS = [Date.UTC(2016, 6, 9), Date.UTC(2020, 4, 11), Date.UTC(2024, 3, 20)].map((ms) => ({ t: ms / 1000, label: T.swings.halving }));
  lineChart($('#swings-chart'), { points: W.weekly, fmt: (v) => pct(v, 0), fmtDate: date, title: T.swings.chartTitle, marks: HALVINGS });

  document.getElementById('top').classList.remove('boot'); // drawn: show it (nothing jumps on slow phones: go/no-go G2)
  document.body.dataset.ready = '1';
}

initLang();
initShell({ built: META.built });
render();
