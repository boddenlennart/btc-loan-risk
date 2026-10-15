// Builds the single-file page: docs/index.html (GitHub Pages serves the docs folder).
// Inlines the styles, the app code, the worker code and the compressed price history.
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

async function bundle(entry) {
  const r = await build({ entryPoints: [new URL(entry, root).pathname], bundle: true, write: false, format: 'iife', minify: true, target: ['es2020'], legalComments: 'none' });
  return r.outputFiles[0].text;
}

const meta = JSON.parse(read('data/meta.json'));
const file = (cur) => new URL(`data/btc-${cur.toLowerCase()}-1h.bin.gz`, root);
const currencies = ['EUR', 'USD'].filter((c) => existsSync(file(c)) && meta[c]);
if (currencies.length < 2) console.warn(`WARNING: only ${currencies.join(', ')} price history available`);
const b64 = (cur) => (currencies.includes(cur) ? readFileSync(file(cur)).toString('base64') : '');
const pageMeta = { prices: Object.fromEntries(currencies.map((c) => [c, meta[c]])), built: Math.floor(Date.now() / 1000) };

let html = read('src/app/index.html');
const parts = {
  '/*STYLE*/': read('src/app/style.css'),
  '/*META*/': JSON.stringify(pageMeta),
  '/*DATA_USD*/': b64('USD'),
  '/*DATA_EUR*/': b64('EUR'),
  '/*WORKER*/': safe(await bundle('src/app/worker.js')),
  '/*APP*/': safe(await bundle('src/app/main.js')),
};
for (const [k, v] of Object.entries(parts)) html = html.replace(k, () => v);
// Remind the owner while the legal templates still contain «placeholders».
for (const lang of ['de', 'en']) {
  const n = (read(`src/content/text.${lang}.js`).match(/«[^»]*»/g) || []).length;
  if (n) console.warn(`NOTE: src/content/text.${lang}.js still has ${n} «placeholders» in the Impressum / privacy notice`);
}
mkdirSync(new URL('docs/', root), { recursive: true });
writeFileSync(new URL('docs/index.html', root), html);
console.log(`docs/index.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
