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
 * Xonaga qo'ng'iroq (bir-birini chaqirish):
 *   P1) UT xonada kutyapti → "Shifokorga qo'ng'iroq qilish" → shifokorda jiringlaydi → Qabul → video
 *   P2) Shifokor UT ni chaqiradi → UT "Hozir emas" → shifokorga "Hozir ulana olmaydi"
 *   P3) Konsilium a'zosi chiqib ketgan → mas'ul uning yonidagi 📞 → u qaytib kiradi
 */
const callDialog = (p: Page) => p.getByRole('alertdialog');
const leaveBtn = (p: Page) => p.getByRole('button', { name: /^Uzish$/ }).first();

async function open(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  return { ctx, page };
}

test.describe("Xonaga qo'ng'iroq", () => {
  test.setTimeout(300_000);

  test('P1–P3', async ({ browser }) => {
    const { consultation, mt } = await prepareVideoConsultation();
    const d2 = new ApiTestClient();
    const d2id = (await d2.login('doctor2@ishifo.uz', PASSWORD)).user!.id;
    await d2.completeActiveConsultationIfAny().catch(() => undefined);
    await mt.startConsultation(consultation.id);

    const ut = await open(browser);
    const lead = await open(browser);
    const c2 = await open(browser);
    await seedUtSession(ut.page, consultation.id);
    await seedDoctorMediaPrefs(lead.page);
    await seedDoctorMediaPrefs(c2.page);
    await patchIceConfigFetch(ut.page, lead.page, c2.page);
    try {
      await loginAs(ut.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await loginAs(lead.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await loginAs(c2.page, 'doctor2@ishifo.uz', PASSWORD, /\/dashboard/);
      await lead.page.goto('/dashboard/patients');

      // P1: UT xonaga kiradi, shifokor yo'q — UT uni chaqiradi
      await ut.page.goto('/ut/vitals');
      const dlg = callDialog(ut.page);
      if (await dlg.isVisible({ timeout: 4000 }).catch(() => false)) {
        // "Shifokor sizni kutmoqda" (qabul boshlangani) — bu sinovda kerak emas
        await dlg.getByRole('button', { name: 'Keyinroq' }).click();
      }
      await clickLobbyJoin(ut.page, 'UT');
      const callDoctor = ut.page.getByRole('button', { name: "Shifokorga qo'ng'iroq qilish" });
      await expect(callDoctor).toBeVisible({ timeout: 30_000 });
      await callDoctor.click();
      await expect(ut.page.getByRole('button', { name: 'Chaqirilmoqda…' })).toBeVisible();

      await expect(callDialog(lead.page)).toContainText('sizni video xonaga chaqirmoqda', { timeout: 15_000 });
      await callDialog(lead.page).getByRole('button', { name: 'Qabul qilish' }).click();
      await lead.page.waitForURL(/\/dashboard$/);
      await expect(leaveBtn(lead.page)).toBeVisible({ timeout: 30_000 });
      // Shifokor kirdi — UT da tugma yo'qoladi
      await expect(ut.page.getByRole('button', { name: /Shifokorga qo'ng'iroq qilish|Chaqirilmoqda/ })).toHaveCount(0, { timeout: 30_000 });

      // P2: UT chiqadi → shifokor UT ni chaqiradi → UT "Hozir emas"
      await leaveBtn(ut.page).click();
      await ut.page.goto('/ut/patients');
      const callUt = lead.page.getByRole('button', { name: "UT operatorga qo'ng'iroq qilish" });
      // Shifokor yolg'iz qoldi — "Tugatasizmi?" oynasida "Qayta chaqirish"
      const alone = lead.page.getByRole('alertdialog', { name: 'Xonada faqat siz qoldingiz' });
      await expect(alone).toBeVisible({ timeout: 30_000 });
      await alone.getByRole('button', { name: 'Qayta chaqirish' }).click();
      await expect(lead.page.getByRole('button', { name: 'Chaqirilmoqda…' })).toBeVisible();
      await expect(callDialog(ut.page)).toContainText('sizni video xonaga chaqirmoqda', { timeout: 15_000 });
      await callDialog(ut.page).getByRole('button', { name: 'Hozir emas' }).click();
      await expect(lead.page.getByText('Hozir ulana olmaydi').first()).toBeVisible({ timeout: 15_000 });
      await expect(callUt).toBeVisible({ timeout: 10_000 });

      // P3: konsilium shifokori kiradi va chiqadi → mas'ul uni 📞 bilan chaqiradi
      await c2.page.goto('/dashboard/patients');
      await mt.post(`/consultations/${consultation.id}/participants`, { doctorIds: [d2id] });
      await callDialog(c2.page).getByRole('button', { name: 'Qabul qilish' }).click({ timeout: 20_000 });
      await expect(leaveBtn(c2.page)).toBeVisible({ timeout: 30_000 });
      await leaveBtn(c2.page).click();
      await c2.page.goto('/dashboard/patients');
      const chipRing = lead.page.getByRole('button', { name: 'Xonaga chaqirish' });
      await expect(chipRing).toBeVisible({ timeout: 20_000 });
      await chipRing.click();
      await expect(callDialog(c2.page)).toContainText('sizni video xonaga chaqirmoqda', { timeout: 15_000 });
      await callDialog(c2.page).getByRole('button', { name: 'Qabul qilish' }).click();
      await expect(leaveBtn(c2.page)).toBeVisible({ timeout: 30_000 });
      await expect(lead.page.getByRole('button', { name: 'Xonaga chaqirish' })).toHaveCount(0, { timeout: 20_000 });
    } finally {
      for (const p of [ut, lead, c2]) await p.ctx.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });
});
