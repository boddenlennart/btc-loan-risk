// Builds ux/sketches/sketches.html from the template, the computed numbers and a QR code.
// Usage: node ux/sketches/compute-numbers.mjs && node ux/sketches/build-sketches.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const ADDRESS = 'bc1qvj6cdm0mjea5pllsf8y3ezga0g8kq0cxuq3ufl0yx3ae9f27qj4snpj8ld';
const here = (f) => new URL(f, import.meta.url);
const qr = await QRCode.toString(`bitcoin:${ADDRESS}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 96 });
const html = readFileSync(here('sketches.src.html'), 'utf8')
  .replace('/*NUMBERS*/', readFileSync(here('numbers.json'), 'utf8'))
  .replace('/*QR*/', qr.replace('<svg ', '<svg width="96" height="96" '))
  .replace('/*ADDR*/', ADDRESS);
writeFileSync(here('sketches.html'), html);
console.log('ux/sketches/sketches.html written');
