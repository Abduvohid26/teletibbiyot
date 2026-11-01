import { test, expect } from '@playwright/test';
import { join } from 'path';
import { ApiTestClient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import { clickLobbyJoin } from './helpers/video-live-room';
import { PASSWORD, patchIceConfigFetch, prepareVideoConsultation, seedDoctorMediaPrefs, seedUtSession } from './helpers/video-setup';

/**
 * Meet paytida UT hujjat yuklaydi → mas'ul va konsilium shifokori sahifani
 * yangilamasdan ko'radi; bir paytdagi fayllar uchun bitta toast; yangi fayl
 * "Yangi" belgisi bilan; bosilganda preview ochiladi.
 */
const FILES = [join(__dirname, 'fixtures/rentgen.png'), join(__dirname, 'fixtures/qon-tahlili.pdf')];

test('Meet paytida UT hujjatlari shifokorlarga real vaqtda', async ({ browser }) => {
  test.setTimeout(240_000);
  const { consultation, mt } = await prepareVideoConsultation();
  const d2 = new ApiTestClient();
  const d2id = (await d2.login('doctor2@ishifo.uz', PASSWORD)).user!.id;
  await d2.completeActiveConsultationIfAny().catch(() => undefined);
  await mt.startConsultation(consultation.id);
  await mt.post(`/consultations/${consultation.id}/participants`, { doctorIds: [d2id] });

  const mk = async () => (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
  const ut = await mk();
  const lead = await mk();
  const c2 = await mk();
  await seedUtSession(ut, consultation.id);
  await seedDoctorMediaPrefs(lead);
  await seedDoctorMediaPrefs(c2);
  await patchIceConfigFetch(ut, lead, c2);
  try {
    await loginAs(ut, 'operator@ishifo.uz', PASSWORD, /\/ut/);
    await loginAs(lead, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
    await loginAs(c2, 'doctor2@ishifo.uz', PASSWORD, /\/dashboard/);
    await lead.goto('/dashboard');
    await clickLobbyJoin(lead, "mas'ul");
    await c2.goto('/dashboard/patients');
    await c2.getByRole('alertdialog').getByRole('button', { name: 'Qabul qilish' }).click({ timeout: 20_000 });
    await ut.goto('/ut/vitals');
    const ring = ut.getByRole('alertdialog');
    if (await ring.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
      await ring.getByRole('button', { name: 'Ulanish' }).click();
    } else {
      await clickLobbyJoin(ut, 'UT');
    }

    await ut.getByRole('button', { name: 'Hujjatlar' }).click();
    await ut.locator('input[type=file]').first().setInputFiles(FILES);

    // Bitta umumiy toast (har fayl uchun alohida emas)
    await expect(lead.getByText('2 ta yangi hujjat yuklandi')).toBeVisible({ timeout: 20_000 });
    for (const p of [lead, c2]) {
      await expect(p.getByText('rentgen.png').first()).toBeVisible({ timeout: 20_000 });
      await expect(p.getByText('qon-tahlili.pdf').first()).toBeVisible({ timeout: 20_000 });
    }
    // "AI tahlil qildi" toastlari yo'q (ro'yxatdagi belgi yetarli)
    await lead.waitForTimeout(8000);
    await expect(lead.getByText('AI hujjatni tahlil qildi')).toHaveCount(0);
    // "Yangi" belgisi — ochilgach yo'qoladi
    await expect(lead.getByText('Yangi', { exact: true })).toHaveCount(2);
    await lead.getByText('rentgen.png').first().click();
    await expect(lead.getByRole('img', { name: /rentgen/i }).first()).toBeVisible({ timeout: 10_000 });
    await lead.keyboard.press('Escape');
    await expect(lead.getByText('Yangi', { exact: true })).toHaveCount(1);
  } finally {
    await mt.completeActiveConsultationIfAny().catch(() => undefined);
  }
});
