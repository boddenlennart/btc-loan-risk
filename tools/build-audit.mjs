// Builds a test copy of the page for the accessibility audit only (never published):
// docs/index.html without its Content Security Policy, plus the axe-core checker inlined.
// Usage: node tools/build-audit.mjs  → ux/audit/index.html (served by the "sketches"-style preview)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const page = readFileSync(new URL('docs/index.html', root), 'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
const axe = readFileSync(new URL('node_modules/axe-core/axe.min.js', root), 'utf8').replace(/<\/script/gi, '<\\/script');
mkdirSync(new URL('ux/audit/', root), { recursive: true });
writeFileSync(new URL('ux/audit/index.html', root), page.replace('</body>', `<script>${axe}</script></body>`));
console.log('ux/audit/index.html written');
