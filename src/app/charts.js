// Small hand-made SVG charts (no library, so the page works offline).
// Every chart gets a hover tooltip; colors come from CSS variables in style.css.
import { esc } from './i18n.js';

// Each chart is drawn at its real width (300–640 px), so its text is really 12 px on a phone too (a fixed
// 640-wide drawing shrunk to a phone made it 6–7 px). Narrow charts show fewer axis labels. W is the width of
// the chart being drawn; hover reads the width from the chart itself. Charts are redrawn when the width changes.
let W = 640;
const narrow = () => W < 480;
const NS = 'http://www.w3.org/2000/svg';
const drawn = new Set();
const widthFor = (el) => Math.round(Math.max(300, Math.min(640, el.clientWidth || 640)));
function remember(el, redraw) { el._redraw = redraw; drawn.add(el); }
if (typeof window !== 'undefined') {
  let timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const el of drawn) {
        if (!el.isConnected) { drawn.delete(el); continue; }
        if (el.clientWidth && widthFor(el) !== el._w) el._redraw();
      }
    }, 150);
  });
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}

function frame(el, height, label) {
  el.innerHTML = '';
  el.classList.add('chart');
  W = widthFor(el); el._w = W;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  el.append(svg, tip);
  return { svg, tip };
}

function showTip(el, tip, svg, xView, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = svg.getBoundingClientRect();
  const px = (xView / svg.viewBox.baseVal.width) * r.width;
  const left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth);
  tip.style.left = `${left}px`;
}

function hover(el, svg, tip, pad, onX) {
  // the whole chart listens (not only its background), so pointing at a line shows the values too
  const area = svg;
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const w = svg.viewBox.baseVal.width; W = w; // the hover code below reads W: this chart's width
    const x = ((ev.clientX - r.left) / r.width) * w;
    const res = onX(Math.max(pad.l, Math.min(w - pad.r, x)));
    if (res) showTip(el, tip, svg, res.x, res.html);
  };
  area.addEventListener('pointermove', move);
  area.addEventListener('pointerdown', move);
  area.addEventListener('pointerleave', () => { tip.hidden = true; const c = svg.querySelector('.cross'); if (c) c.setAttribute('opacity', 0); });
}

/**
 * Fan chart of simulated prices by month, with the liquidation price line.
 * data: { s0, fan: [{ month, q05, q25, q50, q75, q95 }], liq: [price at month 0..n], fmt(price), monthLabel(m), labels: { median, liq } }
 */
export function fanChart(el, data) {
  remember(el, () => fanChart(el, data));
  const H = 300;
  const pad = { l: 64, r: 16, t: 14, b: 30 };
  const { svg, tip } = frame(el, H, data.labels.title);
  const pts = [{ month: 0, q05: data.s0, q25: data.s0, q50: data.s0, q75: data.s0, q95: data.s0 }, ...data.fan];
  const n = pts.length - 1;
  const maxY = Math.max(...pts.map((p) => p.q95), ...data.liq) * 1.05;
  const ticks = niceTicks(0, maxY);
  const top = ticks[ticks.length - 1] > maxY ? ticks[ticks.length - 1] : maxY;
  const x = (m) => pad.l + (m / n) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const band = (a, b) => `M${pts.map((p) => `${x(p.month)},${y(p[a])}`).join('L')}L${pts.slice().reverse().map((p) => `${x(p.month)},${y(p[b])}`).join('L')}Z`;
  const grid = ticks.map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${esc(data.fmt(v))}</text>`).join('');
  const anchor = (m) => (m === 0 ? 'start' : m === n ? 'end' : 'middle');
  const xt = (narrow() ? [...new Set([0, Math.round(n / 2), n])] : niceTicks(0, n, Math.min(6, n))).filter((m) => Number.isInteger(m)).map((m) => `<text x="${x(m)}" y="${H - 8}" class="axis" text-anchor="${anchor(m)}">${esc(data.monthLabel(m))}</text>`).join('');
  const liqPath = `M${data.liq.map((v, m) => `${x(m)},${y(v)}`).join('L')}`;
  const med = `M${pts.map((p) => `${x(p.month)},${y(p.q50)}`).join('L')}`;
  const last = data.liq[data.liq.length - 1];
  svg.innerHTML = `${grid}${xt}
    <path d="${band('q95', 'q05')}" class="band-outer"/>
    <path d="${band('q75', 'q25')}" class="band-inner"/>
    <path d="${med}" class="line-series"/>
    <path d="${liqPath}" class="line-critical"/>
    <text x="${W - pad.r}" y="${y(last) - 6}" class="label-critical" text-anchor="end">${esc(data.labels.liq)}</text>
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}" opacity="0"/>
    <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const m = Math.round(((xv - pad.l) / (W - pad.l - pad.r)) * n);
    const p = pts[m];
    const c = svg.querySelector('.cross');
    c.setAttribute('x1', x(m)); c.setAttribute('x2', x(m)); c.setAttribute('opacity', 1);
    return {
      x: x(m),
      html: `<b>${esc(data.monthLabel(m))}</b>${['q95', 'q75', 'q50', 'q25', 'q05'].map((q) => `<br>${esc(data.labels[q])}: ${esc(data.fmt(p[q]))}`).join('')}<br><span class="t-critical">${esc(data.labels.liq)}: ${esc(data.fmt(data.liq[m]))}</span>`,
    };
  });
}

/** Bars: cumulative chance of liquidation at the end of each month. data: { values: [...], fmtPct, monthLabel, title } */
export function barChart(el, data) {
  remember(el, () => barChart(el, data));
  const H = 220;
  const pad = { l: 48, r: 12, t: 14, b: 30 };
  const { svg, tip } = frame(el, H, data.title);
  const n = data.values.length;
  const maxV = Math.max(0.01, ...data.values) * 1.1;
  const ticks = niceTicks(0, maxV);
  const top = Math.max(maxV, ticks[ticks.length - 1]);
  const bw = (W - pad.l - pad.r) / n;
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const grid = ticks.map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${esc(data.fmtPct(v))}</text>`).join('');
  const gap = Math.min(2, bw * 0.2);
  const bars = data.values.map((v, i) => {
    const h = Math.max(0, y(0) - y(v));
    const rx = Math.min(4, (bw - gap) / 2, h);
    return `<path class="bar" d="M${pad.l + i * bw + gap / 2},${y(0)}V${y(0) - h + rx}q0,-${rx} ${rx},-${rx}H${pad.l + (i + 1) * bw - gap / 2 - rx}q${rx},0 ${rx},${rx}V${y(0)}Z"/>`;
  }).join('');
  const step = Math.ceil(n / (narrow() ? 3 : 8));
  // the last label ends at the right edge, so it is never cut off
  const xt = data.values.map((_, i) => ((i + 1) % step === 0 || i === n - 1 ? `<text x="${i === n - 1 ? W - pad.r : pad.l + (i + 0.5) * bw}" y="${H - 8}" class="axis" text-anchor="${i === n - 1 ? 'end' : 'middle'}">${esc(data.monthLabel(i + 1))}</text>` : '')).join('');
  svg.innerHTML = `${grid}${bars}${xt}<rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const i = Math.min(n - 1, Math.floor((xv - pad.l) / bw));
    svg.querySelectorAll('.bar').forEach((b, k) => b.classList.toggle('dim', k !== i));
    return { x: pad.l + (i + 0.5) * bw, html: `<b>${esc(data.monthLabel(i + 1))}</b><br>${esc(data.fmtPct(data.values[i]))}` };
  });
  svg.querySelector('.hit').addEventListener('pointerleave', () => svg.querySelectorAll('.bar').forEach((b) => b.classList.remove('dim')));
}

/** Strip of all past start dates: red = liquidated, grey = survived. data: { time, liquidated, liquidationTime, fmtDate, labels } */
export function replayStrip(el, data) {
  remember(el, () => replayStrip(el, data));
  const H = 90;
  const pad = { l: 8, r: 8, t: 8, b: 30 };
  const { svg, tip } = frame(el, H, data.labels.title);
  const n = data.time.length;
  if (!n) { svg.innerHTML = ''; return; }
  const t0 = data.time[0]; const t1 = data.time[n - 1] + 86400;
  const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  let rects = '';
  for (let i = 0; i < n;) {
    let j = i;
    while (j < n && data.liquidated[j] === data.liquidated[i]) j++;
    const x0 = x(data.time[i]); const x1 = x(data.time[j - 1] + 86400);
    rects += `<rect x="${x0}" y="${pad.t}" width="${Math.max(0.5, x1 - x0)}" height="${H - pad.t - pad.b}" class="${data.liquidated[i] ? 'fill-critical' : 'fill-neutral'}"/>`;
    i = j;
  }
  const y0 = new Date(t0 * 1000).getUTCFullYear(); const y1 = new Date(t1 * 1000).getUTCFullYear();
  const every = Math.ceil((y1 - y0 + 1) / (narrow() ? 4 : 7));
  let xt = '';
  for (let yr = y0 + 1; yr <= y1; yr++) {
    if ((yr - y0) % every) continue;
    const tx = x(Date.UTC(yr, 0, 1) / 1000);
    xt += `<line x1="${tx}" x2="${tx}" y1="${H - pad.b}" y2="${H - pad.b + 4}" class="grid"/><text x="${tx}" y="${H - 8}" class="axis" text-anchor="middle">${yr}</text>`;
  }
  svg.innerHTML = `${rects}${xt}<line class="cross" y1="${pad.t}" y2="${H - pad.b}" opacity="0"/><rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const tt = t0 + ((xv - pad.l) / (W - pad.l - pad.r)) * (t1 - t0);
    let i = Math.min(n - 1, Math.max(0, Math.floor((tt - t0) / 86400)));
    while (i > 0 && data.time[i] > tt) i--;
    const c = svg.querySelector('.cross');
    c.setAttribute('x1', x(data.time[i])); c.setAttribute('x2', x(data.time[i])); c.setAttribute('opacity', 1);
    const res = data.liquidated[i] ? `<span class="t-critical">${esc(data.labels.liquidated)}: ${esc(data.fmtDate(data.liquidationTime[i]))}</span>` : esc(data.labels.survived);
    return { x: x(data.time[i]), html: `<b>${esc(data.fmtDate(data.time[i]))}</b><br>${res}` };
  });
}

// shared axes for the price charts below: y = price, x = days of the loan
function priceAxes(svg, { H, pad, days, maxY, fmt, monthLabel }) {
  const x = (d) => pad.l + (d / days) * (W - pad.l - pad.r);
  const ticks = niceTicks(0, maxY);
  const top = Math.max(maxY, ticks[ticks.length - 1]);
  const y = (v) => pad.t + (1 - Math.min(v, top) / top) * (H - pad.t - pad.b);
  const months = Math.round(days / 30.44);
  const step = Math.max(1, Math.ceil(months / (narrow() ? 3 : 6)));
  let g = ticks.map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${esc(fmt(v))}</text>`).join('');
  for (let m = 0; m <= months; m += step) {
    const d = Math.min(days, Math.round(m * 30.44));
    g += `<text x="${x(d)}" y="${H - 8}" class="axis" text-anchor="${m === 0 ? 'start' : m >= months ? 'end' : 'middle'}">${esc(monthLabel(m))}</text>`;
  }
  return { x, y, g };
}

function triggerLines({ x, y }, data) {
  const line = (a, b, cls, label, below) => `<path d="M${x(0)},${y(a)}L${x(data.days)},${y(b)}" class="${cls}"/><text x="${x(data.days) - 2}" y="${y(b) + (below ? 14 : -6)}" class="label-${cls === 'line-critical' ? 'critical' : 'warning'}" text-anchor="end">${esc(label)}</text>`;
  let s = '';
  if (data.mc) s += line(data.mc[0], data.mc[1], 'line-warning', data.labels.margin, false);
  s += line(data.liq[0], data.liq[1], 'line-critical', data.labels.sale, true);
  return s;
}

/**
 * "20 possible futures": one line per simulated path, stopping with ✕ where the lender sells.
 * data: { paths: [{ weekly, event }], days, liq: [start, end], mc: [start, end] | null, fmt, monthLabel, labels: { title, margin, sale, tip } }
 */
export function futuresChart(el, data) {
  remember(el, () => futuresChart(el, data));
  const H = 300;
  const pad = { l: 64, r: 16, t: 14, b: 30 };
  const { svg, tip } = frame(el, H, data.labels.title);
  const maxY = Math.max(...data.paths.flatMap((p) => p.weekly)) * 1.02;
  const ax = priceAxes(svg, { H, pad, days: data.days, maxY, fmt: data.fmt, monthLabel: data.monthLabel });
  const dayOf = (k, n) => (k === n - 1 ? data.days : k * 7);
  let lines = '';
  for (const p of data.paths) {
    const n = p.weekly.length;
    const until = p.event ? Math.min(n - 1, Math.ceil(p.event.day / 7)) : n - 1;
    const pts = p.weekly.slice(0, until + 1).map((v, k) => `${ax.x(dayOf(k, n))},${ax.y(v)}`).join('L');
    lines += `<path d="M${pts}" class="${p.event ? 'path-sold' : 'path-kept'}"/>`;
    if (p.event) lines += `<text x="${ax.x(dayOf(until, n))}" y="${ax.y(p.weekly[until]) + 4}" class="mark-sold" text-anchor="middle">✕</text>`;
  }
  svg.innerHTML = `${ax.g}${lines}${triggerLines(ax, data)}<line class="cross" y1="${pad.t}" y2="${H - pad.b}" opacity="0"/><rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const d = Math.round(((xv - pad.l) / (W - pad.l - pad.r)) * data.days);
    const sold = data.paths.filter((p) => p.event && p.event.day <= d).length;
    const c = svg.querySelector('.cross');
    c.setAttribute('x1', ax.x(d)); c.setAttribute('x2', ax.x(d)); c.setAttribute('opacity', 1);
    return { x: ax.x(d), html: esc(data.labels.tip(Math.round(d / 30.44), sold)) };
  });
}

/**
 * "What really happened": the visitor's loan on real start dates, real prices scaled to today.
 * data: { stories: [{ weekly (relative), sale }], s0, days, liq, mc, colors, fmt, monthLabel, labels }
 */
export function storiesChart(el, data) {
  remember(el, () => storiesChart(el, data));
  if (!data.stories.length) { el.innerHTML = ''; return; } // a loan longer than any of the real years allows
  const H = 300;
  const pad = { l: 64, r: 16, t: 14, b: 30 };
  const { svg, tip } = frame(el, H, data.labels.title);
  const maxY = Math.min(4, Math.max(...data.stories.flatMap((s) => s.weekly))) * data.s0 * 1.02;
  const ax = priceAxes(svg, { H, pad, days: data.days, maxY, fmt: data.fmt, monthLabel: data.monthLabel });
  let lines = '';
  data.stories.forEach((s, j) => {
    const n = s.weekly.length;
    const pts = s.weekly.map((v, k) => `${ax.x(Math.min(data.days, k * 7))},${ax.y(v * data.s0)}`);
    const until = s.sale ? Math.min(n - 1, Math.ceil(s.sale.day / 7)) : n - 1;
    lines += `<path d="M${pts.slice(0, until + 1).join('L')}" class="story" style="stroke:${data.colors[j]}"/>`;
    if (s.sale) {
      lines += `<path d="M${pts.slice(until).join('L')}" class="story-after" style="stroke:${data.colors[j]}"/>`;
      lines += `<text x="${ax.x(Math.min(data.days, until * 7))}" y="${ax.y(s.weekly[until] * data.s0) + 4}" class="mark-sold" style="fill:${data.colors[j]}" text-anchor="middle">✕</text>`;
    }
  });
  svg.innerHTML = `${ax.g}${lines}${triggerLines(ax, data)}<line class="cross" y1="${pad.t}" y2="${H - pad.b}" opacity="0"/><rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const d = Math.round(((xv - pad.l) / (W - pad.l - pad.r)) * data.days);
    const k = Math.min(Math.floor(d / 7), Math.min(...data.stories.map((s) => s.weekly.length)) - 1);
    const c = svg.querySelector('.cross');
    c.setAttribute('x1', ax.x(d)); c.setAttribute('x2', ax.x(d)); c.setAttribute('opacity', 1);
    return { x: ax.x(d), html: `<b>${esc(data.monthLabel(Math.round(d / 30.44)))}</b><br>${data.stories.map((s, j) => `<span style="color:${data.colors[j]}">${esc(data.labels.names[j])}: ${esc(data.fmt(s.weekly[k] * data.s0))}</span>`).join('<br>')}` };
  });
}

/**
 * A line over time with one marked point (the latest), e.g. 30-day price swings since 2014.
 * data: { points: [[unixTime, value], ...], fmt(value), fmtDate(unixTime), title } (the dot is explained next to the chart)
 */
export function lineChart(el, data) {
  remember(el, () => lineChart(el, data));
  const H = 240;
  const pad = { l: 48, r: 16, t: 14, b: 30 };
  const { svg, tip } = frame(el, H, data.title);
  const pts = data.points; const n = pts.length;
  const t0 = pts[0][0]; const t1 = pts[n - 1][0];
  const maxV = Math.max(...pts.map((p) => p[1])) * 1.05;
  const ticks = niceTicks(0, maxV);
  const top = Math.max(maxV, ticks[ticks.length - 1]);
  const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const grid = ticks.map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${esc(data.fmt(v))}</text>`).join('');
  const y0 = new Date(t0 * 1000).getUTCFullYear(); const y1 = new Date(t1 * 1000).getUTCFullYear();
  const years = []; for (let yr = y0 + 1; yr <= y1; yr += narrow() ? 3 : y1 - y0 > 8 ? 2 : 1) years.push(yr);
  const xt = years.map((yr) => `<text x="${x(Date.UTC(yr, 0, 1) / 1000)}" y="${H - 8}" class="axis" text-anchor="middle">${yr}</text>`).join('');
  const line = `M${pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('L')}`;
  const [lt, lv] = pts[n - 1];
  svg.innerHTML = `${grid}${xt}<path d="${line}" class="line-series"/>
    <circle cx="${x(lt)}" cy="${y(lv)}" r="5" class="mark-now"/>
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}" opacity="0"/>
    <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const t = t0 + ((xv - pad.l) / (W - pad.l - pad.r)) * (t1 - t0);
    let k = 0; while (k < n - 1 && pts[k + 1][0] <= t) k++;
    const c = svg.querySelector('.cross');
    c.setAttribute('x1', x(pts[k][0])); c.setAttribute('x2', x(pts[k][0])); c.setAttribute('opacity', 1);
    return { x: x(pts[k][0]), html: `<b>${esc(data.fmtDate(pts[k][0]))}</b><br>${esc(data.fmt(pts[k][1]))}` };
  });
}

/**
 * "One simulated future": one path, coloured piece by piece (each piece = 30 real days from another time),
 * the liquidation line and the day of the sale. Hover shows where the piece under the pointer came from.
 * data: { weekly, days, liq: [start, end], mc: [start, end] | null, pieces: [{ fromDay, label }], event: { day } | null, fmt, monthLabel, labels: { title, liq, margin, piece } }
 */
export function onePathChart(el, data) {
  remember(el, () => onePathChart(el, data));
  const H = 280;
  const pad = { l: 64, r: 16, t: 14, b: 30 };
  const { svg, tip } = frame(el, H, data.labels.title);
  const maxY = Math.max(...data.weekly, data.liq[0], data.liq[1], ...(data.mc || [])) * 1.08;
  const ax = priceAxes(svg, { H, pad, days: data.days, maxY, fmt: data.fmt, monthLabel: data.monthLabel });
  const dayOf = (k) => Math.min(data.days, k * 7);
  const pts = data.weekly.map((v, k) => [ax.x(dayOf(k)), ax.y(v), dayOf(k)]);
  const sold = data.event ? data.event.day : Infinity;
  let lines = '';
  data.pieces.forEach((p, j) => {
    const end = j + 1 < data.pieces.length ? data.pieces[j + 1].fromDay : data.days;
    const seg = pts.filter(([, , d], i) => (d >= p.fromDay - 7 && d <= end) && (i === 0 || pts[i - 1][2] < end));
    const before = seg.filter(([, , d]) => d <= sold + 7); const after = seg.filter(([, , d]) => d >= sold);
    if (before.length > 1) lines += `<path d="M${before.map(([x, y]) => `${x},${y}`).join('L')}" class="${j % 2 ? 'piece-b' : 'piece-a'}"/>`;
    if (after.length > 1) lines += `<path d="M${after.map(([x, y]) => `${x},${y}`).join('L')}" class="story-after" style="stroke:var(--muted)"/>`;
  });
  if (data.event) {
    const k = Math.min(data.weekly.length - 1, Math.round(data.event.day / 7));
    lines += `<text x="${ax.x(data.event.day)}" y="${ax.y(data.weekly[k]) + 5}" class="mark-sold" text-anchor="middle">✕</text>`;
  }
  const trig = triggerLines(ax, { days: data.days, liq: data.liq, mc: data.mc, labels: { margin: data.labels.margin, sale: data.labels.liq } });
  svg.innerHTML = `${ax.g}${lines}${trig}<line class="cross" y1="${pad.t}" y2="${H - pad.b}" opacity="0"/><rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const d = Math.round(((xv - pad.l) / (W - pad.l - pad.r)) * data.days);
    let j = 0; while (j + 1 < data.pieces.length && data.pieces[j + 1].fromDay <= d) j++;
    const c = svg.querySelector('.cross');
    c.setAttribute('x1', ax.x(d)); c.setAttribute('x2', ax.x(d)); c.setAttribute('opacity', 1);
    return { x: ax.x(d), html: `<b>${esc(data.monthLabel(Math.round(d / 30.44)))}</b><br>${esc(data.labels.piece(data.pieces[j].label))}` };
  });
}

/**
 * Volatility per year: one bar per year, shaded by how much that year counts in the simulation,
 * and a dashed line at the volatility the simulation effectively uses.
 * data: { rows: [{ year, vol, weight }], sim, fmtPct, labels: { title, sim, tip(year, vol, weight) } }
 */
export function volChart(el, data) {
  remember(el, () => volChart(el, data));
  const H = 230;
  const pad = { l: 48, r: 16, t: 26, b: 30 };
  const { svg, tip } = frame(el, H, data.labels.title);
  const n = data.rows.length; const bw = (W - pad.l - pad.r) / n;
  const top = Math.max(1, ...data.rows.map((r) => r.vol)) * 1.05;
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const maxW = Math.max(...data.rows.map((r) => r.weight));
  const grid = [0, 0.5, 1].map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${esc(data.fmtPct(v))}</text>`).join('');
  const bars = data.rows.map((r, i) => `<rect class="bar" x="${pad.l + i * bw + bw * 0.15}" y="${y(r.vol)}" width="${bw * 0.7}" height="${y(0) - y(r.vol)}" rx="3" style="opacity:${(0.2 + 0.8 * (r.weight / maxW)).toFixed(2)}"/>`).join('');
  const every = narrow() ? 3 : 2;
  const xt = data.rows.map((r, i) => ((n - 1 - i) % every === 0 ? `<text x="${pad.l + (i + 0.5) * bw}" y="${H - 8}" class="axis" text-anchor="middle">${r.year}</text>` : '')).join('');
  const sim = `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(data.sim)}" y2="${y(data.sim)}" class="line-critical"/><text x="${W - pad.r}" y="${y(data.sim) - 6}" class="label-critical" text-anchor="end">${esc(data.labels.sim)}</text>`;
  svg.innerHTML = `${grid}${bars}${sim}${xt}<rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
  hover(el, svg, tip, pad, (xv) => {
    const i = Math.min(n - 1, Math.max(0, Math.floor((xv - pad.l) / bw)));
    const r = data.rows[i];
    return { x: pad.l + (i + 0.5) * bw, html: esc(data.labels.tip(r.year, r.vol, r.weight)) };
  });
}
