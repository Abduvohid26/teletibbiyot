import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

test.describe('Role-based access', () => {
  test('MT doctor login redirects to dashboard', async ({ page }) => {
    await loginAs(page, 'doctor@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard/);
  });

  test('Admin login redirects to admin panel', async ({ page }) => {
    await loginAs(page, 'admin@ishifo.uz', DEFAULT_PASSWORD, /\/admin/);
    await expect(page.getByRole('heading', { name: /Admin Panel/i })).toBeVisible({ timeout: 10000 });
  });

  test('Admin cannot access doctor dashboard', async ({ page }) => {
    await loginAs(page, 'admin@ishifo.uz', DEFAULT_PASSWORD, /\/admin/);
    await page.goto('/dashboard');
    await page.waitForURL(/\/(admin|unauthorized|login)/, { timeout: 10000 });
    expect(page.url()).not.toMatch(/\/dashboard$/);
  });

  test('UT operator login redirects to UT workspace', async ({ page }) => {
    await loginAs(page, 'operator@ishifo.uz', DEFAULT_PASSWORD, /\/ut/);
  });
});

test.describe('API health', () => {
  test('health live endpoint responds', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/health/live`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.live).toBe(true);
  });

  test('metrics endpoint returns prometheus format', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = process.env.METRICS_BEARER_TOKEN;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const res = await request.get(`${apiBase}/api/metrics`, { headers });
    if (!token && res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('ishifo_up');
  });
});
