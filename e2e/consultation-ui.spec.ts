import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

function utField(page: Page, label: RegExp) {
  return page.getByLabel(label);
}

test.describe('UT intake UI form', () => {
  test('operator completes patient form and submits', async ({ page }) => {
    test.setTimeout(120000);

    await loginAs(page, 'operator@ishifo.uz', DEFAULT_PASSWORD, /\/ut/);

    await expect(page.getByRole('heading', { name: /Yangi klinik holat/i })).toBeVisible();

    await utField(page, /^F\.I\.Sh\./).fill('E2E Test Bemor');
    await utField(page, /Tug'ilgan sana/).fill('1992-03-20');
    await utField(page, /^Viloyat/).fill('O\'zbekiston');
    await utField(page, /Tuman/).fill('E2E tuman');
    await utField(page, /^Telefon/).fill('+998901112233');

    await utField(page, /Asosiy shikoyatlar/).fill('Yo\'tal va harorat');
    await utField(page, /Kasallik tarixi/).fill('3 kundan beri');
    await utField(page, /Hayot anamnezi/).fill('Surunkali kasallik yo\'q');

    await page.locator('input[type="checkbox"]').last().check();
    await page.getByRole('button', { name: /Tahlilni boshlash/i }).click();

    await expect(page.getByText(/muvaffaqiyat|yuborildi|navbat/i).first()).toBeVisible({ timeout: 30000 });
  });
});
test.describe('MT doctor UI queue', () => {
  test('doctor sees consultations page and queue tab', async ({ page }) => {
    await loginAs(page, 'doctor@ishifo.uz');
    await page.goto('/dashboard/consultations');
    await expect(page.getByRole('heading', { name: /Konsultatsiyalar/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Faol navbat/i })).toBeVisible();
  });
});
