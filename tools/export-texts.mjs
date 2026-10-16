// Writes ux/review/texts-review.md: every text on the page, numbered, English and German
// side by side, grouped by where it appears. For the plain-language review.
// Usage: node tools/export-texts.mjs
import { writeFileSync } from 'node:fs';
import en from '../src/content/text.en.js';
import de from '../src/content/text.de.js';

const GROUPS = [
  ['ui', 'Page frame and short messages'], ['form', 'Input form'], ['where', '"Where to find these numbers"'],
  ['results', 'Answer, "Make it safer"'], ['sections', 'Section titles'], ['falls', 'Section: what happens when BTC falls'],
  ['cost', 'Section: costs, borrow or sell, leverage'], ['history', 'Section: what history says'], ['method', 'Section: how these numbers are made'],
  ['feedback', 'Feedback panel'], ['donate', 'Donation box'], ['footer', 'Footer'], ['glossary', 'Glossary'], ['errors', 'Error messages'],
  ['legal', 'Impressum and privacy notice (templates; review by a lawyer)'], ['meta', 'Page title and search description'],
];
const flat = (o, p = '') => (typeof o === 'string' ? [[p, o]] : Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)));
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
let n = 0;
const out = ['# Plain-language review of all page texts', '',
  'How to review: read each row. Note the **number** of every text you do not understand, find unclear, too long or wrong, and say briefly why (for example: "112: what is a cure period?"). You don\'t have to fix the wording; I will. German and English are reviewed together: if one language is unclear, say which.', '',
  '`{curly}` words are filled in by the page with numbers or dates. `[[word]]` becomes a link to the glossary.', ''];
for (const [key, title] of GROUPS) {
  const rows = flat(en[key], key);
  const deMap = Object.fromEntries(flat(de[key], key));
  out.push(`## ${title}`, '', '| # | English | Deutsch | key |', '|---|---|---|---|');
  for (const [path, text] of rows) out.push(`| ${++n} | ${cell(text)} | ${cell(deMap[path] ?? '(missing)')} | \`${path}\` |`);
  out.push('');
}
writeFileSync(new URL('../ux/review/texts-review.md', import.meta.url), out.join('\n'));
console.log(`${n} texts written to ux/review/texts-review.md`);
