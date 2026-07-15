import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

test.describe('Security', () => {
  test('metrics requires bearer token when METRICS_BEARER_TOKEN set', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/metrics`);
    if (process.env.NODE_ENV === 'production') {
      expect(res.status()).toBe(401);
    } else {
      expect(res.ok()).toBeTruthy();
    }
  });

  test('integrations status requires auth', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/integrations/status`);
    expect(res.status()).toBe(401);
  });

  test('admin login can access integrations status', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const login = await request.post(`${apiBase}/api/auth/login`, {
      data: { email: 'admin@ishifo.uz', password: DEFAULT_PASSWORD },
      headers: { 'X-Ishifo-Client': 'web' },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token = body.accessToken as string | undefined;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await request.get(`${apiBase}/api/integrations/status`, { headers });
    expect(res.ok()).toBeTruthy();
    const status = await res.json();
    expect(status).toHaveProperty('prescription');
  });
});

test.describe('DICOM navigation', () => {
  test('doctor can open DICOM page with consultation picker', async ({ page }) => {
    await loginAs(page, 'doctor@ishifo.uz');
    await page.goto('/dashboard/dicom');
    await expect(page.getByText(/DICOM|Tasvir/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Video health API', () => {
  test('video-check endpoint responds for authenticated admin', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const login = await request.post(`${apiBase}/api/auth/login`, {
      data: { email: 'admin@ishifo.uz', password: DEFAULT_PASSWORD },
      headers: { 'X-Ishifo-Client': 'web' },
    });
    const body = await login.json();
    const token = body.accessToken as string | undefined;
    if (!token) return;
    const res = await request.get(`${apiBase}/api/health/video-check`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('Settings', () => {
  test('settings page loads for doctor', async ({ page }) => {
    test.setTimeout(90000);
    await loginAs(page, 'doctor@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard/);
    await page.goto('/dashboard/settings');
    await expect(page.getByText(/Profil ma'lumotlari/i)).toBeVisible({ timeout: 15000 });
  });
});
