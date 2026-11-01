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
 * Google Meet qoidasi: xonada kamida bitta odam bor ekan — u ochiq.
 *   M1) Xonani ochgan (mas'ul) chiqib ketsa ham qolganlar gaplashaveradi
 *   M2) Bitta odam qolsa — "Tugatasizmi?"; "Yo'q" → kutadi, boshqalar qaytib kiradi
 *   M3) Mas'ul ichkarida odam turganda YAKUNLASA — hech kim chiqarib yuborilmaydi
 *   M4) Yakunlangandan keyin F5 bosgan odam qayta kira oladi (ichkarida odam bor)
 *   M5) Oxirgi odam "Ha, tugatish" → xona yopiladi, qayta kirib bo'lmaydi
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
    viewport: { width: 1366, height: 800 },
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  });
  const page = await ctx.newPage();
  return { page, close: async () => { await ctx.close(); await own?.close(); } };
}

const leaveBtn = (p: Page) => p.getByRole('button', { name: /^Uzish$/ }).first();
const alonePrompt = (p: Page) => p.getByRole('alertdialog', { name: 'Xonada faqat siz qoldingiz' });

async function playing(page: Page) {
  return page.evaluate(
    () => [...document.querySelectorAll('video')].filter((v) => v.srcObject && v.readyState >= 2 && v.videoWidth > 0 && !v.paused).length,
  );
}
async function expectPlaying(page: Page, min: number, who: string) {
  await expect.poll(() => playing(page), { timeout: 30_000, message: `${who}: kamida ${min} video` }).toBeGreaterThanOrEqual(min);
}

test.describe('Meet qoidasi: xona odam bor ekan ochiq', () => {
  test.setTimeout(480_000);

  test('M1–M5', async ({ browser }) => {
    const { consultation, mt, ut: utApi } = await prepareVideoConsultation();
    const d2 = new ApiTestClient();
    const d3 = new ApiTestClient();
    const d2id = (await d2.login('doctor2@ishifo.uz', PASSWORD)).user!.id;
    const d3id = (await d3.login('doctor3@ishifo.uz', PASSWORD)).user!.id;
    await d2.completeActiveConsultationIfAny().catch(() => undefined);
    await d3.completeActiveConsultationIfAny().catch(() => undefined);
    await mt.startConsultation(consultation.id);

    const ut = await openAs(browser, 'ut');
    const lead = await openAs(browser, 'lead');
    const c2 = await openAs(browser, 'c2');
    const c3 = await openAs(browser, 'c3');
    await seedUtSession(ut.page, consultation.id);
    for (const p of [lead.page, c2.page, c3.page]) await seedDoctorMediaPrefs(p);
    await patchIceConfigFetch(ut.page, lead.page, c2.page, c3.page);
    const shot = async (who: Record<string, Page>, step: string) => {
      if (SHOTS) await Promise.all(Object.entries(who).map(([w, p]) => p.screenshot({ path: `${SHOTS}/${step}-${w}.png` })));
    };

    try {
      await loginAs(ut.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await loginAs(lead.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await loginAs(c2.page, 'doctor2@ishifo.uz', PASSWORD, /\/dashboard/);
      await loginAs(c3.page, 'doctor3@ishifo.uz', PASSWORD, /\/dashboard/);
      await c2.page.goto('/dashboard/patients');
      await c3.page.goto('/dashboard/patients');
      await lead.page.goto('/dashboard');
      await clickLobbyJoin(lead.page, "mas'ul");
      await ut.page.goto('/ut/vitals');
      await clickLobbyJoin(ut.page, 'UT');
      await mt.post(`/consultations/${consultation.id}/participants`, { doctorIds: [d2id, d3id] });
      for (const c of [c2.page, c3.page]) {
        await c.getByRole('alertdialog').getByRole('button', { name: 'Qabul qilish' }).click({ timeout: 20_000 });
        await expect(leaveBtn(c)).toBeVisible({ timeout: 30_000 });
      }
      await expectPlaying(ut.page, 4, 'UT (4 kishi)');

      // M1: xonani ochgan mas'ul chiqadi — qolgan uchtasi bir-birini ko'raveradi
      await leaveBtn(lead.page).click();
      await expect(ut.page.getByText("Mas'ul shifokor hozir xonada emas")).toBeVisible({ timeout: 30_000 });
      await expectPlaying(ut.page, 3, 'UT (mas\'ulsiz)');
      await expectPlaying(c2.page, 3, 'konsilium 2 (mas\'ulsiz)');
      await expect(alonePrompt(c2.page)).toHaveCount(0);
      await clickLobbyJoin(lead.page, "mas'ul");
      await expect(ut.page.getByText("Mas'ul shifokor hozir xonada emas")).toHaveCount(0, { timeout: 30_000 });

      // M2: c3, UT, mas'ul chiqadi — c2 yolg'iz → so'raladi → "Yo'q" → kutadi
      await leaveBtn(c3.page).click();
      await leaveBtn(ut.page).click();
      await leaveBtn(lead.page).click();
      await expect(alonePrompt(c2.page)).toBeVisible({ timeout: 30_000 });
      await expect(alonePrompt(c2.page)).toContainText('Xona ochiq qoladi');
      await shot({ c2: c2.page }, 'M2-alone');
      await alonePrompt(c2.page).getByRole('button', { name: "Yo'q, kutaman" }).click();
      await expect(alonePrompt(c2.page)).toHaveCount(0);
      await expect(leaveBtn(c2.page)).toBeVisible();
      // Boshqalar qaytib kiradi (xona ochiq)
      await clickLobbyJoin(lead.page, "mas'ul");
      await clickLobbyJoin(ut.page, 'UT');
      await clickLobbyJoin(c3.page, 'konsilium 3');
      await expectPlaying(ut.page, 4, 'UT (qaytib kirgach)');

      // M3: mas'ul yakunlaydi — ichkaridagilar chiqarib yuborilmaydi
      await mt.completeConsultation(consultation.id, {
        diagnosis: 'Meet sinovi', icd10Code: 'Z00.0', recommendations: 'Test',
      });
      await expect(ut.page.getByText('Konsultatsiya yakunlandi.')).toBeVisible({ timeout: 20_000 });
      await expect(c2.page.getByText('Konsultatsiya yakunlandi.')).toBeVisible({ timeout: 20_000 });
      await ut.page.waitForTimeout(4000);
      await expect(leaveBtn(ut.page)).toBeVisible();
      await expect(leaveBtn(c2.page)).toBeVisible();
      await expectPlaying(ut.page, 3, 'UT (yakunlangandan keyin)');
      await expectPlaying(c2.page, 3, 'konsilium 2 (yakunlangandan keyin)');
      await shot({ ut: ut.page, c2: c2.page }, 'M3-after-complete');

      // M4: yakunlangandan keyin F5 — qayta kiradi (ichkarida odam bor)
      await c3.page.reload();
      await expect(leaveBtn(c3.page)).toBeVisible({ timeout: 45_000 });

      // M5: hamma chiqadi, oxirgi c2 "Ha, tugatish" → xona yopiladi
      await leaveBtn(lead.page).click().catch(() => undefined);
      await leaveBtn(c3.page).click();
      await leaveBtn(ut.page).click();
      await expect(alonePrompt(c2.page)).toBeVisible({ timeout: 30_000 });
      await expect(alonePrompt(c2.page)).toContainText('xona yopiladi');
      await alonePrompt(c2.page).getByRole('button', { name: 'Ha, tugatish' }).click();
      await c2.page.waitForURL(/\/dashboard\/patients/, { timeout: 20_000 });
      // Bo'sh qolgan yakunlangan xona — endi yopiq: hech kimga token berilmaydi
      await expect
        .poll(
          () => utApi.get(`/video/sfu-token/${consultation.id}`).then(() => 'open', (e: Error) => (/403/.test(e.message) ? 'closed' : e.message)),
          { timeout: 15_000 },
        )
        .toBe('closed');
    } finally {
      for (const p of [ut, lead, c2, c3]) await p.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });
});
