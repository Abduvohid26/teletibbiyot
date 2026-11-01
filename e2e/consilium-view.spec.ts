import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
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
 * Konsilium ko'rinishi:
 *   V1) Havola orqali qo'shilish — mas'ulda "Ochish" yo'q; qo'ng'iroqchadan bosilsa ham video
 *       qayta ulanmaydi, UT'da mas'ul asosiy oynada qoladi
 *   V2) UT kichik oynani bosadi → kattalashadi → "Mas'ulni kattalashtirish" bilan qaytadi
 *   V3) "… gapirmoqda" — kim gapirayotgani roli bilan
 *   V4) Shifokor: bitta tugma bilan video kattalashadi; konsilium oynasini bosib kattalashtirish
 *   V5) Qo'ng'iroqni qabul qilib kirgan UT'ga 45s dan keyin "O'tkazib yuborilgan" kelmaydi
 */
const CAM_DIR = process.env.E2E_FAKE_CAM_DIR;
const EXE = process.env.E2E_CHROMIUM;
const SHOTS = process.env.E2E_SHOTS_DIR;

async function openAs(browser: Browser, cam: string) {
  let b = browser;
  let own: Browser | null = null;
  if (CAM_DIR) {
    own = await chromium.launch({
      ...(EXE ? { executablePath: EXE } : {}),
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${CAM_DIR}/${cam}.y4m`,
      ],
    });
    b = own;
  }
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 860 },
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  });
  const page = await ctx.newPage();
  return { page, close: async () => { await ctx.close(); await own?.close(); } };
}

const leaveBtn = (p: Page) => p.getByRole('button', { name: /^Uzish$/ }).first();
const utMainLabel = (ut: Page) => ut.locator('span.bg-gold-400').filter({ hasText: /·/ }).first();

test.describe('Konsilium ko\'rinishi', () => {
  test.setTimeout(420_000);

  test('V1–V5', async ({ browser }) => {
    const { consultation, mt } = await prepareVideoConsultation();
    const d3 = new ApiTestClient();
    await d3.login('doctor3@ishifo.uz', PASSWORD);
    await d3.completeActiveConsultationIfAny().catch(() => undefined);
    await mt.startConsultation(consultation.id);
    const leadName = 'Dr. Akmal Karimov';

    const ut = await openAs(browser, 'ut');
    const lead = await openAs(browser, 'lead');
    const c3 = await openAs(browser, 'c3');
    await seedUtSession(ut.page, consultation.id);
    await seedDoctorMediaPrefs(lead.page);
    await seedDoctorMediaPrefs(c3.page);
    await patchIceConfigFetch(ut.page, lead.page, c3.page);
    const shot = async (who: Record<string, Page>, step: string) => {
      if (SHOTS) await Promise.all(Object.entries(who).map(([w, p]) => p.screenshot({ path: `${SHOTS}/${step}-${w}.png` })));
    };

    try {
      await loginAs(ut.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await loginAs(lead.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await loginAs(c3.page, 'doctor3@ishifo.uz', PASSWORD, /\/dashboard/);
      await lead.page.goto('/dashboard');
      await clickLobbyJoin(lead.page, "mas'ul");
      // V5 uchun: UT qo'ng'iroqni emas, lobby'ni bosib kiradi
      await ut.page.goto('/ut/vitals');
      const ring = ut.page.getByRole('alertdialog');
      const joinedAt = Date.now();
      // Qabul allaqachon boshlangan — UT ochilishi bilan "Shifokor sizni kutmoqda" jiringlaydi
      if (await ring.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false)) {
        // "Shifokor sizni kutmoqda" → Ulanish (lobby'siz kiradi)
        await ring.getByRole('button', { name: 'Ulanish' }).click();
        await expect(ring).toHaveCount(0, { timeout: 15_000 });
      } else {
        await clickLobbyJoin(ut.page, 'UT');
      }
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`, { timeout: 45_000 });

      // V1: havola orqali qo'shiladi — mas'ulda toast bor, "Ochish" yo'q
      const { token } = await mt.post<{ token: string }>(`/consultations/${consultation.id}/invite-link`);
      await c3.page.goto(`/dashboard/join/${token}`);
      await expect(leaveBtn(c3.page)).toBeVisible({ timeout: 45_000 });
      await expect(lead.page.getByText("Shifokor havola orqali qo'shildi").first()).toBeVisible({ timeout: 15_000 });
      await expect(lead.page.locator('button:visible', { hasText: /^Ochish$/ })).toHaveCount(0);
      // Qo'ng'iroqchadan shu xabarni bosish ham videoni buzmasligi kerak
      await lead.page.getByRole('button', { name: /^Bildirishnomalar/ }).click();
      await lead.page.getByRole('dialog', { name: 'Bildirishnomalar' })
        .getByRole('button', { name: /Shifokor havola orqali qo'shildi/ }).first().click();
      await lead.page.waitForTimeout(8000);
      await expect(leaveBtn(lead.page)).toBeVisible();
      await expect(lead.page.getByText('Tasvir tiklanmoqda')).toHaveCount(0);
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`);
      await expect(ut.page.getByText("Mas'ul shifokor hozir xonada emas")).toHaveCount(0);
      await shot({ ut: ut.page, lead: lead.page }, 'V1');

      // V2: UT konsilium oynasini bosib kattalashtiradi, keyin mas'ulga qaytaradi
      await ut.page.getByRole('button', { name: /Dr\. Sardor Toshmatov — Kattalashtirish/ }).click();
      await expect(utMainLabel(ut.page)).toContainText('Dr. Sardor Toshmatov · konsilium');
      await shot({ ut: ut.page }, 'V2-pinned');
      await ut.page.getByRole('button', { name: "Mas'ulni kattalashtirish" }).click();
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`);

      // V3: kim gapirayotgani (soxta mikrofon ovoz chiqaradi)
      await expect(ut.page.getByRole('status').filter({ hasText: /gapirmoqda|gapiryapsiz/ }).first())
        .toBeVisible({ timeout: 30_000 });
      await expect(lead.page.getByRole('status').filter({ hasText: /gapirmoqda|gapiryapsiz/ }).first())
        .toBeVisible({ timeout: 30_000 });

      // V4: mas'ul videoni kattalashtiradi — hujjatlar/AI yashirinadi
      await lead.page.getByRole('button', { name: 'Videoni kattalashtirish' }).click();
      await expect(lead.page.getByText('AI klinik xulosa').first()).toBeHidden();
      await lead.page.getByRole('button', { name: /Dr\. Sardor Toshmatov — Kattalashtirish/ }).click();
      await expect(lead.page.getByRole('button', { name: 'Bemor kamerasiga qaytish' }).first()).toBeVisible();
      await shot({ lead: lead.page }, 'V4-expanded');
      await lead.page.getByRole('button', { name: 'Bemor kamerasiga qaytish' }).first().click();
      await lead.page.keyboard.press('Escape');
      await expect(lead.page.getByText('AI klinik xulosa').first()).toBeVisible();

      // V5: qo'ng'iroq vaqti (45s) o'tdi — UT qabul qilib kirgan, "o'tkazib yuborilgan" chiqmasligi kerak
      const left = 50_000 - (Date.now() - joinedAt);
      if (left > 0) await ut.page.waitForTimeout(left);
      const missedText = await ut.page.evaluate(() =>
        [...document.querySelectorAll('li,div')].find((e) => /^O'tkazib yuborilgan/.test(e.textContent || ''))?.textContent ?? '',
      );
      expect(missedText, 'o\'tkazib yuborilgan qo\'ng\'iroq bo\'lmasligi kerak').toBe('');
    } finally {
      for (const p of [ut, lead, c3]) await p.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });
});
