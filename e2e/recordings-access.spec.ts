import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

test.describe('Recordings page', () => {
  test('manager can open recordings list', async ({ page }) => {
    test.setTimeout(90000);
    await loginAs(page, 'manager@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard\/manager/);
    await page.goto('/dashboard/recordings');
    await expect(page.getByRole('heading', { name: /Video yozuvlar/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Unauthorized routes', () => {
  test('doctor cannot open admin panel', async ({ page }) => {
    test.setTimeout(90000);
    await loginAs(page, 'doctor@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard/);
    await page.goto('/admin');
    await page.waitForURL(/\/(unauthorized|dashboard)/, { timeout: 15000 });
  });
});
