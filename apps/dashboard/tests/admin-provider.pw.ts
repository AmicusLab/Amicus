import { test, expect } from '@playwright/test';

test.describe('Admin Provider UI Refactored', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/admin/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { role: 'admin' },
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
              defaultModel: 'openai:gpt-4',
            },
          },
        }),
      });
    });
  });

  test('1. Connected providers displayed in table format', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai',
              enabled: true,
              loaded: true,
              available: true,
              modelCount: 12,
              authMethod: 'both',
            },
            {
              id: 'anthropic',
              enabled: true,
              loaded: true,
              available: true,
              modelCount: 8,
              authMethod: 'both',
            },
            {
              id: 'groq',
              enabled: false,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'api_key',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    await expect(page.getByText('Connected Providers (2)')).toBeVisible();
    await expect(page.getByText('openai')).toBeVisible();
    await expect(page.getByText('anthropic')).toBeVisible();
    await expect(page.getByText('12 models')).toBeVisible();
    await expect(page.getByText('8 models')).toBeVisible();
    
    await expect(page.getByText('groq')).not.toBeVisible();
  });

  test('2. Toggle Add New Provider card', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai',
              enabled: true,
              loaded: true,
              available: true,
              modelCount: 12,
              authMethod: 'both',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    await expect(page.locator('.add-provider-flow h3')).not.toBeVisible();

    await page.getByRole('button', { name: '+ Add New Provider' }).click();
    
    await expect(page.locator('.add-provider-flow h3')).toBeVisible();
    await expect(page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...')).toBeVisible();

    await page.getByRole('button', { name: '취소' }).click();
    
    await expect(page.locator('.add-provider-flow h3')).not.toBeVisible();
  });

  test('3. Search providers with alias (chatgpt -> openai)', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai',
              enabled: true,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'both',
            },
            {
              id: 'anthropic',
              enabled: true,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'both',
            },
            {
              id: 'groq',
              enabled: false,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'api_key',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('button', { name: '+ Add New Provider' }).click();

    const searchInput = page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...');
    
    await searchInput.fill('chatgpt');
    await expect(page.getByText('openai').last()).toBeVisible();
    await expect(page.getByText('anthropic').last()).not.toBeVisible();

    await searchInput.fill('claude');
    await expect(page.getByText('anthropic').last()).toBeVisible();
    await expect(page.getByText('openai').last()).not.toBeVisible();

    await searchInput.fill('groq');
    await expect(page.getByText('groq').last()).toBeVisible();
    
    await searchInput.fill('nonexistent');
    await expect(page.getByText('No providers found for "nonexistent"')).toBeVisible();
  });

  test('4. Add provider with API Key (single method)', async ({ page }) => {
    let apiKeySet = false;

    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'groq',
              enabled: true,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'api_key',
            },
          ],
        }),
      });
    });

    await page.route('**/admin/providers/groq/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { valid: true },
        }),
      });
    });

    await page.route('**/admin/providers/groq/apikey', async (route) => {
      apiKeySet = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'groq', updated: true },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('button', { name: '+ Add New Provider' }).click();

    await page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...').fill('groq');
    await page.getByText('groq').last().click();

    await expect(page.getByText('Selected: groq')).toBeVisible();
    await expect(page.getByText('Connect')).toBeVisible();
    await expect(page.getByPlaceholder('Enter API key')).toBeVisible();

    await page.getByPlaceholder('Enter API key').fill('gsk-test123');
    await page.getByRole('button', { name: 'Validate & Save' }).click();

    await page.waitForTimeout(1000);
    expect(apiKeySet).toBe(true);
  });

  test('5. Add provider with method selection (both)', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai',
              enabled: true,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'both',
              oauthMethods: [
                {
                  id: 'chatgpt-browser',
                  label: 'ChatGPT Pro/Plus (Browser)',
                  flow: 'pkce',
                },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/admin/providers/openai/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'openai', updated: true },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('button', { name: '+ Add New Provider' }).click();

    await page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...').fill('openai');
    await page.getByText('openai').last().click();

    await expect(page.getByText('Select Connection Method')).toBeVisible();
    await expect(page.getByRole('button', { name: 'API Key' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'OAuth' })).toBeVisible();

    await page.getByRole('button', { name: 'API Key' }).click();

    await expect(page.getByText('Connect')).toBeVisible();
    await expect(page.getByPlaceholder('Enter API key')).toBeVisible();

    await page.getByPlaceholder('Enter API key').fill('sk-test123');
    await page.getByRole('button', { name: 'Validate & Save' }).click();

    await page.waitForTimeout(500);
  });

  test('6. Back button navigation in flow', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'openai',
              enabled: true,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'both',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('button', { name: '+ Add New Provider' }).click();

    await page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...').fill('openai');
    await page.getByText('openai').last().click();

    await expect(page.getByText('Select Connection Method')).toBeVisible();
    
    await page.getByRole('button', { name: 'API Key' }).click();
    await expect(page.getByPlaceholder('Enter API key')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Select Connection Method')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...')).toBeVisible();
  });

  test('7. Toast notification auto-dismiss after 5 seconds', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'groq',
              enabled: true,
              loaded: false,
              available: false,
              modelCount: 0,
              authMethod: 'api_key',
            },
          ],
        }),
      });
    });

    await page.route('**/admin/providers/groq/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'groq', updated: true },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('button', { name: '+ Add New Provider' }).click();

    await page.getByPlaceholder('Search providers (e.g., chatgpt, claude, code)...').fill('groq');
    await page.getByText('groq').last().click();
    await page.getByPlaceholder('Enter API key').fill('gsk-test');
    await page.getByRole('button', { name: 'Validate & Save' }).click();

    const toast = page.locator('.toast').first();
    await expect(toast).toBeVisible({ timeout: 2000 });

    await page.waitForTimeout(5500);
    await expect(toast).not.toBeVisible();
  });
});
