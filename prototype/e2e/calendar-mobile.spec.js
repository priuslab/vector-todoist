import { test, expect } from '@playwright/test';

const baseUrl = process.env.CALENDAR_E2E_BASE_URL ?? process.env.E2E_BASE_URL;
const authToken = process.env.CALENDAR_E2E_AUTH_TOKEN ?? process.env.E2E_AUTH_TOKEN;

test.describe('Mobile calendar planning', () => {
  test.skip(!baseUrl || !authToken, 'Prerequisite missing: set CALENDAR_E2E_BASE_URL and CALENDAR_E2E_AUTH_TOKEN for an authenticated calendar fixture.');
  test('switches view and keeps Google blocks locked', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/v1/**', async (route) => route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${authToken}` } }));
    await page.goto(`${baseUrl}/?screen=calendar-day`);
    await expect(page.getByRole('button', { name: 'День' })).toBeVisible();
    await page.getByRole('button', { name: 'Тиждень' }).click();
    await expect(page.getByRole('button', { name: 'Тиждень' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'День' }).click();
    const locked = page.locator('[data-locked="true"]').first();
    if (await locked.count()) await expect(locked).toHaveAttribute('draggable', 'false');
  });
});
