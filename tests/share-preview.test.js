// Share preview (ux/D-share-preview.md): both language pages carry title, description and
// preview tags; the preview images exist in the right size; texts fit the platforms' limits.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import en from '../src/content/text.en.js';
import de from '../src/content/text.de.js';

const file = (p) => new URL(`../docs/${p}`, import.meta.url);
const pages = { en: 'index.html', de: 'de/index.html' };
const tag = (html, attr, name) => (html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) || [])[1];
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
// PNG width and height are stored at bytes 16-23
const pngSize = (u) => { const b = readFileSync(u); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe('texts fit the platforms', () => {
  for (const [lang, tx] of [['en', en], ['de', de]]) {
    it(`${lang}: search title at most 60 characters, description at most 155`, () => {
      expect(tx.meta.title.length).toBeLessThanOrEqual(60);
      expect(tx.meta.description.length).toBeLessThanOrEqual(155);
      expect(tx.meta.ogTitle.length).toBeLessThanOrEqual(90);
    });
  }
});

describe.skipIf(!existsSync(file('de/index.html')))('built pages', () => {
  for (const [lang, p] of Object.entries(pages)) {
    const html = existsSync(file(p)) ? readFileSync(file(p), 'utf8') : '';
    const tx = { en, de }[lang].meta;
    const url = lang === 'de' ? 'https://bitcoinloancheck.com/de/' : 'https://bitcoinloancheck.com/';
    it(`${lang}: language, title, description, canonical address`, () => {
      expect(html).toMatch(new RegExp(`^<!doctype html>\\s*<html lang="${lang}">`, 'i'));
      expect(unesc(html.match(/<title>([^<]*)<\/title>/)[1])).toBe(tx.title);
      expect(unesc(tag(html, 'name', 'description'))).toBe(tx.description);
      expect(html).toContain(`<link rel="canonical" href="${url}">`);
      expect(html).toContain('hreflang="de" href="https://bitcoinloancheck.com/de/"');
      expect(html).toContain('hreflang="x-default" href="https://bitcoinloancheck.com/"');
    });
    it(`${lang}: preview tags for messengers and X`, () => {
      expect(unesc(tag(html, 'property', 'og:title'))).toBe(tx.ogTitle);
      expect(tag(html, 'property', 'og:url')).toBe(url);
      expect(tag(html, 'property', 'og:image')).toBe(`https://bitcoinloancheck.com/og-${lang}.png`);
      expect(tag(html, 'property', 'og:image:width')).toBe('1200');
      expect(tag(html, 'property', 'og:image:height')).toBe('630');
      expect(tag(html, 'name', 'twitter:card')).toBe('summary_large_image');
      // no tracking parameters anywhere
      expect(html).not.toMatch(/utm_[a-z]+=/);
    });
  }
  it('preview images: 1200 x 630, under 300 KB (WhatsApp ignores larger ones); icons exist', () => {
    for (const lang of ['en', 'de']) {
      expect(pngSize(file(`og-${lang}.png`))).toEqual([1200, 630]);
      expect(statSync(file(`og-${lang}.png`)).size).toBeLessThan(300 * 1024);
    }
    expect(pngSize(file('apple-touch-icon.png'))).toEqual([180, 180]);
    expect(readFileSync(file('favicon.svg'), 'utf8')).toMatch(/^<svg /);
  });
});

describe.skipIf(!existsSync(file('robots.txt')))('search engines and missing addresses', () => {
  it('robots.txt allows the site and names the sitemap', () => {
    const r = readFileSync(file('robots.txt'), 'utf8');
    expect(r).toMatch(/^User-agent: \*\nAllow: \//);
    expect(r).toContain('Sitemap: https://bitcoinloancheck.com/sitemap.xml');
  });
  it('the sitemap lists both language pages, each with its alternate', () => {
    const x = readFileSync(file('sitemap.xml'), 'utf8');
    expect(x).toContain('<loc>https://bitcoinloancheck.com/</loc>');
    expect(x).toContain('<loc>https://bitcoinloancheck.com/de/</loc>');
    expect((x.match(/hreflang="de"/g) || []).length).toBe(2);
  });
  it('a real "not found" page exists (so unknown addresses get 404, not the whole page), not listed by search engines', () => {
    const h = readFileSync(file('404.html'), 'utf8');
    expect(h).toContain('<meta name="robots" content="noindex">');
    expect(h).toContain('href="/de/"');
  });
});
