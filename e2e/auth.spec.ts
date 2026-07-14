import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/login';

test.describe('iShifo login', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Shifo').first()).toBeVisible();
  });

  test('UT operator can open intake page after login', async ({ page }) => {
    await loginAs(page, 'operator@ishifo.uz', undefined, /\/(ut|dashboard)/);
  });
});
