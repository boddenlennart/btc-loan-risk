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
