// Hosting & privacy: the built page loads nothing from other servers, and the
// only outside addresses it may contact are the BTC price services named in
// the privacy notice. Checks the built file docs/index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const page = new URL('../docs/index.html', import.meta.url);
const ALLOWED_HOSTS = ['api.coinbase.com', 'api.kraken.com', 'api.binance.com', 'api.coingecko.com', 'www.bitstamp.net'];
// Plain text links shown to the reader (not loaded by the page):
const TEXT_LINKS = ['docs.github.com', 'github.com'];

describe.skipIf(!existsSync(page))('built page: self-hosted, no external resources', () => {
  const html = existsSync(page) ? readFileSync(page, 'utf8') : '';
  it('no external scripts, styles, fonts, images or frames', () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).not.toMatch(/<(img|iframe|audio|video|source)[^>]+src=["']?https?:/i);
    expect(html).not.toMatch(/@import|@font-face|fonts\.googleapis|fonts\.gstatic/i);
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
  it('the Content Security Policy only allows the named price services', () => {
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
    expect(csp).toContain("default-src 'none'");
    const connect = csp.match(/connect-src ([^;]+)/)[1].split(/\s+/).map((u) => u.replace('https://', ''));
    expect(connect.sort()).toEqual([...ALLOWED_HOSTS].sort());
  });
});

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
