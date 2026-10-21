// Design rules from ux/C-design-spec.md that can be checked in the stylesheet:
// every text colour meets WCAG AA (4.5:1) on every background it is used on, field borders
// and data marks meet 3:1, in light and dark mode. A later colour change cannot break this unnoticed.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app/style.css', import.meta.url), 'utf8');
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
const light = tokens(css.match(/:root \{([\s\S]*?)\n\}/)[1]);
const dark = { ...light, ...tokens(css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)[1]) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = ['text', 'text-2', 'muted', 'accent-ink', 'critical-ink'];
const BACKGROUNDS = ['bg', 'surface', 'surface-2'];
const MARKS = ['field', 'critical', 'partial', 'warning', 'good'];

for (const [mode, t] of [['light', light], ['dark', dark]]) {
  describe(`${mode} mode`, () => {
    it('every token the rules need exists', () => {
      for (const k of [...TEXT, ...BACKGROUNDS, ...MARKS, 'fill-strong']) expect(t[k], k).toMatch(/^#/);
    });
    it('text colours: at least 4.5:1 on page, panel and tile backgrounds', () => {
      for (const fg of TEXT) for (const bg of BACKGROUNDS) expect(ratio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it('white text on filled buttons: at least 4.5:1', () => {
      expect(ratio('#ffffff', t['fill-strong'])).toBeGreaterThanOrEqual(4.5);
    });
    it('field borders and data marks (dots, rings, lines): at least 3:1 against the panel', () => {
      for (const m of MARKS) expect(ratio(t[m], t.surface), m).toBeGreaterThanOrEqual(3);
    });
  });
}

describe('rules of the identity', () => {
  it('the main number uses the text colour, not a warning colour', () => {
    const rule = css.match(/\.headline \.hero-n \{([^}]*)\}/)[1];
    expect(rule).toMatch(/color:\s*var\(--text\)/);
  });
  it('"nothing happened" is a ring, so it differs by shape and not only by colour', () => {
    expect(css).toMatch(/\.d-none \{[^}]*box-shadow: inset/);
  });
  it('only the sizes of the type scale are used', () => {
    // scale: label 12, xs 13, sm 14, base 16, lg 20, xl 26 (phone) / 32 (desktop), hero 56 / 72;
    // plus two fixed parts: tile values 17 and the name in the top bar 18
    const ALLOWED = [12, 13, 14, 16, 17, 18, 20, 26, 32, 56, 72];
    const sizes = new Set([...css.matchAll(/font(?:-size)?:[^;]*?(\d+)px/g)].map((m) => Number(m[1])));
    for (const px of sizes) expect(ALLOWED, `${px}px`).toContain(px);
  });
});

// Owner, 21 Oct 2026: orange is Bitcoin's colour and the logo's, never a sign of something bad. Liquidated is a clear
// red, partly liquidated a half-filled red dot, a margin call yellow/gold; these differ for colour-blind eyes too.
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  if (!d) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
// red-green colour blindness (deuteranopia, protanopia; Viénot 1999), compared by lightness and colour (CIE Lab)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const SIM = { deutan: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]], protan: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]] };
const lab = ([r, g, b]) => {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const seen = (hex, kind) => { const v = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)); return lab(SIM[kind].map((row) => Math.max(0, Math.min(1, row.reduce((a, m, j) => a + m * v[j], 0))))); };
const apart = (a, b, kind) => Math.hypot(...seen(a, kind).map((x, i) => x - seen(b, kind)[i]));

describe('colours that carry a meaning', () => {
  for (const [mode, t] of [['light', light], ['dark', dark]]) {
    it(`${mode}: no warning or data colour is orange (orange belongs to the Bitcoin logo)`, () => {
      for (const k of ['critical', 'critical-ink', 'partial', 'warning', 'warning-ink', 'story-1', 'story-2', 'story-3', 'story-4']) {
        const h = hue(t[k]);
        expect(h !== null && h > 12 && h < 42, `${k} ${t[k]}: hue ${Math.round(h)}°`).toBe(false);
      }
    });
    it(`${mode}: liquidated and margin call stay apart with red-green colour blindness`, () => {
      for (const kind of ['deutan', 'protan']) expect(apart(t.critical, t.warning, kind), kind).toBeGreaterThanOrEqual(15);
    });
  }
  it('partly liquidated is a half-filled dot: it differs by shape, not by another colour', () => {
    expect(css).toMatch(/\.d-part \{[^}]*linear-gradient\(90deg, var\(--partial\) 50%, transparent 50%\)[^}]*box-shadow: inset/);
  });
  it('the logo is the orange coin with the ₿ sign: top bar, browser tab and the icon builder', () => {
    for (const f of ['src/app/partials/header.html', 'src/app/partials/icon.html', 'tools/build-og.mjs']) {
      expect(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), f).toMatch(/F7931A/);
    }
  });
});
