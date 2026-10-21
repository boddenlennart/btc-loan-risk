// Unit, engine, regression and data tests (npm test). The browser tests in e2e/ run with Playwright (npm run test:e2e).
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.js'], testTimeout: 60_000 } });
