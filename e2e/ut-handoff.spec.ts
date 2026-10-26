import { test, expect } from '@playwright/test';
import { ApiTestClient, buildTestConsultation, buildTestPatient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import { PASSWORD, seedUtSession } from './helpers/video-setup';

/**
 * UT → shifokorga topshirish.
 *
 * Regressiya: operatorda boshqa faol (navbatdagi) bemor bo'lsa, yangi bemorni
 * yuborgach "Jonli efir" ESKI bemorning xonasini ochardi — realtime
 * `consultation-queued` yuklashi yangi tanlovni eski ID bilan bosib ketardi.
 */
const CONSULTANT_EMAIL = process.env.E2E_CONSULTANT_EMAIL || 'doctor2@ishifo.uz';

test.describe('UT topshirish', () => {
  test.slow();

  test('H1) Yangi bemor yuborilgach Jonli efir AYNAN o\'sha bemorni ochadi', async ({ page }) => {
    const ut = new ApiTestClient();
    const lead = new ApiTestClient();
    const other = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const leadLogin = await lead.login('doctor@ishifo.uz', PASSWORD);
    const otherLogin = await other.login(CONSULTANT_EMAIL, PASSWORD);

    // Operatorda allaqachon boshqa shifokorga yuborilgan, tanlangan bemor bor
    const oldPatient = await ut.createPatient(buildTestPatient());
    const oldConsultation = await ut.createConsultation(
      buildTestConsultation(oldPatient.id, otherLogin.user!.id),
    );
    await seedUtSession(page, oldConsultation.id);

    const newName = `Topshirish Sinov ${Date.now()}`;
    const leadName = 'Dr. Akmal Karimov';

    try {
      await loginAs(page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await page.goto('/ut');

      await page.getByPlaceholder(/Aliyev Vali/).fill(newName);
      await page.locator('input[type="date"]').first().fill('1975-06-20');
      await page.getByPlaceholder(/far → Farg/).click();
      await page.getByPlaceholder(/far → Farg/).fill('far');
      await page.getByRole('option', { name: "Farg'ona viloyati" }).click();
      await page.getByPlaceholder(/viloyat tanlang|tuman/i).click();
      await page.getByRole('option', { name: 'Rishton tumani' }).click();
      await page.getByPlaceholder('+998 90 123 45 67').fill('901234567');
      await page.getByPlaceholder(/shikoyatlarini/).fill("Ko'krak qafasida og'riq");
      await page.getByPlaceholder('70', { exact: true }).fill('82');
      await page.getByPlaceholder('170', { exact: true }).fill('176');

      // Holat paneli: shifokor tanlanmagan
      await expect(page.getByText(/qaysi shifokorga yuborishni tanlang/i)).toBeVisible();

      const doctorSelect = page
        .locator('select')
        .filter({ has: page.locator('option', { hasText: /^Shifokor tanlang$/ }) });
      await doctorSelect.selectOption(leadLogin.user!.id);

      await page.getByRole('button', { name: /Shifokorga yuborish/ }).click();
      await page.waitForURL(/\/ut\/vitals/, { timeout: 20_000 });

      // Lobby yangi bemorning shifokorini ko'rsatishi va shu holatda qolishi kerak
      // (kechikkan realtime yuklash uni keyinroq almashtirib qo'ymasin)
      await page.waitForTimeout(4000);
      await expect(page.getByText(new RegExp(`Shifokor:\\s*${leadName}`))).toBeVisible();
      const active = await page.evaluate(() => sessionStorage.getItem('ishifo_ut_active_consultation'));
      expect(active, 'faol konsultatsiya eski bemorga qaytib ketdi').not.toBe(oldConsultation.id);
    } finally {
      await other.cancelConsultation(oldConsultation.id, 'E2E tozalash').catch(() => undefined);
      const queue = await lead.getQueue().catch(() => []);
      for (const c of queue) {
        if (c.patient?.fullName === newName) {
          await lead.cancelConsultation(c.id, 'E2E tozalash').catch(() => undefined);
        }
      }
    }
  });
});
