// The scheduled data-update workflow: runs weekly, checks everything, opens a pull
// request, tells the owner about failures, and never merges by itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const text = readFileSync(new URL('../.github/workflows/update-data.yml', import.meta.url), 'utf8');
const wf = parse(text);
const steps = wf.jobs.update.steps;
const run = (name) => steps.find((s) => s.name && s.name.startsWith(name));

describe('data-update workflow', () => {
  it('is valid YAML with a weekly schedule and a manual "Run workflow" button', () => {
    expect(wf.on.schedule[0].cron).toMatch(/^\d+ \d+ \* \* [0-6]$/);
    expect(wf.on).toHaveProperty('workflow_dispatch');
  });
  it('runs the update, rebuilds the page, runs the full test suite, then opens a pull request — in that order', () => {
    const names = steps.map((s) => s.name || '');
    const i = (n) => names.findIndex((x) => x.startsWith(n));
    expect(i('Fetch, check and append')).toBeLessThan(i('Rebuild the page'));
    expect(i('Rebuild the page')).toBeLessThan(i('Run the full test suite'));
    expect(i('Run the full test suite')).toBeLessThan(i('Open a pull request'));
    expect(run('Run the full test suite').run).toBe('npm test');
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
