// The scheduled data-update workflow: runs weekly, checks everything, opens a pull
// request, tells the owner about failures, and never merges by itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const text = readFileSync(new URL('../.github/workflows/update-data.yml', import.meta.url), 'utf8');
const wf = parse(text);
const steps = wf.jobs.update.steps;
const run = (name) => steps.find((s) => s.name && s.name.startsWith(name));

const tests = parse(readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8'));

describe('test workflow for every other change', () => {
  it('runs on every push and pull request, with all tests and the browser tests', () => {
    expect(tests.on).toHaveProperty('push');
    expect(tests.on).toHaveProperty('pull_request');
    const runs = tests.jobs.test.steps.map((s) => s.run || '').join('\n');
    expect(runs).toMatch(/npm test/);
    expect(runs).toMatch(/npm run test:e2e/);
  });
});

describe('data-update workflow', () => {
  it('is valid YAML with a weekly schedule and a manual "Run workflow" button', () => {
    expect(wf.on.schedule[0].cron).toMatch(/^\d+ \d+ \* \* [0-6]$/);
    expect(wf.on).toHaveProperty('workflow_dispatch');
  });
  it('runs the update, rebuilds the page, runs all tests and the browser tests, then opens a pull request — in that order', () => {
    const names = steps.map((s) => s.name || '');
    const i = (n) => names.findIndex((x) => x.startsWith(n));
    expect(i('Fetch, check and append')).toBeLessThan(i('Rebuild the page'));
    expect(i('Rebuild the page')).toBeLessThan(i('Run the full test suite'));
    expect(i('Run the full test suite')).toBeLessThan(i('Test the finished page in a real browser'));
    expect(i('Test the finished page in a real browser')).toBeLessThan(i('Open a pull request'));
    expect(run('Test the finished page').run).toMatch(/npm run test:e2e/);
    expect(run('Run the full test suite').run).toBe('npm test');
  });
  it('the pull request is assigned to the owner and asks for their review (so GitHub notifies them)', () => {
    expect(run('Open a pull request').run).toMatch(/--assignee "\$\{GITHUB_REPOSITORY_OWNER\}" --reviewer "\$\{GITHUB_REPOSITORY_OWNER\}"/);
  });
  it('the passed tests show as a check mark on the pull request (commit status, after the tests)', () => {
    const r = run('Open a pull request').run;
    expect(r).toMatch(/statuses\/\$\(git rev-parse HEAD\)/);
    expect(r).toMatch(/state=success/);
    expect(wf.permissions.statuses).toBe('write');
  });
  it('never merges by itself', () => {
    expect(text).not.toMatch(/gh pr merge|auto-merge|--auto\b|enable-auto-merge|merge_method/i);
  });
  it('tells the owner when something failed', () => {
    const s = run('Tell the owner');
    expect(s.if).toBe('failure()');
    expect(s.run).toMatch(/gh issue (create|comment)/);
  });
  it('uses no stored secrets (only the run\'s own short-lived token)', () => {
    expect(text).not.toMatch(/secrets\./);
  });
});
