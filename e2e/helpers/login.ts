import type { Page } from '@playwright/test';

export const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'password123';

/** Fill login form without ambiguous getByLabel(/parol/) (toggle button also matches). */
export async function fillLoginForm(
  page: Page,
  email: string,
  password = DEFAULT_PASSWORD,
) {
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
}

export async function loginAs(
  page: Page,
  email: string,
  password = DEFAULT_PASSWORD,
  waitUrl: RegExp = /\/(dashboard|ut|admin|audit)/,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto('/login');
    await page.locator('#login-email').waitFor({ state: 'visible' });
    await fillLoginForm(page, email, password);
    await page.getByRole('button', { name: /kirish/i }).click();
    try {
      await page.waitForURL(waitUrl, { timeout: 25000 });
      return;
    } catch {
      const errText = await page
        .locator('[role="alert"], .alert, .text-red-600')
        .first()
        .textContent()
        .catch(() => '');
      lastError = new Error(
        `Login failed for ${email}: still on ${page.url()}${errText ? ` — ${errText}` : ''}`,
      );
      if (attempt < 4) await page.waitForTimeout(2000);
    }
  }

  throw lastError ?? new Error(`Login failed for ${email}`);
}
