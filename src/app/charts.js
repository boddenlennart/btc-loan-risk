// Small hand-made SVG charts (no library, so the page works offline).
// Every chart gets a hover tooltip; colors come from CSS variables in style.css.
import { esc } from './i18n.js';

const W = 640;
const NS = 'http://www.w3.org/2000/svg';

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
  const px = (xView / W) * r.width;
  const left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth);
  tip.style.left = `${left}px`;
}

function hover(el, svg, tip, pad, onX) {
  const area = svg.querySelector('.hit');
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const res = onX(Math.max(pad.l, Math.min(W - pad.r, x)));
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
  const xt = niceTicks(0, n, Math.min(6, n)).filter((m) => Number.isInteger(m)).map((m) => `<text x="${x(m)}" y="${H - 8}" class="axis" text-anchor="${anchor(m)}">${esc(data.monthLabel(m))}</text>`).join('');
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
      html: `<b>${esc(data.monthLabel(m))}</b><br>95%: ${esc(data.fmt(p.q95))}<br>75%: ${esc(data.fmt(p.q75))}<br>${esc(data.labels.median)}: ${esc(data.fmt(p.q50))}<br>25%: ${esc(data.fmt(p.q25))}<br>5%: ${esc(data.fmt(p.q05))}<br><span class="t-critical">${esc(data.labels.liq)}: ${esc(data.fmt(data.liq[m]))}</span>`,
    };
  });
}

/** Bars: cumulative chance of liquidation at the end of each month. data: { values: [...], fmtPct, monthLabel, title } */
export function barChart(el, data) {
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
  const step = Math.ceil(n / 8);
  const xt = data.values.map((_, i) => ((i + 1) % step === 0 || i === n - 1 ? `<text x="${pad.l + (i + 0.5) * bw}" y="${H - 8}" class="axis" text-anchor="middle">${esc(data.monthLabel(i + 1))}</text>` : '')).join('');
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
  const every = Math.ceil((y1 - y0 + 1) / 7);
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
