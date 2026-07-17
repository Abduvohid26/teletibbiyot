import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { loginAs } from './helpers/login';
import {
  PASSWORD,
  prepareVideoConsultation,
  patchIceConfigFetch,
  seedDoctorMediaPrefs,
  seedUtSession,
} from './helpers/video-setup';

/**
 * Haqiqiy WebRTC oqimi ustidan E2E: shifokor (MT) va UT operator ikkita alohida brauzerda,
 * soxta kamera bilan. Bu testlar signaling emas, AYNAN video oqishini tekshiradi —
 * shu sababli qayta ulanish va "pir-pirlash" buglarini ushlaydi.
 */

interface PcSnapshot {
  pcCount: number;
  /** Sahifa ochilgandan beri JAMI yaratilgan PC soni (yopilganlari ham) — churn o'lchovi.
   *  Har "buzib qayta qurish" bu sonni oshiradi = ekran pir-pirlaydi. */
  totalCreated: number;
  connected: number;
  liveRecvVideo: number;
}

/** RTCPeerConnection'larni kuzatish uchun hook — reload'dan keyin ham saqlanadi. */
async function installPcProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __pcs: RTCPeerConnection[] };
    w.__pcs = [];
    const Orig = window.RTCPeerConnection;
    const Patched = function (this: unknown, cfg?: RTCConfiguration) {
      const pc = new Orig(cfg);
      w.__pcs.push(pc);
      return pc;
    } as unknown as typeof RTCPeerConnection;
    Patched.prototype = Orig.prototype;
    window.RTCPeerConnection = Patched;
  });
}

async function snapshotPc(page: Page): Promise<PcSnapshot> {
  return page.evaluate(() => {
    const w = window as unknown as { __pcs?: RTCPeerConnection[] };
    const pcs = w.__pcs ?? [];
    const open = pcs.filter((pc) => pc.connectionState !== 'closed');
    return {
      pcCount: open.length,
      totalCreated: pcs.length,
      connected: open.filter((pc) => pc.connectionState === 'connected').length,
      liveRecvVideo: open.reduce(
        (sum, pc) =>
          sum
          + pc.getReceivers().filter((r) => r.track?.kind === 'video' && r.track.readyState === 'live')
            .length,
        0,
      ),
    };
  });
}

/** Peer'dan jonli video kelishini kutadi (WebRTC haqiqatan ulangan). */
async function waitForRemoteVideo(page: Page, timeoutMs = 60000) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __pcs?: RTCPeerConnection[] };
      return (w.__pcs ?? []).some(
        (pc) =>
          pc.connectionState === 'connected'
          && pc.getReceivers().some((r) => r.track?.kind === 'video' && r.track.readyState === 'live'),
      );
    },
    { timeout: timeoutMs },
  );
}

async function newVideoContext(browser: Browser) {
  return browser.newContext({ permissions: ['camera', 'microphone'] });
}

interface LiveRoom {
  utContext: BrowserContext;
  mtContext: BrowserContext;
  utPage: Page;
  mtPage: Page;
  consultationId: string;
  cleanup: () => Promise<void>;
}

/** Shifokor + UT jonli video sessiyasini ko'taradi va ikkala tomonda video oqishini kutadi. */
async function openLiveRoom(browser: Browser): Promise<LiveRoom> {
  const { consultation, mt } = await prepareVideoConsultation();

  const utContext = await newVideoContext(browser);
  const mtContext = await newVideoContext(browser);
  const utPage = await utContext.newPage();
  const mtPage = await mtContext.newPage();

  await installPcProbe(utPage);
  await installPcProbe(mtPage);
  await seedUtSession(utPage, consultation.id);
  await seedDoctorMediaPrefs(mtPage);
  await patchIceConfigFetch(utPage, mtPage);

  await loginAs(utPage, 'operator@ishifo.uz', PASSWORD, /\/ut/);
  await loginAs(mtPage, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
  await mt.startConsultation(consultation.id);

  await utPage.goto('/ut/vitals');
  await mtPage.goto('/dashboard');

  await waitForRemoteVideo(mtPage);
  await waitForRemoteVideo(utPage);

  return {
    utContext,
    mtContext,
    utPage,
    mtPage,
    consultationId: consultation.id,
    cleanup: async () => {
      await utContext.close().catch(() => undefined);
      await mtContext.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    },
  };
}

test.describe('Jonli video: ulanish va qayta ulanish', () => {
  test.slow();

  test('1) Shifokor va bemor ulanadi — ikkala tomonda video oqadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      const mt = await snapshotPc(room.mtPage);
      const ut = await snapshotPc(room.utPage);

      expect(mt.connected, 'shifokorda ulangan PC bo\'lishi kerak').toBeGreaterThan(0);
      expect(mt.liveRecvVideo, 'shifokor UT kamerasini olishi kerak').toBeGreaterThan(0);
      expect(ut.connected, 'bemorda ulangan PC bo\'lishi kerak').toBeGreaterThan(0);
      expect(ut.liveRecvVideo, 'bemor shifokor kamerasini olishi kerak').toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  test('2) BEMOR refresh qiladi — video avtomatik qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.utPage.reload();
      await room.utPage.goto('/ut/vitals');

      // Bemor yangi socketId bilan qaytadi — shifokor unga qayta offer yuborishi shart.
      await waitForRemoteVideo(room.utPage);
      await waitForRemoteVideo(room.mtPage);

      const mt = await snapshotPc(room.mtPage);
      expect(mt.liveRecvVideo, 'refreshdan keyin shifokor videoni qayta olishi kerak').toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  test('3) SHIFOKOR refresh qiladi — video avtomatik qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.reload();
      await room.mtPage.goto('/dashboard');

      await waitForRemoteVideo(room.mtPage);
      await waitForRemoteVideo(room.utPage);

      const ut = await snapshotPc(room.utPage);
      expect(ut.liveRecvVideo, 'refreshdan keyin bemor videoni qayta olishi kerak').toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  test('4) IKKALASI refresh qiladi — video qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await Promise.all([room.utPage.reload(), room.mtPage.reload()]);
      await Promise.all([room.utPage.goto('/ut/vitals'), room.mtPage.goto('/dashboard')]);

      await waitForRemoteVideo(room.mtPage);
      await waitForRemoteVideo(room.utPage);
    } finally {
      await room.cleanup();
    }
  });

  test('5) Video BARQAROR turadi — 25s davomida pir-pirlamaydi va qayta qurilmaydi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      const start = await snapshotPc(room.mtPage);

      // 25s — server tomonidagi qayta urinish sikllari (4.5s watchdog, 8s retry) bir necha
      // marta ishga tushishiga yetadi. Ular sog'lom ulanishga TEGMASLIGI kerak.
      for (let i = 0; i < 5; i++) {
        await room.mtPage.waitForTimeout(5000);
        const now = await snapshotPc(room.mtPage);
        expect(now.liveRecvVideo, `${(i + 1) * 5}s: video uzilmasligi kerak`).toBeGreaterThan(0);
        expect(now.connected, `${(i + 1) * 5}s: ulanish saqlanishi kerak`).toBeGreaterThan(0);
      }

      // Eng muhimi: video sog'lom ekan, ulanish QAYTA QURILMASLIGI kerak.
      // Har bir qayta qurish = ekran bir lahza o'chib yonadi (pir-pirlash).
      const end = await snapshotPc(room.mtPage);
      expect(
        end.totalCreated - start.totalCreated,
        `barqaror videoda ulanish qayta qurilmasligi kerak — ${end.totalCreated - start.totalCreated} marta qayta qurildi (pir-pirlash)`,
      ).toBe(0);
    } finally {
      await room.cleanup();
    }
  });
});
