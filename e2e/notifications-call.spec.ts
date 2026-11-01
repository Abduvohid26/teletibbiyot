import { test, expect, type Browser, type Page } from '@playwright/test';
import { ApiTestClient, buildTestConsultation, buildTestPatient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import { PASSWORD, patchIceConfigFetch, seedDoctorMediaPrefs, seedUtSession } from './helpers/video-setup';

/**
 * Bildirishnomalar tizimi (barcha rollar) va kiruvchi qo'ng'iroq:
 *  N1) Shifokor qabulni boshlaydi → UT operatorda jiringlaydi → "Ulanish" → video lobby'siz ulanadi
 *  N2) UT bemor yuboradi → shifokorda "Yangi bemor" jiringlaydi → "Qabul qilish" qabulni boshlaydi
 *  N3) Konsiliumga chaqiruv → "Rad etish" → mas'ul shifokor qo'ng'iroqchasida "konsiliumdan chiqdi"
 *  N4) Admin: qurilma uzilsa qo'ng'iroqchada ogohlantirish (bemor ma'lumotisiz)
 */
const SHOTS = process.env.E2E_SHOTS_DIR;
const callDialog = (page: Page) => page.getByRole('alertdialog');

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Ovoz haqiqatan chalinyaptimi — Web Audio oscillatorlarini sanaymiz
  await page.addInitScript(() => {
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const proto = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext).prototype;
    const orig = proto.createOscillator;
    proto.createOscillator = function (this: AudioContext) {
      w.__osc += 1;
      return orig.call(this);
    };
  });
  return { ctx, page };
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const oscillators = (page: Page) => page.evaluate(() => (window as unknown as { __osc: number }).__osc);

/** Brauzer ovozni faqat foydalanuvchi bosgandan keyin ruxsat beradi */
async function unlockAudio(page: Page) {
  await page.mouse.click(5, 300);
}

async function freshDoctor(email: string) {
  const c = new ApiTestClient();
  const login = await c.login(email, PASSWORD);
  await c.completeActiveConsultationIfAny().catch(() => undefined);
  return { client: c, id: login.user!.id };
}

test.describe('Bildirishnomalar va qo\'ng\'iroq', () => {
  test.setTimeout(180_000);

  test('N1) shifokor boshlaydi → UT da qo\'ng\'iroq → Ulanish → video ulanadi', async ({ browser }) => {
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const doc = await freshDoctor('doctor@ishifo.uz');
    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, doc.id));

    const p = await newPage(browser);
    await seedUtSession(p.page, consultation.id);
    await patchIceConfigFetch(p.page);
    try {
      await loginAs(p.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await p.page.goto('/ut/patients');
      await unlockAudio(p.page);
      const before = await oscillators(p.page);

      await doc.client.startConsultation(consultation.id);

      await expect(callDialog(p.page)).toBeVisible({ timeout: 15_000 });
      await expect(callDialog(p.page)).toContainText('sizni kutmoqda');
      await shot(p.page, 'n1-ut-incoming-call');
      await p.page.waitForTimeout(800);
      expect(await oscillators(p.page), 'qo\'ng\'iroq ovozi chalinishi kerak').toBeGreaterThan(before);

      await callDialog(p.page).getByRole('button', { name: 'Ulanish' }).click();
      await p.page.waitForURL(/\/ut\/vitals/);
      await expect(callDialog(p.page)).toHaveCount(0);
      // Lobby ko'rinmaydi — to'g'ridan-to'g'ri xonaga kiradi
      await expect(p.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      await shot(p.page, 'n1-ut-joined');

      // Qo'ng'iroqchada ham saqlangan
      await p.page.getByRole('button', { name: /^Bildirishnomalar/ }).click();
      await expect(p.page.getByRole('dialog', { name: 'Bildirishnomalar' })).toContainText('Shifokor sizni kutmoqda');
    } finally {
      await p.ctx.close();
      await doc.client.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });

  test('N2) UT bemor yuboradi → shifokorda "Yangi bemor" → Qabul qilish', async ({ browser }) => {
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const doc = await freshDoctor('doctor@ishifo.uz');

    const p = await newPage(browser);
    await seedDoctorMediaPrefs(p.page);
    await patchIceConfigFetch(p.page);
    try {
      await loginAs(p.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await p.page.goto('/dashboard/settings');
      await unlockAudio(p.page);

      const patient = await ut.createPatient(buildTestPatient());
      const consultation = await ut.createConsultation(buildTestConsultation(patient.id, doc.id));

      await expect(callDialog(p.page)).toBeVisible({ timeout: 15_000 });
      await expect(callDialog(p.page)).toContainText('Sizga yangi bemor yuborildi');
      await shot(p.page, 'n2-doctor-new-patient-call');
      await callDialog(p.page).getByRole('button', { name: 'Qabul qilish' }).click();
      await p.page.waitForURL(/\/dashboard$/);

      const row = await doc.client.get<{ status: string }>(`/consultations/${consultation.id}`);
      expect(row.status).toBe('IN_PROGRESS');
      await expect(p.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      await shot(p.page, 'n2-doctor-started');
    } finally {
      await p.ctx.close();
      await doc.client.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });

  test('N3) konsilium qo\'ng\'irog\'i → Rad etish → mas\'ul biladi', async ({ browser }) => {
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const lead = await freshDoctor('doctor@ishifo.uz');
    const d2 = await freshDoctor('doctor2@ishifo.uz');
    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, lead.id));
    await lead.client.startConsultation(consultation.id);

    const c = await newPage(browser);
    const l = await newPage(browser);
    try {
      await loginAs(c.page, 'doctor2@ishifo.uz', PASSWORD, /\/dashboard/);
      await loginAs(l.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await c.page.goto('/dashboard/patients');
      await l.page.goto('/dashboard/patients');
      await unlockAudio(c.page);

      await lead.client.post(`/consultations/${consultation.id}/participants`, { doctorIds: [d2.id] });

      await expect(callDialog(c.page)).toBeVisible({ timeout: 15_000 });
      await expect(callDialog(c.page)).toContainText('sizni konsiliumga chaqirmoqda');
      await shot(c.page, 'n3-consilium-call');
      await callDialog(c.page).getByRole('button', { name: 'Rad etish' }).click();
      await expect(c.page.getByText('Konsilium taklifini rad etdingiz')).toBeVisible();

      const parts = await lead.client.get<Array<{ doctorId: string }>>(`/consultations/${consultation.id}/participants`);
      expect(parts.map((x) => x.doctorId)).not.toContain(d2.id);

      // Mas'ul shifokorga real vaqtda xabar + qo'ng'iroqchada belgi
      await expect(l.page.getByText('Shifokor konsiliumdan chiqdi').first()).toBeVisible({ timeout: 15_000 });
      await shot(l.page, 'n3-lead-notified');
    } finally {
      await c.ctx.close();
      await l.ctx.close();
      await lead.client.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });

  test('N4) admin: qurilma uzilsa ogohlantirish keladi', async ({ browser }) => {
    const ut = new ApiTestClient();
    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const u = utLogin.user as { facilityId?: string | null; facility?: { id: string } };
    const facilityId = u.facilityId ?? u.facility?.id;
    const devices = await ut.get<Array<{ id: string; name: string; connected: boolean }>>(
      `/devices/facility/${facilityId}`,
    );
    // Bir qurilma 10 daqiqada bir marta ogohlantiradi (uzilib-ulanish spam bo'lmasin) —
    // takroriy sinovlar uchun tasodifiy qurilma
    const device = devices[Math.floor(Math.random() * devices.length)];
    // Avval ulangan holatga qaytaramiz (oldingi sinovdan uzilgan bo'lishi mumkin)
    await ut.patch(`/devices/${device.id}`, { connected: true, status: 'good' });

    const a = await newPage(browser);
    try {
      await loginAs(a.page, 'admin@ishifo.uz', PASSWORD, /\/admin/);
      await unlockAudio(a.page);
      await a.page.waitForTimeout(1500);

      await ut.patch(`/devices/${device.id}`, { connected: false, status: 'offline' });
      await expect(a.page.getByText('Qurilma uzildi').first()).toBeVisible({ timeout: 15_000 });
      await a.page.getByRole('button', { name: /^Bildirishnomalar/ }).click();
      const panel = a.page.getByRole('dialog', { name: 'Bildirishnomalar' });
      await expect(panel).toContainText(device.name);
      await shot(a.page, 'n4-admin-bell');
    } finally {
      await ut.patch(`/devices/${device.id}`, { connected: true, status: 'good' }).catch(() => undefined);
      await a.ctx.close();
    }
  });
});
