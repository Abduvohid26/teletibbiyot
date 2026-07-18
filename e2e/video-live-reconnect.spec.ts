import { test, expect } from '@playwright/test';
import {
  RECONNECT_BUDGET_MS,
  clickLobbyJoin,
  expectLobbyVisible,
  expectNoVideoErrorBanner,
  openLiveRoom,
  snapshotPc,
  waitForBothRemoteVideo,
  waitForRemoteVideo,
} from './helpers/video-live-room';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * JONLI VIDEO E2E — lobby orqali join, haqiqiy WebRTC (2 brauzer)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LOBBY MODELI: refresh / uzish → "Jonli efirga qo'shilish" → avto ulanish
 *
 * A  Ulanish tartibi     A1 mt-first · A2 ut-first · A3 lobby ko'rinishi
 * B  Lobby qayta kirish  B1–B8 refresh/reload/3x
 * C  Qo'lda tiklash      C1 Qayta ulash tugmasi
 * D  Tarmoq              D1 offline→online
 * E  Barqarorlik         E1 25s pir-pirlamaydi · E2 xato banner yo'q
 * F  Chiqib-kirish        F1 bemor · F2 shifokor
 * H  Uzish → lobby       H1 bemor · H2 shifokor · H3 bemor uzadi shifokor kutadi
 */

test.describe('Jonli video — lobby va qayta ulanish', () => {
  test.slow();

  // ─── A. ULANISH TARTIBI ──────────────────────────────────────────────────
  test('A1) Shifokor birinchi lobby join → bemor qo\'shiladi → video', async ({ browser }) => {
    const room = await openLiveRoom(browser, 'mt-first');
    try {
      const mt = await snapshotPc(room.mtPage);
      const ut = await snapshotPc(room.utPage);
      expect(mt.liveRecvVideo).toBeGreaterThan(0);
      expect(ut.liveRecvVideo).toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  test('A2) Bemor birinchi lobby join → shifokor qo\'shiladi → video', async ({ browser }) => {
    const room = await openLiveRoom(browser, 'ut-first');
    try {
      const mt = await snapshotPc(room.mtPage);
      const ut = await snapshotPc(room.utPage);
      expect(mt.liveRecvVideo).toBeGreaterThan(0);
      expect(ut.liveRecvVideo).toBeGreaterThan(0);
    } finally {
      await room.cleanup();
    }
  });

  test('A3) Join oldin ikkala tomonda lobby ko\'rinadi', async ({ browser }) => {
    const room = await openLiveRoom(browser, 'mt-first');
    try {
      await room.leaveUtViaUi();
      await room.leaveMtViaUi();
      await expectLobbyVisible(room.utPage, 'bemor');
      await expectLobbyVisible(room.mtPage, 'shifokor');
    } finally {
      await room.cleanup();
    }
  });

  // ─── B. LOBBY QAYTA KIRISH (goto / reload) ───────────────────────────────
  test('B1) Bemor lobby qayta kiradi — shifokor refreshsiz avto ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(4000);
      await room.reopenUt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'B1 ');
    } finally {
      await room.cleanup();
    }
  });

  test('B2) Shifokor lobby qayta kiradi — bemor refreshsiz avto ulanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(4000);
      await room.reopenMt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'B2 ');
    } finally {
      await room.cleanup();
    }
  });

  test('B3) Ikkalasi bir vaqtda lobby qayta kiradi → video', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await Promise.all([room.reopenUt(), room.reopenMt()]);
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'B3 ');
    } finally {
      await room.cleanup();
    }
  });

  test('B4) Bemor 3 marta ketma-ket lobby qayta kiradi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      for (let i = 1; i <= 3; i++) {
        await room.reopenUt();
        await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, `B4-${i} `);
      }
    } finally {
      await room.cleanup();
    }
  });

  test('B5) Bemor qayta ulangandan keyin barqaror (pir-pirlamaydi)', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.reopenUt();
      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'B5 shifokor');
      await room.mtPage.waitForTimeout(3000);
      const start = await snapshotPc(room.mtPage);
      await room.mtPage.waitForTimeout(15_000);
      const end = await snapshotPc(room.mtPage);
      expect(end.liveRecvVideo).toBeGreaterThan(0);
      expect(end.totalCreated - start.totalCreated).toBe(0);
    } finally {
      await room.cleanup();
    }
  });

  test('B6) Shifokor 3 marta ketma-ket lobby qayta kiradi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      for (let i = 1; i <= 3; i++) {
        await room.reopenMt();
        await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, `B6-${i} `);
      }
    } finally {
      await room.cleanup();
    }
  });

  test('B7) Bemor F5 reload + lobby join → avto ulanish', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(4000);
      await room.reloadUt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'B7 ');
    } finally {
      await room.cleanup();
    }
  });

  test('B8) Shifokor F5 reload + lobby join → avto ulanish', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(4000);
      await room.reloadMt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'B8 ');
    } finally {
      await room.cleanup();
    }
  });

  // ─── C. QO'LDA TIKLASH ───────────────────────────────────────────────────
  test('C1) Bemor qayta kirgandan keyin "Qayta ulash" (ixtiyoriy) ishlaydi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.reopenUt();
      const reconnectBtn = room.mtPage.getByRole('button', { name: /Qayta ulash/i });
      if (await reconnectBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await reconnectBtn.click();
      }
      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'C1 shifokor');
    } finally {
      await room.cleanup();
    }
  });

  // ─── D. TARMOQ ───────────────────────────────────────────────────────────
  test('D1) Bemor offline → online → lobby orqali video tiklanadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.utContext.setOffline(true);
      await room.utPage.waitForTimeout(6000);
      await room.utContext.setOffline(false);
      await room.reopenUt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, 45_000, 'D1 ');
    } finally {
      await room.cleanup();
    }
  });

  // ─── E. BARQARORLIK ──────────────────────────────────────────────────────
  test('E1) 25s davomida video barqaror — PC qayta qurilmaydi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      const start = await snapshotPc(room.mtPage);
      for (let i = 0; i < 5; i++) {
        await room.mtPage.waitForTimeout(5000);
        const now = await snapshotPc(room.mtPage);
        expect(now.liveRecvVideo).toBeGreaterThan(0);
        expect(now.connected).toBeGreaterThan(0);
      }
      const end = await snapshotPc(room.mtPage);
      expect(end.totalCreated - start.totalCreated).toBe(0);
    } finally {
      await room.cleanup();
    }
  });

  test('E2) Bemor 3x lobby qayta kirishda xato banner chiqmaydi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      for (let i = 0; i < 3; i++) {
        await room.reopenUt();
        await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, `E2-${i} shifokor`);
        await expectNoVideoErrorBanner(room.mtPage, 'shifokor');
      }
    } finally {
      await room.cleanup();
    }
  });

  // ─── F. CHIQIB-KIRISH ────────────────────────────────────────────────────
  test('F1) Bemor sahifani yopadi → lobby orqali qaytadi → shifokor avto ulanadi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.utPage.goto('about:blank');
      await room.mtPage.waitForTimeout(4000);
      await room.reopenUt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'F1 ');
    } finally {
      await room.cleanup();
    }
  });

  test('F2) Shifokor sahifani yopadi → lobby orqali qaytadi → bemor avto ulanadi', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.goto('about:blank');
      await room.utPage.waitForTimeout(4000);
      await room.reopenMt();
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'F2 ');
    } finally {
      await room.cleanup();
    }
  });

  // ─── H. UZISH → LOBBY → QAYTA JOIN ───────────────────────────────────────
  test('H1) Bemor Uzish → lobby → qayta join → ikkala tomonda video', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.leaveUtViaUi();
      await clickLobbyJoin(room.utPage, 'H1 bemor');
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'H1 ');
    } finally {
      await room.cleanup();
    }
  });

  test('H2) Shifokor Uzish → lobby → qayta join → ikkala tomonda video', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.leaveMtViaUi();
      await clickLobbyJoin(room.mtPage, 'H2 shifokor');
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'H2 ');
    } finally {
      await room.cleanup();
    }
  });

  test('H3) Bemor Uzish — shifokor kutadi — bemor lobby join → avto ulanish', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.leaveUtViaUi();
      await room.mtPage.waitForTimeout(3000);
      await clickLobbyJoin(room.utPage, 'H3 bemor');
      await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'H3 shifokor (refreshsiz)');
      await waitForRemoteVideo(room.utPage, RECONNECT_BUDGET_MS, 'H3 bemor');
    } finally {
      await room.cleanup();
    }
  });
});