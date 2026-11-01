import { test, expect, chromium, type Page } from '@playwright/test';
import { RoomServiceClient } from 'livekit-server-sdk';
import { loginAs } from './helpers/login';
import { clickLobbyJoin } from './helpers/video-live-room';
import { PASSWORD, patchIceConfigFetch, prepareVideoConsultation, seedDoctorMediaPrefs, seedUtSession } from './helpers/video-setup';

/**
 * UT kameralari (4 ta soxta kamera, LiveKit):
 *   C1) Avtomatik taqsimot — 4 kameraning HAMMASI serverga yetadi (ilgari "Asosiy"
 *       simulcast tufayli "publish time out" bo'lib yo'qolardi)
 *   C2) Bitta katakni qo'lda tanlash qolgan kameralarni o'chirmaydi
 *   C3) Kamera boshqa katakka ko'chiriladi — eski katak bo'shaydi
 *   C4) "Ishlatilmasin" — kamera serverdan ham olinadi
 */
test.skip(process.env.E2E_LIVEKIT !== 'true', 'Faqat LiveKit (SFU) rejimi uchun');

const EXE = process.env.E2E_CHROMIUM;
const rooms = new RoomServiceClient(
  process.env.LIVEKIT_API_URL || 'http://localhost:7880',
  process.env.LIVEKIT_API_KEY || 'ishifo_devkey',
  process.env.LIVEKIT_API_SECRET || 'ishifo_livekit_dev_secret_32chars!!',
);

/** Serverda UT e'lon qilgan kamera treklari */
async function serverCams(roomName: string) {
  const out: string[] = [];
  for (const p of await rooms.listParticipants(roomName)) {
    for (const t of p.tracks) if (t.name.startsWith('cam-') && t.name !== 'cam-doctor') out.push(t.name);
  }
  return out.sort().join(' ');
}

async function pick(ut: Page, slot: string, option: string | RegExp) {
  const span = ut.locator('span', { hasText: new RegExp(`^${slot}$`) }).first();
  const tile = span.locator('xpath=ancestor::*[.//button[@aria-label="Bu katak uchun kamera tanlash"]][1]');
  await tile.getByRole('button', { name: 'Bu katak uchun kamera tanlash' }).click();
  await ut.getByRole('button', { name: option }).first().click();
}

test('C1–C4 UT kameralari', async () => {
  test.setTimeout(300_000);
  const { consultation, mt } = await prepareVideoConsultation({ start: true });
  const launch = (args: string[]) => chromium.launch({ ...(EXE ? { executablePath: EXE } : {}), args: ['--use-fake-ui-for-media-stream', ...args] });
  const utB = await launch(['--use-fake-device-for-media-stream=device-count=4']);
  const dB = await launch(['--use-fake-device-for-media-stream']);
  const base = { viewport: { width: 1440, height: 860 }, baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000' };
  const ut = await (await utB.newContext(base)).newPage();
  const lead = await (await dB.newContext(base)).newPage();
  await seedUtSession(ut, consultation.id);
  await seedDoctorMediaPrefs(lead);
  await patchIceConfigFetch(ut, lead);
  try {
    await loginAs(lead, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
    await lead.goto('/dashboard');
    await clickLobbyJoin(lead, "mas'ul");
    await loginAs(ut, 'operator@ishifo.uz', PASSWORD, /\/ut/);
    await ut.goto('/ut/vitals');
    const ring = ut.getByRole('alertdialog');
    if (await ring.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
      await ring.getByRole('button', { name: 'Ulanish' }).click();
    } else {
      await clickLobbyJoin(ut, 'UT');
    }
    const devices = await ut.evaluate(async () =>
      (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').map((d) => d.label));
    expect(devices.length).toBe(4);

    // C1
    await expect.poll(() => serverCams(consultation.id), { timeout: 45_000 })
      .toBe('cam-close cam-equipment cam-main cam-room');

    // C2: "Asosiy" ni qo'lda (o'sha kameraning o'zi) tanlash — qolganlar o'chmasligi kerak
    await pick(ut, 'Asosiy', devices[1]);
    await ut.waitForTimeout(6000);
    expect(await serverCams(consultation.id)).toBe('cam-close cam-equipment cam-main cam-room');

    // C3: "Asosiy" dagi kamerani "Bemor" ga ko'chirish
    await pick(ut, 'Bemor', devices[1]);
    await expect.poll(() => serverCams(consultation.id), { timeout: 30_000 })
      .toBe('cam-close cam-equipment cam-room');

    // C4: "Xona" ishlatilmasin
    await pick(ut, 'Xona', 'Ishlatilmasin');
    await expect.poll(() => serverCams(consultation.id), { timeout: 30_000 }).toBe('cam-close cam-equipment');
  } finally {
    await utB.close();
    await dB.close();
    await mt.completeActiveConsultationIfAny().catch(() => undefined);
  }
});
