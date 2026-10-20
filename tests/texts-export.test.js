// The owner reads every page text in ux/review/texts-review.md. It must always match the texts the page uses
// (it was once out of date: go/no-go G3). After changing a text: node tools/export-texts.mjs
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('the text export for the owner\'s reading', () => {
  it('is current: a fresh export equals the stored file', () => {
    const fresh = join(mkdtempSync(join(tmpdir(), 'texts-')), 'texts-review.md');
    execFileSync(process.execPath, ['tools/export-texts.mjs'], { env: { ...process.env, EXPORT_TO: fresh } });
    expect(readFileSync(fresh, 'utf8') === readFileSync('ux/review/texts-review.md', 'utf8'), 'run: node tools/export-texts.mjs').toBe(true);
  });
});
