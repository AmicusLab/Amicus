import { test, expect } from '@playwright/test';

test.describe('Admin', () => {
  test('tab opens login form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();

    await expect(page.locator('admin-panel')).toBeVisible();
    await expect(page.getByPlaceholder('pairing code')).toBeVisible();
  });

  test('providers list renders and can toggle a provider (mocked)', async ({ page }) => {
    let openaiEnabled = true;

    await page.route('**/admin/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { role: 'admin' } }),
      });
    });

    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai',
              enabled: openaiEnabled,
              loaded: true,
              available: true,
              modelCount: 2,
            },
          ],
        }),
      });
    });

    await page.route('**/admin/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            llm: {
              defaultModel: 'openai:gpt-3.5-turbo',
              dailyBudget: 1000000,
              budgetAlertThreshold: 800000,
            },
          },
        }),
      });
    });

    await page.route('**/admin/providers/openai', async (route, request) => {
      if (request.method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      const json = request.postDataJSON() as { enabled?: unknown } | null;
      openaiEnabled = Boolean(json?.enabled);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'openai', enabled: openaiEnabled },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();

    await expect(page.locator('admin-panel')).toBeVisible();
    await expect(page.locator('text=openai')).toBeVisible();

    await page.getByRole('button', { name: 'Disable' }).click();
    await expect(page.locator('text=Provider openai disabled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();
  });
});
