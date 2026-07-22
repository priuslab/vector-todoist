import { test } from '@playwright/test';
test('accessibility audit requires an explicit deployed fixture', async () => {
  test.skip(!process.env.AUDIT_BASE_URL || !process.env.AUDIT_AUTH_STATE, 'Set AUDIT_BASE_URL and AUDIT_AUTH_STATE.');
});
