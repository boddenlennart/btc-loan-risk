// Hosting & privacy: the built page loads nothing from other servers, and the
// only outside addresses it may contact are the BTC price services named in
// the privacy notice. Checks the six built pages (three pages, two languages).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// the check contacts the price services; "Insights" and "How it works" contact nothing
const PAGES = { 'index.html': 'prices', 'de/index.html': 'prices', 'insights/index.html': 'none', 'de/insights/index.html': 'none', 'method/index.html': 'none', 'de/method/index.html': 'none' };
const ALLOWED_HOSTS = ['api.coinbase.com', 'api.kraken.com', 'api.binance.com', 'api.coingecko.com', 'www.bitstamp.net'];
// Plain text links and the site's own address in the preview tags (read by link previews, not loaded by the page):
const TEXT_LINKS = ['docs.github.com', 'github.com', 'bitcoinloancheck.com'];

for (const [name, connects] of Object.entries(PAGES)) {
const page = new URL(`../docs/${name}`, import.meta.url);
describe.skipIf(!existsSync(page))(`built page ${name}: self-hosted, no external resources`, () => {
  const html = existsSync(page) ? readFileSync(page, 'utf8') : '';
  it('no external scripts, styles, fonts, images or frames', () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).not.toMatch(/<(img|iframe|audio|video|source)[^>]+src=["']?https?:/i);
    expect(html).not.toMatch(/@import|fonts\.googleapis|fonts\.gstatic/i);
    // fonts only from inside the page (data: addresses), never from another server
    const faces = [...html.matchAll(/@font-face\{[^}]*\}/gi)].map((m) => m[0]);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) expect([...f.matchAll(/url\(([^)]*)\)/g)].every((u) => u[1].startsWith('data:font/'))).toBe(true);
    expect(html).not.toMatch(/url\(\s*["']?https?:/i);
  });
  it('every web address in the page is an allowed price service or a plain text link', () => {
    const hosts = new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()));
    for (const h of hosts) {
      // SVG namespace identifiers are not requests
      if (h === 'www.w3.org') continue;
      expect([...ALLOWED_HOSTS, ...TEXT_LINKS], h).toContain(h);
    }
  });
  it('only the page\'s own script may run: its fingerprint, no general permission for inline scripts or inline handlers', () => {
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
    const scriptSrc = csp.match(/script-src ([^;]+)/)[1];
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    const runnable = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    // the light/dark script in <head> and the page's own script; every other script block is data (JSON or plain text)
    expect(runnable).toHaveLength(2);
    expect(runnable[0].length).toBeLessThan(200);
    for (const r of runnable) expect(scriptSrc).toContain(`'sha256-${createHash('sha256').update(r).digest('base64')}'`);
    expect(scriptSrc.match(/'sha256-/g)).toHaveLength(2);
    expect(html).not.toMatch(/<[^>]+\son[a-z]+=["']/i); // no onclick=, onsubmit= ... attributes
  });
  it('the Content Security Policy only allows the named price services (the check) or nothing (the other pages)', () => {
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
    expect(csp).toContain("default-src 'none'");
    const connect = csp.match(/connect-src ([^;]+)/)[1].split(/\s+/).map((u) => u.replace('https://', ''));
    expect(connect.sort()).toEqual(connects === 'prices' ? [...ALLOWED_HOSTS].sort() : ["'none'"]);
  });
});
}

describe('source code: no outside addresses beyond the allowed ones', () => {
  it('src/ only mentions allowed hosts', () => {
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const u = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
        if (e.isDirectory()) walk(u); else files.push(u);
      }
    };
    walk(new URL('../src/', import.meta.url));
    for (const f of files) {
      for (const [, h] of readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        if (h === 'www.w3.org') continue;
        expect([...ALLOWED_HOSTS, ...TEXT_LINKS], `${f.pathname}: ${h}`).toContain(h.toLowerCase());
      }
    }
  });
});

describe.skipIf(!existsSync(new URL('../docs/_headers', import.meta.url)))('security headers for the hosting service (docs/_headers)', () => {
  const h = existsSync(new URL('../docs/_headers', import.meta.url)) ? readFileSync(new URL('../docs/_headers', import.meta.url), 'utf8') : '';
  it('apply to every file and forbid embedding, sniffing, referrers and device features', () => {
    expect(h).toMatch(/^\/\*$/m);
    for (const line of ["Content-Security-Policy: frame-ancestors 'none'", 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer']) expect(h).toContain(line);
    expect(h).toMatch(/Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);
  });
  it('add no outside addresses (the price services stay limited by the page itself)', () => {
    expect(h).not.toMatch(/https?:\/\//);
  });
});
