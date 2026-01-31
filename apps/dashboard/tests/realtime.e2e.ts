import { test, expect } from '@playwright/test';

test.describe('Dashboard Real-time Updates', () => {
  test('should show connected status', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connected')).toBeVisible();
  });
});
