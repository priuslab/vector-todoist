import { test, expect } from '@playwright/test';

// Requires a deployed Gateway + PocketBase test fixture. No production mock flags are used.
test.describe('P0-A Brain Dump → Today', () => {
  test.skip(!process.env.E2E_BASE_URL || !process.env.E2E_AUTH_TOKEN, 'Set E2E_BASE_URL and E2E_AUTH_TOKEN for the authenticated deterministic fixture');
  test('creates a plan and keeps an idea in Inbox', async ({ page }) => {
    const token = process.env.E2E_AUTH_TOKEN;
    await page.route('**/api/v1/**', async (route) => {
      const headers = { ...route.request().headers(), authorization: `Bearer ${token}` };
      await route.continue({ headers });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${process.env.E2E_BASE_URL}/?screen=capture-chooser`);
    await page.getByRole('button', { name: 'Написати текстом' }).click();
    const editor = page.getByRole('textbox', { name: 'Редагувати транскрипт' });
    await editor.fill('Підготувати структуру епізоду. Зробити епізод про синдром самозванця.');
    await page.getByRole('button', { name: 'Зберегти чернетку' }).click();
    await expect(page.getByText(/Аналіз готовий|План готовий/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Переглянути пропозиції' }).click();
    await expect(page.getByRole('button', { name: 'Застосувати план' })).toBeVisible();
    await page.getByRole('button', { name: 'Застосувати план' }).click();
    await expect(page).toHaveURL(/today-normal/);
    await expect(page.getByText('Підготувати структуру епізоду')).toBeVisible();
    await page.getByRole('button', { name: 'Inbox' }).click();
    await expect(page.getByText('Зробити епізод про синдром самозванця')).toBeVisible();
  });
});
