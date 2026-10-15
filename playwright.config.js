// End-to-end tests of the built page (docs/index.html) in a real browser engine.
// Run: npm run test:e2e   (browsers are kept in .tools/ms-playwright)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 3,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8799', ...devices['Desktop Chrome'] },
  webServer: { command: 'node tools/serve.mjs 8799', url: 'http://127.0.0.1:8799/', reuseExistingServer: true },
});
