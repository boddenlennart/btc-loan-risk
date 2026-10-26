// The scheduled data-update workflow: runs weekly, checks everything, opens a pull
// request, tells the owner about failures, and never merges by itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const text = readFileSync(new URL('../.github/workflows/update-data.yml', import.meta.url), 'utf8');
const wf = parse(text);

const tests = parse(readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8'));

describe('test workflow for every other change', () => {
  it('runs on every push and pull request, with all tests and the browser tests', () => {
    expect(tests.on).toHaveProperty('push');
    expect(tests.on).toHaveProperty('pull_request');
    const runs = (job) => tests.jobs[job].steps.map((s) => s.run || '').join('\n');
    expect(runs('unit')).toMatch(/npm test/);
    // the browser tests run in all five setups of playwright.config.js, side by side
    expect(runs('browser')).toMatch(/npx playwright test --project=\$\{\{ matrix\.project \}\}/);
    const projects = tests.jobs.browser.strategy.matrix.include.map((m) => m.project).sort();
    const config = readFileSync(new URL('../playwright.config.js', import.meta.url), 'utf8');
    expect(projects).toEqual([...config.matchAll(/name: '([a-z]+)'/g)].map((m) => m[1]).sort());
    expect(tests.jobs.browser.strategy['fail-fast']).toBe(false);
  });
  it('"test", the check the protected main branch requires, is green only when the unit tests and every setup passed', () => {
    const t = tests.jobs.test;
    expect(t.needs).toEqual(['unit', 'browser']);
    expect(t.if).toBe('always()'); // also runs (and fails) when one of them failed, instead of being skipped
    expect(t.steps.map((s) => s.run).join('\n')).toMatch(/needs\.unit\.result \}\}" = success && test "\$\{\{ needs\.browser\.result \}\}" = success/);
  });
});

describe('data-update workflow', () => {
  const job = (id) => wf.jobs[id];
  const stepIn = (id, name) => job(id).steps.find((s) => s.name && s.name.startsWith(name));
  it('is valid YAML with a weekly schedule and a manual "Run workflow" button', () => {
    expect(wf.on.schedule[0].cron).toMatch(/^\d+ \d+ \* \* [0-6]$/);
    expect(wf.on).toHaveProperty('workflow_dispatch');
  });
  it('fetches, rebuilds and runs all unit tests, then the browser tests, then opens a pull request — in that order', () => {
    const names = job('update').steps.map((s) => s.name || '');
    const i = (n) => names.findIndex((x) => x.startsWith(n));
    expect(i('Fetch, check and append')).toBeLessThan(i('Rebuild the page'));
    expect(i('Rebuild the page')).toBeLessThan(i('Rebuild the link-preview images'));
    expect(i('Rebuild the link-preview images')).toBeLessThan(i('Run the full test suite'));
    expect(stepIn('update', 'Rebuild the link-preview images').run).toMatch(/node tools\/build-og\.mjs\s+node tools\/build\.mjs/); // images, then the pages with their stamp
    expect(i('Run the full test suite')).toBeLessThan(i('Save the update on its own branch'));
    expect(stepIn('update', 'Run the full test suite').run).toBe('npm test');
    expect(job('browser').needs).toBe('update');
    expect(job('publish').needs).toEqual(['update', 'browser']); // the pull request only after every browser setup passed
  });
  it('the browser tests run in all five setups of playwright.config.js, side by side, as for every other change', () => {
    const projects = job('browser').strategy.matrix.include.map((m) => m.project).sort();
    const config = readFileSync(new URL('../playwright.config.js', import.meta.url), 'utf8');
    expect(projects).toEqual([...config.matchAll(/name: '([a-z]+)'/g)].map((m) => m[1]).sort());
    expect(job('browser').strategy['fail-fast']).toBe(false);
    expect(stepIn('browser', 'Test the finished page').run).toMatch(/npx playwright test --project=\$\{\{ matrix\.project \}\}/);
    expect(job('browser').steps[0].with.ref).toBe('${{ needs.update.outputs.branch }}'); // the updated data, not main
  });
  it('the pull request goes into the branch the run started from (main on Mondays; a test run on another branch never touches main)', () => {
    expect(stepIn('publish', 'Open a pull request').run).toMatch(/gh pr create --base "\$\{GITHUB_REF_NAME\}"/);
  });
  it('the pull request is assigned to the owner and asks for their review (so GitHub notifies them)', () => {
    expect(stepIn('publish', 'Open a pull request').run).toMatch(/--assignee "\$\{GITHUB_REPOSITORY_OWNER\}" --reviewer "\$\{GITHUB_REPOSITORY_OWNER\}"/);
  });
  it('the passed tests show as a check mark on the pull request (commit status "test", after the tests)', () => {
    const r = stepIn('publish', 'Open a pull request').run;
    expect(r).toMatch(/statuses\/\$\(git rev-parse HEAD\)/);
    expect(r).toMatch(/state=success/);
    expect(r).toMatch(/"test"/);
    expect(wf.permissions.statuses).toBe('write');
  });
  it('never merges by itself', () => {
    expect(text).not.toMatch(/gh pr merge|auto-merge|--auto\b|enable-auto-merge|merge_method/i);
  });
  it('tells the owner when anything failed, and removes the unfinished branch', () => {
    expect(job('notify').if).toBe('failure()');
    expect(job('notify').needs).toEqual(['update', 'browser', 'publish']);
    const r = stepIn('notify', 'Tell the owner').run;
    expect(r).toMatch(/gh issue (create|comment)/);
    expect(r).toMatch(/git\/refs\/heads\/\$BRANCH/);
  });
  it('uses no stored secrets (only the run\'s own short-lived token)', () => {
    expect(text).not.toMatch(/secrets\./);
  });
});

// 26 Oct 2026: on GitHub's newer Ubuntu ("ubuntu-latest" from 19 Oct), installing the browsers took up to
// 30 minutes and Safari's engine hit the time limit. The computers are pinned; a move is a deliberate change.
describe('GitHub\'s computers for both workflows', () => {
  for (const [name, w] of [['tests.yml', tests], ['update-data.yml', wf]]) {
    it(`${name}: every job runs on Ubuntu 24.04, never on "the newest" that can change underneath`, () => {
      for (const [id, job] of Object.entries(w.jobs)) expect(job['runs-on'], `${name} › ${id}`).toBe('ubuntu-24.04');
    });
    it(`${name}: no action of an outdated generation (checkout and setup-node v4 ran on an old Node version)`, () => {
      const uses = Object.values(w.jobs).flatMap((j) => j.steps.map((s) => s.uses).filter(Boolean));
      expect(uses.filter((u) => /^actions\/(checkout|setup-node)@v[1-4]$/.test(u))).toEqual([]);
    });
    it(`${name}: installing the browser is its own step with its own time limit, before the tests; the browser is kept between runs`, () => {
      const steps = w.jobs.browser.steps; const names = steps.map((s) => s.name || '');
      const install = steps.find((s) => (s.name || '').startsWith('Install the browser'));
      const test = steps.find((s) => /^(The finished page|Test the finished page)/.test(s.name || ''));
      expect(install.run).toMatch(/npx playwright install --with-deps \$\{\{ matrix\.engine \}\}/);
      expect(install['timeout-minutes']).toBeGreaterThan(0);
      expect(test['timeout-minutes']).toBeGreaterThan(0);
      expect(names.indexOf(install.name)).toBeLessThan(names.indexOf(test.name));
      expect(steps.some((s) => (s.uses || '').startsWith('actions/cache@') && s.with.path === '~/.cache/ms-playwright')).toBe(true);
    });
  }
});
