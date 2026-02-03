import { test, expect } from '@playwright/test';

test.describe('Admin Provider UI', () => {
  test('1. 연결된 provider 목록 표시', async ({ page }) => {
    let providers = [
      {
        id: 'openai',
        enabled: true,
        loaded: true,
        available: true,
        modelCount: 2,
      },
      {
        id: 'anthropic',
        enabled: false,
        loaded: true,
        available: true,
        modelCount: 5,
      },
    ];

    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: providers,
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    await expect(page.locator('text=openai')).toBeVisible();
    await expect(page.locator('text=anthropic')).toBeVisible();
    await expect(page.getByText('2 models')).toBeVisible();
    await expect(page.getByText('5 models')).toBeVisible();
  });

  test('2. 새 provider 추가 - API Key만 (Step 2 스킵)', async ({ page }) => {
    let providers = [
      {
        id: 'openai',
        enabled: true,
        loaded: true,
        available: true,
        modelCount: 2,
      },
    ];

    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: providers,
        }),
      });
    });

    await page.route('**/admin/providers/openai/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'openai', apiKey: 'sk-test123' },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    // Provider 목록에서 OpenAI 클릭
    await page.getByRole('button', { name: 'openai' }).click();

    // Step 1: API Key 입력
    await page.getByPlaceholder('sk-').fill('sk-test123');

    // Step 2 스킵 (다음 버튼을 이미 눌렀다고 가정하거나 생략)
    // Step 3: "추가하기" 버튼 클릭
    await page.getByRole('button', { name: '추가하기' }).click();

    // 성공 메시지 확인
    await expect(page.getByText('Provider added successfully')).toBeVisible();
  });

  test('3. 새 provider 추가 - 여러 방법 (Step 2 표시)', async ({ page }) => {
    let providers = [
      {
        id: 'openai',
        enabled: true,
        loaded: true,
        available: true,
        modelCount: 2,
      },
    ];

    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: providers,
        }),
      });
    });

    await page.route('**/admin/providers/openai/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'openai', apiKey: 'sk-test456' },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    // Provider 목록에서 OpenAI 클릭
    await page.getByRole('button', { name: 'openai' }).click();

    // Step 1: API Key 입력
    await page.getByPlaceholder('sk-').fill('sk-test456');

    // Step 2 표시 확인
    await expect(page.locator('text=Advanced Configuration')).toBeVisible();
    await expect(page.getByPlaceholder('Base URL')).toBeVisible();

    // 모델 추가 버튼 클릭
    await page.getByRole('button', { name: '모델 추가' }).click();

    // Step 3: "추가하기" 버튼 클릭
    await page.getByRole('button', { name: '추가하기' }).click();

    // 성공 메시지 확인
    await expect(page.getByText('Provider added successfully')).toBeVisible();
  });

  test('4. "이전" 버튼으로 단계 되돌리기', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    // 새 Provider 추가 버튼 클릭
    await page.getByRole('button', { name: '새 Provider 추가' }).click();

    // Step 2로 이동 (예: 모델 추가 버튼 클릭)
    await page.getByRole('button', { name: '모델 추가' }).click();

    // "이전" 버튼 클릭
    await page.getByRole('button', { name: '이전' }).click();

    // Step 1로 돌아와야 함
    await expect(page.locator('text=API Key')).toBeVisible();
  });

  test('5. Toast 알림 5초 후 자동 사라짐', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/admin/providers/openai/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'openai', apiKey: 'sk-test789' },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    // 새 Provider 추가 버튼 클릭
    await page.getByRole('button', { name: '새 Provider 추가' }).click();

    // API Key 입력
    await page.getByPlaceholder('sk-').fill('sk-test789');

    // 모델 추가 버튼 클릭
    await page.getByRole('button', { name: '모델 추가' }).click();

    // "추가하기" 버튼 클릭
    await page.getByRole('button', { name: '추가하기' }).click();

    // Toast 메시지가 표시됨
    const toast = page.getByText('Provider added successfully');
    await expect(toast).toBeVisible();

    // 5초 후 사라져야 함
    await page.waitForTimeout(5500);
    await expect(toast).not.toBeVisible();
  });

  test('6. Toast 여러 개 동시 표시 (층층이 쌓임)', async ({ page }) => {
    await page.route('**/admin/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/admin/providers/openai/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'openai', apiKey: 'sk-test000' },
        }),
      });
    });

    await page.route('**/admin/providers/anthropic/apikey', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'anthropic', apiKey: 'sk-test111' },
        }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.locator('admin-panel')).toBeVisible();

    // 첫 번째 Provider 추가
    await page.getByRole('button', { name: '새 Provider 추가' }).click();
    await page.getByPlaceholder('sk-').fill('sk-test000');
    await page.getByRole('button', { name: '모델 추가' }).click();
    await page.getByRole('button', { name: '추가하기' }).click();
    await expect(page.getByText('Provider added successfully')).toBeVisible();

    // 두 번째 Provider 추가
    await page.getByRole('button', { name: '새 Provider 추가' }).click();
    await page.getByPlaceholder('sk-').fill('sk-test111');
    await page.getByRole('button', { name: '모델 추가' }).click();
    await page.getByRole('button', { name: '추가하기' }).click();
    await expect(page.getByText('Provider added successfully')).toBeVisible();

    // 두 개의 Toast가 동시에 표시되어야 함 (층층이 쌓임)
    await expect(page.locator('text=Provider added successfully')).toHaveCount(2);
  });
});
