// End-to-end tests of the built page (docs/index.html) in a real browser engine.
// Run: npm run test:e2e   (browsers are kept in .tools/ms-playwright)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 3,
  reporter: [['list']],
  // E2E_DIR / E2E_PORT: test another build of the page (only for the coverage measurement)
  use: { baseURL: `http://127.0.0.1:${process.env.E2E_PORT || 8799}`, ...devices['Desktop Chrome'] },
  webServer: { command: `node tools/serve.mjs ${process.env.E2E_PORT || 8799} ${process.env.E2E_DIR || 'docs'}`, url: `http://127.0.0.1:${process.env.E2E_PORT || 8799}/`, reuseExistingServer: true },
});
