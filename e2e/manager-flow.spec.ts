import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

test.describe('Manager flow', () => {
  test('MT manager login redirects to SLA dashboard', async ({ page }) => {
    await loginAs(page, 'manager@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard\/manager/);
    await expect(page.getByRole('heading', { name: /SLA va KPI monitoring/i })).toBeVisible({ timeout: 10000 });
  });

  test('Manager can open incident report page', async ({ page }) => {
    await loginAs(page, 'manager@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard\/manager/);
    await page.goto('/dashboard/incidents');
    await expect(page.getByRole('heading', { name: /incident/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/sarlavha/i)).toBeVisible();
  });
});

test.describe('Incident reporting', () => {
  test('UT operator can submit incident form', async ({ page }) => {
    await loginAs(page, 'operator@ishifo.uz', DEFAULT_PASSWORD, /\/(ut|dashboard)/);
    await page.goto('/dashboard/incidents');
    await page.getByLabel(/sarlavha/i).fill('Test incident');
    await page.getByLabel(/tavsif/i).fill('E2E test — tizim sinovi uchun incident hisoboti');
    await page.getByRole('button', { name: /yuborish/i }).click();
    await expect(page.getByText(/yuborildi|audit/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Error pages', () => {
  test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    await expect(page.getByText('404')).toBeVisible();
  });

  test('Unauthorized page is reachable', async ({ page }) => {
    await page.goto('/unauthorized');
    await expect(page.getByRole('heading', { name: /Ruxsat yo'q/i })).toBeVisible();
  });
});
