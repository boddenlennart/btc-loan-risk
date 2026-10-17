// How much of the page's own code the browser tests run. Builds an unminified copy of the page
// (ux/coverage-site, not committed), runs all browser tests against it with Chromium's coverage
// recorder, and reports per source file: share of code run, and the named functions never run.
// Usage: node tools/coverage-e2e.mjs        (PLAYWRIGHT_BROWSERS_PATH=.tools/ms-playwright)
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const SITE = 'ux/coverage-site'; const COV = `${SITE}/cov`;
const run = (cmd, env) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(`${root}${SITE}`, { recursive: true, force: true });
run('node tools/build.mjs', { BUILD_OUT: SITE, BUILD_MINIFY: '0' });
try {
  run('npx playwright test', { E2E_DIR: SITE, E2E_PORT: '8798', E2E_COVERAGE: `${root}${COV}` });
} catch { console.log('(some browser tests failed; coverage is reported for the tests that ran)'); }

// Per script source: which bytes ran in at least one test (V8 block coverage: inner ranges
// refine outer ones, so ranges are applied from largest to smallest).
const covered = new Map(); const fnRuns = new Map();
for (const f of readdirSync(`${root}${COV}`)) {
  for (const e of JSON.parse(readFileSync(`${root}${COV}/${f}`, 'utf8'))) {
    if (!covered.has(e.source)) covered.set(e.source, new Uint8Array(e.source.length));
    const acc = covered.get(e.source); const once = new Uint8Array(e.source.length);
    const ranges = e.functions.flatMap((fn) => fn.ranges).sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
    for (const r of ranges) once.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset);
    for (let i = 0; i < acc.length; i++) acc[i] |= once[i];
    for (const fn of e.functions) {
      if (!fn.functionName) continue;
      const key = `${fn.ranges[0].startOffset}:${fn.functionName}`;
      fnRuns.set(key, (fnRuns.get(key) || 0) + (fn.ranges[0].count > 0 ? 1 : 0));
    }
  }
}
// The page's script: the biggest source. esbuild marks each module with a "// src/..." comment.
const [source, acc] = [...covered.entries()].sort((a, b) => b[0].length - a[0].length)[0];
const marks = [...source.matchAll(/^\s*\/\/ (src\/[\w/.-]+\.js)$/gm)].map((m) => ({ file: m[1], at: m.index }));
const moduleAt = (pos) => { let f = '(library)'; for (const m of marks) if (m.at <= pos) f = m.file; return f; };
const stats = new Map();
for (let i = 0; i < source.length; i++) {
  if (/\s/.test(source[i])) continue;
  const f = moduleAt(i); const s = stats.get(f) || { all: 0, run: 0 };
  s.all++; s.run += acc[i]; stats.set(f, s);
}
console.log('\nBrowser tests: share of each page file that ran (non-blank characters)');
for (const [f, s] of [...stats.entries()].filter(([f]) => f.startsWith('src/app') || f.startsWith('src/live')).sort()) {
  console.log(`  ${f.padEnd(26)} ${(100 * s.run / s.all).toFixed(1).padStart(5)}%`);
}
const never = [...fnRuns.entries()].filter(([, n]) => n === 0).map(([k]) => { const [at, name] = k.split(':'); return { name, file: moduleAt(Number(at)) }; })
  .filter((x) => x.file.startsWith('src/app/main') || x.file.startsWith('src/app/charts') || x.file.startsWith('src/live'));
console.log(`\nNamed page functions never run by any browser test (${never.length}):`);
for (const x of never) console.log(`  ${x.file}: ${x.name}`);
