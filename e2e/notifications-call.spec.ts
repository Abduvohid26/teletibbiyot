import { test, expect, type Browser, type Page } from '@playwright/test';
import { ApiTestClient, buildTestConsultation, buildTestPatient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import { PASSWORD, patchIceConfigFetch, seedDoctorMediaPrefs, seedUtSession } from './helpers/video-setup';

/**
 * Bildirishnomalar tizimi (barcha rollar) va kiruvchi qo'ng'iroq:
 *  N1) UT bemorni yuboradi → darhol xonaga kiradi → shifokorga qo'ng'iroq → shifokor qabul qiladi → video;
 *      UT'ga qarshi qo'ng'iroq KELMAYDI
 *  N2) Yangi bemor shifokorga faqat xabar (jiringlamaydi) → "Qabul qilish" — qabul boshlanadi va
 *      shifokor darhol xonada → UT'ga ham faqat xabar → UT "Xonaga kirish"
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

  test('N1) UT yuboradi → darhol xonaga kiradi → shifokorga qo\'ng\'iroq → qabul → video, qarshi qo\'ng\'iroq yo\'q', async ({ browser }) => {
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const doc = await freshDoctor('doctor@ishifo.uz');
    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, doc.id));

    const u = await newPage(browser);
    const d = await newPage(browser);
    await seedUtSession(u.page, consultation.id);
    await seedDoctorMediaPrefs(d.page);
    await patchIceConfigFetch(u.page, d.page);
    try {
      await loginAs(d.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await d.page.goto('/dashboard/patients');
      await unlockAudio(d.page);
      // Shifokorda "Yangi bemor" — faqat xabar, jiringlamaydi
      await expect(d.page.getByRole('alertdialog')).toHaveCount(0);

      await loginAs(u.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await u.page.goto('/ut/vitals');
      // Operator shifokor qabul qilishini kutmaydi — darhol kiradi
      await expect(u.page.getByRole('button', { name: 'Xonaga kirish' })).toBeVisible({ timeout: 20_000 });
      await shot(u.page, 'n1-ut-lobby');
      await u.page.getByRole('button', { name: 'Xonaga kirish' }).click();
      const callDoctor = u.page.getByRole('button', { name: "Shifokorga qo'ng'iroq qilish" });
      await expect(callDoctor).toBeVisible({ timeout: 30_000 });
      await shot(u.page, 'n1-ut-in-room');
      await callDoctor.click();

      await expect(callDialog(d.page)).toContainText('sizni video xonaga chaqirmoqda', { timeout: 15_000 });
      await shot(d.page, 'n1-doctor-ring');
      await callDialog(d.page).getByRole('button', { name: 'Qabul qilish' }).click();
      await d.page.waitForURL(/\/dashboard$/);
      await expect(d.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      const row = await doc.client.get<{ status: string }>(`/consultations/${consultation.id}`);
      expect(row.status).toBe('IN_PROGRESS');

      // UT'da qarshi qo'ng'iroq YO'Q, shifokor videoda
      await expect(u.page.getByRole('button', { name: /Shifokorga qo'ng'iroq qilish|Chaqirilmoqda/ })).toHaveCount(0, { timeout: 30_000 });
      await u.page.waitForTimeout(4000);
      await expect(callDialog(u.page)).toHaveCount(0);
      await shot(u.page, 'n1-ut-connected');
    } finally {
      await u.ctx.close();
      await d.ctx.close();
      await doc.client.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });

  test('N2) yangi bemor faqat xabar → "Qabul qilish" xonaga kiritadi → UT ga ham faqat xabar', async ({ browser }) => {
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const doc = await freshDoctor('doctor@ishifo.uz');

    const d = await newPage(browser);
    const u = await newPage(browser);
    await seedDoctorMediaPrefs(d.page);
    await patchIceConfigFetch(d.page, u.page);
    try {
      await loginAs(d.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
      await d.page.goto('/dashboard/patients');
      await unlockAudio(d.page);
      const before = await oscillators(d.page);

      const patientData = buildTestPatient();
      const patient = await ut.createPatient(patientData);
      const consultation = await ut.createConsultation(buildTestConsultation(patient.id, doc.id));

      // Ovozli xabar (+ qisqa toast), lekin ekranni to'sadigan qo'ng'iroq yo'q.
      // Toast 8s da yopiladi — sekin mashinada ham ishonchli bo'lishi uchun ovoz va qo'ng'iroqchani tekshiramiz
      await expect.poll(() => oscillators(d.page), { timeout: 30_000, message: 'xabar ovozi' }).toBeGreaterThan(before);
      await expect(callDialog(d.page)).toHaveCount(0);
      await d.page.getByRole('button', { name: /^Bildirishnomalar/ }).click();
      await expect(d.page.getByRole('dialog', { name: 'Bildirishnomalar' }).getByText('Yangi bemor yuborildi').first()).toBeVisible();
      await d.page.keyboard.press('Escape');

      await seedUtSession(u.page, consultation.id);
      await loginAs(u.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await u.page.goto('/ut/patients');

      // "Qabul qilish" — qabul boshlanadi va shifokor darhol xonada (lobby'siz)
      await d.page.reload();
      const card = d.page.locator('div', { hasText: patientData.fullName }).filter({ has: d.page.getByRole('button', { name: /Qabul qilish/ }) }).last();
      await card.getByRole('button', { name: /Qabul qilish/ }).click();
      await d.page.waitForURL(/\/dashboard$/);
      await expect(d.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      await shot(d.page, 'n2-doctor-in-room');

      // UT'ga "shifokor kutmoqda" — faqat xabar, jiringlamaydi
      await expect(u.page.getByText('Shifokor sizni kutmoqda').first()).toBeVisible({ timeout: 15_000 });
      await expect(callDialog(u.page)).toHaveCount(0);
      await u.page.goto('/ut/vitals');
      await u.page.getByRole('button', { name: 'Xonaga kirish' }).click();
      await expect(u.page.getByRole('button', { name: /Uzish/ })).toBeVisible({ timeout: 30_000 });
      await expect(u.page.getByRole('button', { name: "Shifokorga qo'ng'iroq qilish" })).toHaveCount(0, { timeout: 30_000 });
    } finally {
      await d.ctx.close();
      await u.ctx.close();
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
