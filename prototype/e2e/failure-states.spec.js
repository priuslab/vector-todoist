import { test } from '@playwright/test';
test('failure-state audit requires an explicit deployed fixture', async () => {
  test.skip(!process.env.AUDIT_FAILURE_FIXTURE || !process.env.AUDIT_BASE_URL, 'Set AUDIT_FAILURE_FIXTURE and AUDIT_BASE_URL.');
});
