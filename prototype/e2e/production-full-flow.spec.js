import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/*
 * Full demo verification is intentionally opt-in. A local catalogue, a mock
 * API, or an unauthenticated redirect must never be reported as production
 * evidence. Keep the auth fixture and tokens outside the repository.
 * See docs/qa/final-release-report.md for the complete prerequisite list.
 */
const baseUrl = process.env.FULL_DEMO_BASE_URL;
const authStatePath = process.env.FULL_DEMO_AUTH_STATE;
const authToken = process.env.FULL_DEMO_AUTH_TOKEN;
const authState = authStatePath ? readFileSync(authStatePath, 'utf8') : null;
const isNonLocal = Boolean(baseUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(baseUrl);
const hasAuthFixture = isNonLocal && Boolean(authStatePath);
const runIntegration = process.env.FULL_DEMO_RUN === '1';
const runTelegram = runIntegration && process.env.FULL_DEMO_TELEGRAM === '1';
const runStripe = runIntegration && process.env.FULL_DEMO_STRIPE === '1';
const brainDump = process.env.FULL_DEMO_BRAIN_DUMP ??
  'Мені треба підготувати структуру першого епізоду, написати Марії про запис і не забути замовити корм коту.';

function installFixture(page) {
  if (authState) {
    return page.addInitScript((raw) => window.localStorage.setItem('pocketbase_auth', raw), authState);
  }
  return undefined;
}

async function addGatewayToken(page) {
  if (!authToken) return;
  await page.route('**/api/v1/**', async (route) => route.continue({
    headers: { ...route.request().headers(), authorization: `Bearer ${authToken}` },
  }));
}

test.describe('Vector production full-flow', () => {
  test.skip(!isNonLocal, 'Prerequisite missing: set FULL_DEMO_BASE_URL to a deployed, non-local URL.');

  test('public deployment opens the Ukrainian entry point', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    await expect(page.getByText('Вислови все, що в голові')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Продовжити з Google' })).toBeVisible();
  });

  test.describe('authenticated core path', () => {
    test.skip(!hasAuthFixture, 'Prerequisites missing: set non-local FULL_DEMO_BASE_URL and a dedicated FULL_DEMO_AUTH_STATE JSON fixture.');

    test.beforeEach(async ({ page }) => {
      await installFixture(page);
      await addGatewayToken(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(baseUrl);
      if (await page.getByRole('button', { name: 'Продовжити з Google' }).count()) {
        throw new Error('Authenticated fixture failed: production redirected to Google login.');
      }
    });

    test('Brain Dump → AI → Today → edit → Undo', async ({ page }) => {
      test.skip(!runIntegration, 'Set FULL_DEMO_RUN=1 to execute the authenticated production smoke flow.');
      await page.getByRole('button', { name: 'Brain Dump' }).click();
      await expect(page.getByRole('button', { name: 'Диктувати' })).toBeVisible();
      await page.getByRole('button', { name: 'Написати текстом' }).click();
      await page.getByRole('textbox', { name: 'Редагувати транскрипт' }).fill(brainDump);
      await page.getByRole('button', { name: 'Зберегти чернетку' }).click();
      await expect(page.getByText(/Аналіз готовий|План готовий/)).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Переглянути пропозиції' }).click();
      await page.getByRole('button', { name: 'Застосувати план' }).click();
      await expect(page.getByRole('heading', { name: 'Спокійний план на день' })).toBeVisible();
      await page.getByRole('button', { name: 'Inbox' }).click();
      await page.getByText('Підготувати структуру першого епізоду').first().click();
      await page.getByRole('button', { name: 'Редагувати' }).click();
      await page.getByRole('textbox', { name: 'Назва' }).fill('Підготувати структуру першого епізоду — демо');
      await page.getByRole('button', { name: 'Зберегти зміни' }).click();
      await expect(page.getByText('Підготувати структуру першого епізоду — демо')).toBeVisible();
      await page.getByRole('button', { name: 'Сьогодні' }).click();
      await page.getByRole('button', { name: /Виконати:/ }).first().click();
      await expect(page.getByRole('button', { name: 'Скасувати' })).toBeVisible();
      await page.getByRole('button', { name: 'Скасувати' }).click();
      await page.reload();
      await expect(page.getByText('Підготувати структуру першого епізоду — демо')).toBeVisible();
    });

    test('Google Calendar, Oracle path, Goal Focus and Pomodoro are reachable', async ({ page }) => {
      test.skip(!runIntegration, 'Set FULL_DEMO_RUN=1 to execute the authenticated production smoke flow.');
      await page.goto(`${baseUrl}/?screen=calendar-day`);
      await expect(page.getByRole('button', { name: 'День' })).toBeVisible();
      await page.getByRole('button', { name: 'Тиждень' }).click();
      await expect(page.getByRole('button', { name: 'Тиждень' })).toHaveAttribute('aria-pressed', 'true');
      await page.goto(`${baseUrl}/?screen=oracle-balanced`);
      await expect(page.getByRole('button', { name: 'Фільтри' })).toBeVisible();
      await page.getByRole('button', { name: 'Списком' }).click();
      await expect(page.getByRole('list', { name: 'Список вузлів Oracle' })).toBeVisible();
      await page.goto(`${baseUrl}/?screen=goal-focus-confirm`);
      await expect(page.getByRole('button', { name: 'Увімкнути Goal Focus' })).toBeVisible();
      await page.goto(`${baseUrl}/?screen=pomodoro-setup`);
      await expect(page.getByRole('button', { name: 'Почати фокус' })).toBeVisible();
    });
  });

  test.describe('Telegram integration', () => {
    test.skip(!hasAuthFixture || !runTelegram, 'Prerequisites missing: authenticated fixture, FULL_DEMO_RUN=1 and FULL_DEMO_TELEGRAM=1 with a configured Telegram test chat.');
    test('capture and reminder smoke is enabled only with a real test chat', async ({ page }) => {
      await installFixture(page);
      await addGatewayToken(page);
      await page.goto(`${baseUrl}/?screen=settings-telegram`);
      await expect(page.getByText(/Telegram підключено|Telegram ще не підключено/)).toBeVisible();
      await expect(page.getByText(/ранковий план|нагадування/i)).toBeVisible();
    });
  });

  test.describe('Stripe integration', () => {
    test.skip(!hasAuthFixture || !runStripe, 'Prerequisites missing: authenticated fixture, FULL_DEMO_RUN=1 and FULL_DEMO_STRIPE=1 with a Stripe Test Mode checkout.');
    test('Lifetime Pro smoke is enabled only with Stripe Test Mode', async ({ page }) => {
      await installFixture(page);
      await addGatewayToken(page);
      await page.goto(`${baseUrl}/?screen=paywall-lifetime`);
      await expect(page.getByText('$100')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Отримати Lifetime Pro' })).toBeVisible();
    });
  });
});
