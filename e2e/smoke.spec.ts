import { expect, test } from '@playwright/test';

// Minimal smoke: the Retrace SPA should load and render the case list screen.
// Intentionally avoids WS/LLM flows so this can run without llama-server.
test('case list renders on initial load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '事件ファイル' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新規依頼' })).toBeVisible();
});
