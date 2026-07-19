import { test, expect } from '@playwright/test';

/*
 * This suite is intentionally fixture-gated. It must never turn a local mock,
 * a demo catalogue, or an unauthenticated redirect into a production pass.
 * See docs/qa/security-failure-accessibility-audit.md.
 */
const auditUrl = process.env.AUDIT_BASE_URL;
const authState = process.env.AUDIT_AUTH_STATE;
const failureFixture = process.env.AUDIT_FAILURE_FIXTURE === '1';
const isNonLocal = Boolean(auditUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(auditUrl);
const sizes = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe('Vector security, failure and accessibility audit', () => {
  test.skip(!isNonLocal || !authState,
    'Prerequisites missing: set AUDIT_BASE_URL to a deployed URL and AUDIT_AUTH_STATE to a dedicated authenticated fixture.');

  for (const size of sizes) {
    test(`mobile ${size.width}x${size.height} has no clipping or missing navigation names`, async ({ page }) => {
      await page.addInitScript((raw) => window.localStorage.setItem('pocketbase_auth', raw), authState);
      await page.setViewportSize(size);
      await page.goto(auditUrl);
      await expect(page.getByTestId('mobile-prototype')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Головна навігація' })).toBeVisible();
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      for (const label of ['Сьогодні', 'Inbox', 'Brain Dump', 'Календар', 'Oracle']) {
        await expect(page.getByRole('button', { name: label })).toHaveAccessibleName(label);
      }
    });
  }

  test('supports reduced motion, keyboard focus and Oracle list alternative', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((raw) => window.localStorage.setItem('pocketbase_auth', raw), authState);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${auditUrl}/?screen=oracle-balanced`);
    await expect(page.getByRole('button', { name: 'Списком' })).toBeVisible();
    await page.getByRole('button', { name: 'Списком' }).click();
    await expect(page.getByRole('heading', { name: 'Вузли карти' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Список вузлів Oracle' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    const motion = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(motion).toBe('auto');
  });

  test('keeps critical failure fixtures retryable instead of silently succeeding', async ({ page }) => {
    test.skip(!failureFixture, 'Set AUDIT_FAILURE_FIXTURE=1 only with the dedicated offline/provider failure fixture.');
    await page.addInitScript((raw) => window.localStorage.setItem('pocketbase_auth', raw), authState);
    await page.route('**/api/v1/**', (route) => route.abort('failed'));
    await page.goto(`${auditUrl}/?screen=oracle-balanced`);
    await expect(page.getByText(/Спроб|помил|недоступ/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
