import { test, expect } from '@playwright/test';

/*
 * This suite is deliberately fixture-gated. It must never turn a local mock or
 * an unauthenticated landing page into a production acceptance pass.
 * Required variables are documented in docs/qa/p0-a-acceptance.md.
 */
const productionUrl = process.env.PRODUCTION_BASE_URL;
const authToken = process.env.PRODUCTION_AUTH_TOKEN;
const authState = process.env.PRODUCTION_AUTH_STATE;
const isNonLocalProductionUrl = Boolean(productionUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(productionUrl);
const fixtureText = process.env.PRODUCTION_BRAIN_DUMP_TEXT ?? 'Підготувати структуру першого епізоду та написати Марії про запис.';

test.describe('P0-A production core', () => {
  test.describe('landing', () => {
    test.skip(!isNonLocalProductionUrl, 'Prerequisite missing: set PRODUCTION_BASE_URL to a non-local deployed Vercel URL.');
    test('is reachable at the explicit production URL', async ({ page }) => {
    await page.goto(productionUrl);
    await expect(page.getByText('Вислови все, що в голові')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Продовжити з Google' })).toBeVisible();
    });
  });

  test.describe('authenticated core', () => {
    test.skip(!isNonLocalProductionUrl || !authToken || !authState,
      'Prerequisites missing: set a non-local PRODUCTION_BASE_URL, PRODUCTION_AUTH_TOKEN, and PRODUCTION_AUTH_STATE for a dedicated authenticated test fixture.');
    test('Brain Dump → Today → edit → Undo survives reload', async ({ page }) => {

    await page.addInitScript((raw) => {
      window.localStorage.setItem('pocketbase_auth', raw);
    }, authState);
    await page.route('**/api/v1/**', async (route) => {
      await route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${authToken}` } });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(productionUrl);

    // The production fixture must already be authenticated; a login bypass is not
    // fabricated by this test. If the app redirects, fail with a useful prerequisite.
    if (await page.getByRole('button', { name: 'Продовжити з Google' }).count()) {
      throw new Error('Authenticated fixture prerequisite failed: production redirected to Google login.');
    }

    await page.getByRole('button', { name: 'Brain Dump' }).click();
    await page.getByRole('button', { name: 'Диктувати' }).click();
    await expect(page.getByText(/Голосовий запис недоступний|Готовий записати твої думки/)).toBeVisible();
    await page.getByRole('button', { name: 'Написати текстом' }).click();
    const editor = page.getByRole('textbox', { name: 'Редагувати транскрипт' });
    await editor.fill(fixtureText);
    await page.getByRole('button', { name: 'Зберегти чернетку' }).click();
    await expect(page.getByText(/Аналіз готовий|План готовий/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Переглянути пропозиції' }).click();
    await page.getByRole('button', { name: 'Застосувати план' }).click();
    await expect(page.getByRole('heading', { name: 'Спокійний план на день' })).toBeVisible();

    const task = page.getByText('Підготувати структуру першого епізоду').first();
    await expect(task).toBeVisible();
    await page.getByRole('button', { name: 'Inbox' }).click();
    await page.getByText('Підготувати структуру першого епізоду').first().click();
    await page.getByRole('button', { name: 'Редагувати' }).click();
    const title = page.getByRole('textbox', { name: 'Назва' });
    await title.fill('Підготувати структуру першого епізоду — оновлено');
    await page.getByRole('button', { name: 'Зберегти зміни' }).click();
    await expect(page.getByText('Підготувати структуру першого епізоду — оновлено')).toBeVisible();
    await page.getByRole('button', { name: 'Сьогодні' }).click();
    await page.getByRole('button', { name: /Виконати:/ }).first().click();
    await expect(page.getByRole('button', { name: 'Скасувати' })).toBeVisible();
    await page.getByRole('button', { name: 'Скасувати' }).click();
    await page.reload();
    await expect(page.getByText('Підготувати структуру першого епізоду').first()).toBeVisible();
    });
  });
});
