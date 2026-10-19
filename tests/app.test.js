// Small page helpers: the shareable link and the feedback e-mail.
import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from '../src/app/share.js';
import { feedbackText, mailtoLink } from '../src/app/feedback.js';
import { EXAMPLE_FORM } from '../src/content/examples.js';

describe('shareable link', () => {
  it('stores the inputs and gets them back exactly', () => {
    const state = { ...EXAMPLE_FORM, loanAmount: '12345', notes: 'private note', btcPrice: 70000 };
    const back = decodeState(encodeState(state));
    expect(back.loanAmount).toBe('12345');
    expect(back.ratePath).toEqual(EXAMPLE_FORM.ratePath);
    expect(back.marginCallConsequence).toBe(EXAMPLE_FORM.marginCallConsequence);
  });
  it('leaves out the BTC price and the private note', () => {
    const back = decodeState(encodeState({ ...EXAMPLE_FORM, notes: 'private note', btcPrice: 70000 }));
    expect(back).not.toHaveProperty('btcPrice');
    expect(back).not.toHaveProperty('notes');
  });
  it('the data sits after "#", so browsers never send it to a server', () => {
    expect(encodeState(EXAMPLE_FORM)).toMatch(/^#s=[A-Za-z0-9_-]+$/);
  });
  it('broken or foreign links are ignored', () => {
    expect(decodeState('#s=%%%')).toBeNull();
    expect(decodeState('#something')).toBeNull();
    expect(decodeState('')).toBeNull();
  });
  it('handles non-ASCII text (e.g. German umlauts) in values', () => {
    expect(decodeState(encodeState({ ...EXAMPLE_FORM, currency: 'EUR', dayCount: 'äöü' })).dayCount).toBe('äöü');
  });
});

describe('feedback e-mail (criterion D9)', () => {
  const base = { use: 'Buy more BTC', meaning: 'chance my BTC gets sold', useful: 6, easy: 5, missing: '', version: '2026-11-02', lang: 'de', device: 'phone' };
  it('contains F1–F5, page version, language and device', () => {
    const t = feedbackText(base);
    for (const s of ['Use: Buy more BTC', 'Big number means: chance my BTC gets sold', '6/7', '5/7', 'Confusing / missing: -', '2026-11-02', 'Language: de', 'Device: phone']) {
      expect(t).toContain(s);
    }
  });
  it('contains no loan terms unless the visitor ticked the box', () => {
    expect(feedbackText(base)).toContain('(no loan terms attached)');
    expect(feedbackText({ ...base, terms: { loanAmount: 15000 } })).toContain('"loanAmount":15000');
  });
  it('builds a mailto link with encoded subject and body', () => {
    const link = mailtoLink('a@b.c', 'BTC loan check feedback', 'line 1\nline 2 & more');
    expect(link).toBe('mailto:a@b.c?subject=BTC%20loan%20check%20feedback&body=line%201%0Aline%202%20%26%20more');
  });
});

describe('share link with a comparison', () => {
  it('two or three offers, the selected one and their names come back; broken comparisons are ignored', async () => {
    const { encodeState, decodeLink } = await import('../src/app/share.js');
    const { EXAMPLE_FORM } = await import('../src/content/examples.js');
    const B = { ...EXAMPLE_FORM, initialLtv: 35 };
    const R = { ...EXAMPLE_FORM, refi: { change: 'more', extra: 2000 } };
    const d = decodeLink(encodeState(B, { kind: 'offers', active: 1, names: ['', 'Mine'], offers: [EXAMPLE_FORM, B] }));
    expect(d.form.initialLtv).toBe(35);
    expect(d.compare.active).toBe(1);
    expect(d.compare.names[1]).toBe('Mine');
    expect(d.compare.offers.map((o) => o.initialLtv)).toEqual([50, 35]);
    const r = decodeLink(encodeState(R, { kind: 'refi', active: 1, names: [], offers: [EXAMPLE_FORM, R] }));
    expect(r.compare.offers[1].refi).toEqual({ change: 'more', extra: 2000 });
    // a link with a broken comparison still opens the offer, without the comparison
    const bad = decodeLink(encodeState(B, { kind: 'offers', active: 5, names: [], offers: [EXAMPLE_FORM, B] }));
    expect(bad.form.initialLtv).toBe(35);
    expect(bad.compare).toBeNull();
    // the price and the private note are still left out
    const p = decodeLink(encodeState({ ...B, btcPrice: 1, notes: 'x' }, { kind: 'offers', active: 0, names: [], offers: [{ ...B, btcPrice: 1, notes: 'x' }, B] }));
    expect(p.form.btcPrice).toBeUndefined();
    expect(p.compare.offers[0].notes).toBeUndefined();
  });
});

describe('share link: the model settings are fixed and never travel in a link', async () => {
  const { encodeState, decodeLink } = await import('../src/app/share.js');
  it('futures and piece length are left out', () => {
    const link = encodeState({ loanAmount: 1000, simPaths: '2000', bootstrapBlockDays: 5 });
    const back = decodeLink(link).form;
    expect(back.loanAmount).toBe(1000);
    expect(back.simPaths).toBeUndefined();
    expect(back.bootstrapBlockDays).toBeUndefined();
  });
});
