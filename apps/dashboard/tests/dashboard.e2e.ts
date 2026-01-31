import { test, expect } from '@playwright/test';

test.describe('Dashboard Basic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display app title', async ({ page }) => {
    await expect(page.locator('text=Amicus Dashboard')).toBeVisible();
  });

  test('should display status board', async ({ page }) => {
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=Uptime')).toBeVisible();
    await expect(page.locator('text=Memory')).toBeVisible();
    await expect(page.locator('text=Total Cost')).toBeVisible();
  });

  test('should display thought stream', async ({ page }) => {
    await expect(page.locator('text=Thought Stream')).toBeVisible();
  });

  test('should display control center', async ({ page }) => {
    await expect(page.locator('text=Control Center')).toBeVisible();
  });
});
