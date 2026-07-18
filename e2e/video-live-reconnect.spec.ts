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
 * ═══════════════════════════════════════════════════════════════════════════
 * JONLI VIDEO E2E — haqiqiy WebRTC oqimi (soxta kamera bilan, 2 ta brauzer)
 * ═══════════════════════════════════════════════════════════════════════════
 * Bu testlar signaling hodisalarini emas, AYNAN videoning oqishini tekshiradi:
 * "peer connection = connected VA jonli video treki kelmoqda".
 * Shu sababli qayta ulanish va "pir-pirlash" buglarini ushlay oladi.
 *
 * QAMRALGAN HOLATLAR:
 *   A. Ulanish tartibi   — A1: shifokor birinchi · A2: bemor birinchi
 *   B. Refresh (F5)      — B1: bemor · B2: shifokor · B3: ikkalasi
 *                          B4: bemor 3 marta ketma-ket · B5: refreshdan keyin barqarorlik
 *   C. Qo'lda tiklash    — C1: "Qayta ulash" tugmasi (bemor refreshdan keyin)
 *   D. Tarmoq uzilishi   — D1: bemor offline → online
 *   E. Barqarorlik       — E1: 25s pir-pirlamaydi
 *   F. Chiqib-kirish     — F1: bemor sahifani yopadi va qaytadi
 */

/** Qayta ulanish uchun maksimal ruxsat etilgan vaqt — "oxir-oqibat" emas, TEZ bo'lishi shart. */
const RECONNECT_BUDGET_MS = 30000;
const FIRST_CONNECT_BUDGET_MS = 45000;

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

/** Peer'dan jonli video kelishini kutadi (WebRTC haqiqatan ulangan va oqmoqda). */
async function waitForRemoteVideo(page: Page, timeoutMs = FIRST_CONNECT_BUDGET_MS, label = 'video') {
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
  ).catch(() => {
    throw new Error(`${label}: ${timeoutMs / 1000}s ichida jonli video kelmadi`);
  });
}

async function newVideoContext(browser: Browser) {
  return browser.newContext({ permissions: ['camera', 'microphone'] });
}

/** Google Meet uslubi: sahifada "Jonli efirga qo'shilish" tugmasini bosib efirga kiramiz. */
async function clickJoin(page: Page, label = 'efir') {
  const btn = page.getByRole('button', { name: /Jonli efirga qo'shilish/i });
  await btn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
    throw new Error(`${label}: "Jonli efirga qo'shilish" tugmasi chiqmadi`);
  });
  await btn.click();
}

interface LiveRoom {
  utContext: BrowserContext;
  mtContext: BrowserContext;
  utPage: Page;
  mtPage: Page;
  consultationId: string;
  /** UT sahifasini qayta ochish (refresh yoki qaytib kirish uchun) */
  reopenUt: () => Promise<void>;
  reopenMt: () => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Shifokor + UT jonli video sessiyasini ko'taradi.
 * @param joinOrder 'mt-first' — shifokor xonada kutib turadi, keyin bemor qo'shiladi
 *                  'ut-first' — bemor kutib turadi, keyin shifokor qo'shiladi
 */
async function openLiveRoom(
  browser: Browser,
  joinOrder: 'mt-first' | 'ut-first' = 'mt-first',
): Promise<LiveRoom> {
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

  if (joinOrder === 'mt-first') {
    await mtPage.goto('/dashboard');
    await clickJoin(mtPage, 'shifokor');
    await mtPage.waitForTimeout(2500); // shifokor xonada yolg'iz kutadi
    await utPage.goto('/ut/vitals');
    await clickJoin(utPage, 'bemor');
  } else {
    await utPage.goto('/ut/vitals');
    await clickJoin(utPage, 'bemor');
    await utPage.waitForTimeout(2500); // bemor xonada yolg'iz kutadi
    await mtPage.goto('/dashboard');
    await clickJoin(mtPage, 'shifokor');
  }

  await waitForRemoteVideo(mtPage, FIRST_CONNECT_BUDGET_MS, 'shifokor (dastlabki)');
  await waitForRemoteVideo(utPage, FIRST_CONNECT_BUDGET_MS, 'bemor (dastlabki)');

  return {
    utContext,
    mtContext,
    utPage,
    mtPage,
    consultationId: consultation.id,
    // Refresh'dan keyin Google Meet kabi lobby qaytadi — qayta "Qo'shilish" bosiladi.
    reopenUt: async () => {
      await utPage.goto('/ut/vitals');
      await clickJoin(utPage, 'bemor (qayta)');
    },
    reopenMt: async () => {
      await mtPage.goto('/dashboard');
      await clickJoin(mtPage, 'shifokor (qayta)');
    },
    cleanup: async () => {
      await utContext.close().catch(() => undefined);
      await mtContext.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    },
  };
}

test.describe('Jonli video — ulanish va qayta ulanish', () => {
  test.slow();

  // ─── A. ULANISH TARTIBI ──────────────────────────────────────────────────
  test('A1) Shifokor xonada kutadi → bemor qo\'shiladi → ikki tomonda video oqadi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser, 'mt-first');
    try {
      const mt = await snapshotPc(room.mtPage);
      const ut = await snapshotPc(room.utPage);
      expect(mt.liveRecvVideo, 'shifokor UT kamerasini olishi kerak').toBeGreaterThan(0);
      expect(ut.liveRecvVideo, 'bemor shifokor kamerasini olishi kerak').toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  test('A2) Bemor xonada kutadi → shifokor qo\'shiladi → ikki tomonda video oqadi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser, 'ut-first');
    try {
      const mt = await snapshotPc(room.mtPage);
      const ut = await snapshotPc(room.utPage);
      expect(mt.liveRecvVideo, 'shifokor UT kamerasini olishi kerak').toBeGreaterThan(0);
      expect(ut.liveRecvVideo, 'bemor shifokor kamerasini olishi kerak').toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  // ─── B. REFRESH (F5) ─────────────────────────────────────────────────────
  test('B1) BEMOR refresh qiladi → shifokor tez qayta ulanadi (shifokor refreshsiz)', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(5000); // ulanish "o'rnashsin"
      await room.reopenUt();

      // MUHIM: shifokor O'ZI refresh qilmasdan, avtomatik qayta ulanishi shart.
      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'shifokor (bemor refreshdan keyin)');
      await waitForRemoteVideo(room.utPage, RECONNECT_BUDGET_MS, 'bemor (o\'z refreshidan keyin)');
    } finally {
      await room.cleanup();
    }
  });

  test('B2) SHIFOKOR refresh qiladi → video qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(5000);
      await room.reopenMt();

      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'shifokor (o\'z refreshidan keyin)');
      await waitForRemoteVideo(room.utPage, RECONNECT_BUDGET_MS, 'bemor (shifokor refreshdan keyin)');
    } finally {
      await room.cleanup();
    }
  });

  test('B3) IKKALASI bir vaqtda refresh qiladi → video qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await Promise.all([room.reopenUt(), room.reopenMt()]);
      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'shifokor (ikkala refresh)');
      await waitForRemoteVideo(room.utPage, RECONNECT_BUDGET_MS, 'bemor (ikkala refresh)');
    } finally {
      await room.cleanup();
    }
  });

  test('B4) BEMOR 3 marta ketma-ket refresh qiladi → har safar qayta ulanadi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      for (let i = 1; i <= 3; i++) {
        await room.reopenUt();
        await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, `shifokor (${i}-refreshdan keyin)`);
        await waitForRemoteVideo(room.utPage, RECONNECT_BUDGET_MS, `bemor (${i}-refreshdan keyin)`);
      }
    } finally {
      await room.cleanup();
    }
  });

  test('B5) Bemor refreshdan keyin ulanish BARQAROR qoladi (pir-pirlamaydi)', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.reopenUt();
      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'shifokor (refreshdan keyin)');

      // Qayta ulangandan keyin ham churn bo'lmasligi kerak.
      await room.mtPage.waitForTimeout(3000);
      const start = await snapshotPc(room.mtPage);
      await room.mtPage.waitForTimeout(15000);
      const end = await snapshotPc(room.mtPage);

      expect(end.liveRecvVideo, 'video oqishda davom etishi kerak').toBeGreaterThan(0);
      expect(
        end.totalCreated - start.totalCreated,
        `qayta ulangandan keyin ulanish qayta qurilmasligi kerak — ${end.totalCreated - start.totalCreated} marta qurildi`,
      ).toBe(0);
    } finally {
      await room.cleanup();
    }
  });

  // ─── C. QO'LDA TIKLASH ───────────────────────────────────────────────────
  test('C1) Bemor refreshdan keyin shifokor "Qayta ulash" tugmasini bossa — ishlaydi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.reopenUt();

      // Tugma faqat video uzilgan holatda chiqadi. Chiqsa — bosamiz; chiqmasa,
      // demak avtomatik tiklangan (bu ham to'g'ri natija).
      const reconnectBtn = room.mtPage.getByRole('button', { name: /Qayta ulash/i });
      if (await reconnectBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await reconnectBtn.click();
      }

      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'shifokor ("Qayta ulash" dan keyin)');
    } finally {
      await room.cleanup();
    }
  });

  // ─── D. TARMOQ UZILISHI ──────────────────────────────────────────────────
  test('D1) Bemor tarmog\'i uziladi va tiklanadi → video qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(3000);

      await room.utContext.setOffline(true);
      await room.utPage.waitForTimeout(6000); // uzilish sezilsin
      await room.utContext.setOffline(false);

      await waitForRemoteVideo(room.mtPage, 45000, 'shifokor (tarmoq tiklangandan keyin)');
      await waitForRemoteVideo(room.utPage, 45000, 'bemor (tarmoq tiklangandan keyin)');
    } finally {
      await room.cleanup();
    }
  });

  // ─── E. BARQARORLIK ──────────────────────────────────────────────────────
  test('E1) Video 25s davomida BARQAROR — pir-pirlamaydi va qayta qurilmaydi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      const start = await snapshotPc(room.mtPage);

      // 25s — ilovadagi qayta urinish sikllari (4.5s watchdog, 8s retry) bir necha marta
      // ishga tushishiga yetadi. Ular sog'lom ulanishga TEGMASLIGI kerak.
      for (let i = 0; i < 5; i++) {
        await room.mtPage.waitForTimeout(5000);
        const now = await snapshotPc(room.mtPage);
        expect(now.liveRecvVideo, `${(i + 1) * 5}s: video uzilmasligi kerak`).toBeGreaterThan(0);
        expect(now.connected, `${(i + 1) * 5}s: ulanish saqlanishi kerak`).toBeGreaterThan(0);
      }

      const end = await snapshotPc(room.mtPage);
      expect(
        end.totalCreated - start.totalCreated,
        `barqaror videoda ulanish qayta qurilmasligi kerak — ${end.totalCreated - start.totalCreated} marta qayta qurildi (pir-pirlash)`,
      ).toBe(0);
    } finally {
      await room.cleanup();
    }
  });

  // ─── F. CHIQIB-KIRISH ────────────────────────────────────────────────────
  test('F1) Bemor sahifani yopadi va qaytadi → shifokor qayta ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(3000);

      // Bemor butunlay chiqadi (sahifa yopiladi → socket uziladi)
      await room.utPage.goto('about:blank');
      await room.mtPage.waitForTimeout(4000);

      // Va qaytadi — yangi socketId bilan, qayta "Qo'shilish" bosadi
      await room.reopenUt();

      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'shifokor (bemor qaytgandan keyin)');
      await waitForRemoteVideo(room.utPage, RECONNECT_BUDGET_MS, 'bemor (qaytgandan keyin)');
    } finally {
      await room.cleanup();
    }
  });
});
