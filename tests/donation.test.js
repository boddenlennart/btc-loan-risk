// Donation box (criterion D8): the address is a valid Bitcoin address, and the QR
// code in the built page decodes, with an independent QR reader, to exactly
// "bitcoin:" + that address.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { SITE } from '../src/content/site.js';

// BIP-173 / BIP-350 checksum (reference algorithm)
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values) {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= G[i];
  }
  return chk >>> 0;
}
function segwitOk(addr) {
  const a = addr.toLowerCase(); const pos = a.lastIndexOf('1');
  const hrp = a.slice(0, pos); const data = [...a.slice(pos + 1)].map((c) => CHARSET.indexOf(c));
  if (hrp !== 'bc' || data.some((d) => d < 0)) return false;
  const c = polymod([...[...hrp].map((ch) => ch.charCodeAt(0) >> 5), 0, ...[...hrp].map((ch) => ch.charCodeAt(0) & 31), ...data]);
  return data[0] === 0 ? c === 1 : c === 0x2bc830a3; // v0 = bech32, v1+ = bech32m
}

describe('donation address', () => {
  it('is a valid mainnet SegWit address (checksum correct)', () => {
    expect(segwitOk(SITE.donationAddress)).toBe(true);
  });
  it('a single wrong character is detected', () => {
    const a = SITE.donationAddress;
    const typo = a.slice(0, 20) + (a[20] === 'q' ? 'p' : 'q') + a.slice(21);
    expect(segwitOk(typo)).toBe(false);
  });
});

describe('donation QR code', () => {
  const data = `bitcoin:${SITE.donationAddress}`;
  it('the QR pattern decodes, with an independent reader, to exactly bitcoin:<address>', () => {
    const { modules } = QRCode.create(data, { errorCorrectionLevel: 'M' });
    const scale = 6; const margin = 4 * scale; const n = modules.size; const w = n * scale + 2 * margin;
    const px = new Uint8ClampedArray(w * w * 4).fill(255);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const i = ((margin + y * scale + dy) * w + margin + x * scale + dx) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
    }
    expect(jsQR(px, w, w).data).toBe(data);
  });
  it.skipIf(!existsSync(new URL('../docs/index.html', import.meta.url)))('the built page contains exactly that QR picture', async () => {
    const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
    const svg = await QRCode.toString(data, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
    const path = svg.match(/<path[^>]*stroke="#000000"[^>]*\/>/)[0];
    expect(html).toContain(path);
  });
});
