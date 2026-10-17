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
