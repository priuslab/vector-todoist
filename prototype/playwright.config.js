import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4174' },
});
