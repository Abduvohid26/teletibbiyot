import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { ApiTestClient, buildTestConsultation, buildTestPatient } from './helpers/api-client';
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
 * Konsilium: har bir rol boshqalarni TO'G'RI ko'radimi (UT + mas'ul + 2 konsilium).
 *
 *   R1) UT asosiy oynasida doim MAS'UL shifokor (kim keyin ulanishidan qat'i nazar)
 *   R2) Konsilium shifokori F5 qilsa ham tartib buzilmaydi
 *   R3) Mas'ul chiqsa — UT "mas'ul xonada emas" ni ko'radi; qaytsa yana asosiyda
 *   R4) Konsilium paneli: kim xonada / kim yo'q real vaqtda
 *   R5) Chiqarilgan shifokor ESKI havola bilan qaytolmaydi, YANGI havola bilan kiradi
 *   R6) Qo'ng'iroqda turgan shifokorga yangi qo'ng'iroq ekranni to'smaydi
 *
 * Har bir rol o'z nomi yozilgan kamerani ko'rsatsin desangiz (skrinshotlarda kim
 * qayerdaligi ko'rinadi): E2E_FAKE_CAM_DIR=<papka> (ut.y4m, lead.y4m, c2.y4m, c3.y4m).
 */
const CAM_DIR = process.env.E2E_FAKE_CAM_DIR;
const SHOTS = process.env.E2E_SHOTS_DIR;
const EXE = process.env.E2E_CHROMIUM;

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

async function shot(pages: Record<string, Page>, step: string) {
  if (!SHOTS) return;
  await Promise.all(Object.entries(pages).map(([who, p]) => p.screenshot({ path: `${SHOTS}/${step}-${who}.png` })));
}

/** Ekrandagi videolardan nechtasida haqiqatan kadr bor (qora oyna emas) */
async function expectPlayingVideos(page: Page, min: number, who: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll('video')].filter(
              (v) => v.srcObject && v.readyState >= 2 && v.videoWidth > 0 && !v.paused,
            ).length,
        ),
      { timeout: 30_000, message: `${who}: kamida ${min} ta video o'ynashi kerak` },
    )
    .toBeGreaterThanOrEqual(min);
}

/** UT katta oynasidagi yorliq: "<ism> · mas'ul|konsilium" */
const utMainLabel = (ut: Page) => ut.locator('span.bg-gold-400').filter({ hasText: /·/ }).first();

test.describe('Konsilium: rollar bir-birini qanday ko\'radi', () => {
  test.setTimeout(420_000);

  test('R1–R6', async ({ browser }) => {
    const { consultation, mt } = await prepareVideoConsultation();
    const d2 = new ApiTestClient();
    const d3 = new ApiTestClient();
    const d2id = (await d2.login('doctor2@ishifo.uz', PASSWORD)).user!.id;
    const d3id = (await d3.login('doctor3@ishifo.uz', PASSWORD)).user!.id;
    await d2.completeActiveConsultationIfAny().catch(() => undefined);
    await d3.completeActiveConsultationIfAny().catch(() => undefined);
    await mt.startConsultation(consultation.id);
    const leadName = 'Dr. Akmal Karimov';

    const ut = await openAs(browser, 'ut');
    const lead = await openAs(browser, 'lead');
    const c2 = await openAs(browser, 'c2');
    const c3 = await openAs(browser, 'c3');
    await seedUtSession(ut.page, consultation.id);
    for (const p of [lead.page, c2.page, c3.page]) await seedDoctorMediaPrefs(p);
    await patchIceConfigFetch(ut.page, lead.page, c2.page, c3.page);

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
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`, { timeout: 45_000 });

      // R1: ikkala konsilium shifokori MAS'ULDAN KEYIN ulanadi — asosiy oyna o'zgarmasligi shart
      await mt.post(`/consultations/${consultation.id}/participants`, { doctorIds: [d2id, d3id] });
      for (const c of [c2.page, c3.page]) {
        await c.getByRole('alertdialog').getByRole('button', { name: 'Qabul qilish' }).click({ timeout: 20_000 });
        await expect(c.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      }
      // Kichik oynalarda ikkala konsilium shifokori, "konsilium" yorlig'i bilan
      await expect(ut.page.getByText('konsilium', { exact: true })).toHaveCount(2, { timeout: 30_000 });
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`);
      // Konsilium shifokori ekranida mas'ul — birinchi va "mas'ul" yorlig'i bilan
      await expect(c2.page.getByText("mas'ul", { exact: true }).first()).toBeVisible();
      // R4: mas'ul panelida hamma xonada (o'zi + 2 konsilium)
      await expect(lead.page.locator('[title="xonada"]')).toHaveCount(3, { timeout: 20_000 });
      // Qora oyna yo'q: UT — mas'ul + 2 konsilium + o'z kamerasi; shifokorlar — UT + 2 hamkasb + o'zi
      await expectPlayingVideos(ut.page, 4, 'UT');
      for (const [who, p] of [['mas\'ul', lead.page], ['konsilium 2', c2.page], ['konsilium 3', c3.page]] as const) {
        await expectPlayingVideos(p, 4, who);
      }
      await shot({ ut: ut.page, lead: lead.page, c2: c2.page, c3: c3.page }, 'R1');

      // R2: konsilium shifokori F5
      await c2.page.reload();
      await expect(c2.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 45_000 });
      await ut.page.waitForTimeout(4000);
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`);

      // R5 (1-qism): havola c3 chiqarilishidan OLDIN olinadi
      const before = await mt.post<{ token: string }>(`/consultations/${consultation.id}/invite-link`);
      await fetch(`http://localhost:3001/api/consultations/${consultation.id}/participants/${d3id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mt.accessToken}`, 'X-Ishifo-Client': 'web' },
      });
      await c3.page.waitForURL(/\/dashboard\/patients/, { timeout: 20_000 });
      await expect(ut.page.getByText('konsilium', { exact: true })).toHaveCount(1, { timeout: 20_000 });
      // Chiqarilgan shifokor eski havola bilan qaytolmaydi
      await c3.page.goto(`/dashboard/join/${before.token}`);
      await expect(c3.page.getByText('sizni konsiliumdan chiqargan')).toBeVisible({ timeout: 20_000 });

      // R3: mas'ul "Uzish" — UT ogohlantirishni ko'radi
      await lead.page.getByRole('button', { name: /^Uzish$/ }).first().click();
      await expect(ut.page.getByText("Mas'ul shifokor hozir xonada emas")).toBeVisible({ timeout: 30_000 });
      await expect(utMainLabel(ut.page)).toContainText('konsilium');
      // Konsilium shifokori panelida mas'ul endi "xonada" emas
      await expect(c2.page.locator('[title="xonada"]')).toHaveCount(1, { timeout: 20_000 });
      await shot({ ut: ut.page, c2: c2.page }, 'R3-lead-away');
      await clickLobbyJoin(lead.page, "mas'ul");
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`, { timeout: 45_000 });
      await expect(ut.page.getByText("Mas'ul shifokor hozir xonada emas")).toHaveCount(0);

      // R5 (2-qism): yangi havola — c3 o'z profili bilan kirib, video bilan qo'shiladi
      const fresh = await mt.post<{ token: string }>(`/consultations/${consultation.id}/invite-link`);
      await c3.page.goto(`/dashboard/join/${fresh.token}`);
      await c3.page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
      await expect(c3.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 45_000 });
      await expect(ut.page.getByText('konsilium', { exact: true })).toHaveCount(2, { timeout: 30_000 });
      await expect(utMainLabel(ut.page)).toContainText(`${leadName} · mas'ul`);
      await expectPlayingVideos(ut.page, 4, 'UT (havoladan keyin)');
      await expectPlayingVideos(c3.page, 4, 'havola orqali kirgan shifokor');
      await shot({ ut: ut.page, lead: lead.page, c3: c3.page }, 'R5-link-join');

      // R6: mas'ul qo'ng'iroqda — unga yangi bemor yuboriladi: ekran to'silmaydi
      const ut2 = new ApiTestClient();
      await ut2.login('operator@ishifo.uz', PASSWORD);
      const leadId = (await mt.get<{ id: string }>('/auth/me')).id;
      const p2 = await ut2.createPatient(buildTestPatient());
      const queued = await ut2.createConsultation(buildTestConsultation(p2.id, leadId));
      await expect(lead.page.getByText('Siz hozir video qo\'ng\'iroqdasiz', { exact: false })).toBeVisible({ timeout: 15_000 });
      await expect(lead.page.getByRole('alertdialog')).toHaveCount(0);
      await expect(lead.page.getByRole('button', { name: /^Uzish$/ }).first()).toBeVisible();
      await shot({ lead: lead.page }, 'R6-in-call');
      await ut2.cancelConsultation(queued.id, 'E2E tozalash').catch(() => undefined);
    } finally {
      for (const p of [ut, lead, c2, c3]) await p.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });
});
