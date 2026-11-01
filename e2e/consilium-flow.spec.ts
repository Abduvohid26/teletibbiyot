import { test, expect, type Browser, type Page } from '@playwright/test';
import { ApiTestClient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import { clickLobbyJoin } from './helpers/video-live-room';
import {
  PASSWORD,
  patchIceConfigFetch,
  prepareVideoConsultation,
  seedDoctorMediaPrefs,
  seedUtSession,
} from './helpers/video-setup';

/**
 * Konsilium — shifokor tomonidan to'liq oqim (faqat UI orqali):
 *   mas'ul shifokor 2 ta shifokorni BIR YO'LA taklif qiladi →
 *   ularga "Sizni konsiliumga chaqirishdi · Ulanish" chiqadi →
 *   ulanadi, xonaga kiradi (belgi yashil bo'ladi) → fikr yozadi →
 *   mas'ul fikrlarni ko'radi, bittasini chiqaradi → yakunlaydi.
 *
 * Seed'da doctor2@ va doctor3@ bo'lishi kerak (`npm run db:seed`).
 */
const DOCTOR2 = 'doctor2@ishifo.uz';
const DOCTOR3 = 'doctor3@ishifo.uz';
const SHOTS = process.env.E2E_SHOTS_DIR;

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Konsiliumga chaqiruv endi kiruvchi qo'ng'iroq oynasi bo'lib jiringlaydi */
const inviteCall = (page: Page) => page.getByRole('alertdialog');

test.describe('Konsilium oqimi (shifokor UI)', () => {
  test.setTimeout(240_000);

  test('taklif → ulanish → fikr → chiqarish → yakunlash', async ({ browser }) => {
    const { consultation, mt } = await prepareVideoConsultation();
    const d2 = new ApiTestClient();
    const d3 = new ApiTestClient();
    await d2.login(DOCTOR2, PASSWORD);
    await d3.login(DOCTOR3, PASSWORD);
    // Oldingi sinovlardan qolgan o'z bemorlari bo'lsa — ular ham "band" bo'lmasin
    await d2.completeActiveConsultationIfAny().catch(() => undefined);
    await d3.completeActiveConsultationIfAny().catch(() => undefined);
    await mt.startConsultation(consultation.id);

    const ut = await newPage(browser);
    const lead = await newPage(browser);
    const c2 = await newPage(browser);
    const c3 = await newPage(browser);
    await seedUtSession(ut.page, consultation.id);
    for (const p of [lead.page, c2.page, c3.page]) await seedDoctorMediaPrefs(p);
    await patchIceConfigFetch(ut.page, lead.page, c2.page, c3.page);

    try {
      await loginAs(ut.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await loginAs(lead.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await loginAs(c2.page, DOCTOR2, PASSWORD, /\/dashboard/);
      await loginAs(c3.page, DOCTOR3, PASSWORD, /\/dashboard/);

      // Maslahatchilar boshqa sahifada (o'z ishida) turibdi
      await c2.page.goto('/dashboard/patients');
      await c3.page.goto('/dashboard/settings');
      await lead.page.goto(`/dashboard`);

      // 1) Mas'ul shifokor ikkalasini bir yo'la taklif qiladi
      await lead.page.getByRole('button', { name: 'Shifokor taklif qilish' }).click();
      await lead.page.getByRole('option', { name: /Dr\. Dilnoza Rahimova|Konsilium Ikkinchi/ }).click();
      await lead.page.getByRole('option', { name: /Sardor Toshmatov/ }).click();
      await shot(lead.page, '01-lead-picker');
      await lead.page.getByRole('button', { name: 'Taklif qilish (2)' }).click();
      await expect(lead.page.getByText('2 ta shifokor konsiliumga taklif qilindi')).toBeVisible();
      await expect(lead.page.getByText('taklif qilindi', { exact: false }).first()).toBeVisible();

      // 2) Ikkalasiga ham real vaqtda taklif keladi — qaysi sahifada bo'lishidan qat'i nazar
      await expect(inviteCall(c2.page)).toContainText('sizni konsiliumga chaqirmoqda', { timeout: 15_000 });
      await expect(inviteCall(c3.page)).toContainText('sizni konsiliumga chaqirmoqda', { timeout: 15_000 });
      await shot(c3.page, '02-consultant-invite-toast');

      // 3) "Qabul qilish" → bemor ish joyi ochiladi, video lobby'siz o'zi ulanadi
      for (const c of [c2.page, c3.page]) {
        await inviteCall(c).getByRole('button', { name: 'Qabul qilish' }).click();
        await c.waitForURL(/\/dashboard$/);
        await expect(c.getByText('Fikr yozish')).toBeVisible({ timeout: 20_000 });
        await expect(c.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      }
      await clickLobbyJoin(lead.page, "mas'ul");
      await ut.page.goto('/ut/vitals');
      await clickLobbyJoin(ut.page, 'UT');

      // Mas'ul tomonda "taklif qilindi" yo'qoladi — ikkalasi ham xonada
      await expect(lead.page.locator('[title="Video xonaga ulangan"]')).toHaveCount(2, { timeout: 30_000 });
      await shot(lead.page, '03-lead-both-joined');

      // 4) Doctor2 fikr yozadi
      await c2.page.getByRole('button', { name: 'Fikr yozish' }).click();
      await c2.page.locator('#consilium-opinion').fill('Kardiolog fikri: EKG va troponin tekshiruvi kerak.');
      await c2.page.getByRole('button', { name: 'Saqlash' }).click();
      await expect(c2.page.getByText('Fikringiz saqlandi')).toBeVisible();

      // Mas'ul darhol ko'radi
      await expect(lead.page.getByRole('button', { name: 'Fikrlar 1/2' })).toBeVisible({ timeout: 15_000 });
      await lead.page.getByRole('button', { name: 'Fikrlar 1/2' }).click();
      // Mas'ulga fikr toast bo'lib ham keladi — oynaning o'zini tekshiramiz
      const opinions = lead.page.getByRole('dialog', { name: 'Konsilium fikrlari' });
      await expect(opinions.getByText('EKG va troponin tekshiruvi kerak')).toBeVisible();
      await expect(opinions.getByText('Hali fikr yozmagan')).toBeVisible();
      await shot(lead.page, '04-lead-opinions');
      await lead.page.keyboard.press('Escape');

      // 5) Mas'ul doctor3 ni chiqaradi → doctor3 xabar oladi va ekrani yopiladi
      const d3Chip = lead.page.locator('span', { hasText: 'Sardor Toshmatov' }).filter({ has: lead.page.getByRole('button') }).last();
      await d3Chip.getByRole('button', { name: 'Konsiliumdan chiqarish' }).click();
      await expect(c3.page.getByText('Siz konsiliumdan chiqarildingiz').first()).toBeVisible({ timeout: 15_000 });
      await c3.page.waitForURL(/\/dashboard\/patients/, { timeout: 15_000 });
      await shot(c3.page, '05-removed');

      // 6) Mas'ul yakunlaydi → doctor2 xabar oladi; PDF da konsilium fikri bor
      await mt.post(`/consultations/${consultation.id}/complete`, {
        diagnosis: 'Stenokardiya',
        icd10Code: 'I20.9',
        recommendations: 'Kardiolog nazorati',
      });
      await expect(c2.page.getByText('Konsilium yakunlandi').first()).toBeVisible({ timeout: 15_000 });
      await c2.page.waitForURL(/\/dashboard\/patients/, { timeout: 15_000 });
      await shot(c2.page, '06-consultant-after-complete');

      // doctor2 tarixdan konsultatsiyani ko'ra oladi, fikri saqlangan
      const parts = await d2.get<Array<{ doctorId: string; opinion: string | null }>>(
        `/consultations/${consultation.id}/participants`,
      );
      expect(parts.map((p) => p.opinion)).toContain('Kardiolog fikri: EKG va troponin tekshiruvi kerak.');
    } finally {
      for (const p of [ut, lead, c2, c3]) await p.ctx.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });
});
