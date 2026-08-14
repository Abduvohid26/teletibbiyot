import { test, expect } from '@playwright/test';
import {
  clickLobbyJoin,
  expectLobbyVisible,
  installPcProbe,
  openLiveRoom,
  waitForBothRemoteVideo,
  waitForRemoteVideo,
  RECONNECT_BUDGET_MS,
  snapshotPc,
} from './helpers/video-live-room';
import { ApiTestClient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import {
  PASSWORD,
  seedUtSession,
  patchIceConfigFetch,
} from './helpers/video-setup';

/**
 * Meet-uslubidagi video xona — TZ edge-case smoke.
 * Asosiy suite: video-live-reconnect.spec.ts
 */
test.describe('Meet video room TZ', () => {
  test.slow();

  test('M1) WaitingPeer — doctor join, UT yo\'q → presence matn (qora emas)', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser, 'mt-first');
    try {
      await room.leaveUtViaUi();
      await room.mtPage.waitForTimeout(2000);
      await expect(
        room.mtPage.getByText(/Siz xonadasiz|Sherik kutilmoqda|UT operator kutilmoqda/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      // Qora ekran o'rniga aniq matn — "Jonli efir" tugmasi doctor tomonda yo'q (u xonada)
      await expect(
        room.mtPage.getByRole('button', { name: /Jonli efirga qo'shilish/i }),
      ).toHaveCount(0);
    } finally {
      await room.cleanup();
    }
  });

  test('M2) F5 auto-rejoin — lobby tugmasi chiqmasdan video qaytadi', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.mtPage.waitForTimeout(3000);
      await room.utPage.reload();
      // Auto-rejoin: lobby yo'q yoki juda qisqa
      await room.utPage.waitForTimeout(2000);
      const lobbyVisible = await room.utPage
        .getByRole('button', { name: /Jonli efirga qo'shilish/i })
        .isVisible()
        .catch(() => false);
      expect(lobbyVisible, 'Refreshdan keyin lobby chiqmasligi kerak (auto-rejoin)').toBe(false);
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'M2 ');
    } finally {
      await room.cleanup();
    }
  });

  test('M3) Leave → waiting peer → qayta Join → live', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      await room.leaveUtViaUi();
      await expectLobbyVisible(room.utPage, 'bemor');
      await expect(
        room.mtPage.getByText(/Siz xonadasiz|Sherik kutilmoqda|UT operator kutilmoqda/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await clickLobbyJoin(room.utPage, 'M3');
      await waitForBothRemoteVideo(room.mtPage, room.utPage, RECONNECT_BUDGET_MS, 'M3 ');
    } finally {
      await room.cleanup();
    }
  });

  test('M4) Ikkinchi sessiya — eski tab superseded/lobby, yangi sessiya video', async ({
    browser,
  }) => {
    const room = await openLiveRoom(browser);
    try {
      // Alohida context = boshqa oyna/qurilma (sessionStorage umumiy emas)
      const ctx2 = await browser.newContext({ permissions: ['camera', 'microphone'] });
      const tab2 = await ctx2.newPage();
      try {
        await installPcProbe(tab2);
        await seedUtSession(tab2, room.consultationId);
        await patchIceConfigFetch(tab2);
        await loginAs(tab2, 'operator@ishifo.uz', PASSWORD, /\/ut/);
        await tab2.goto('/ut/vitals');
        await clickLobbyJoin(tab2, 'M4 yangi sessiya');

        // Eski tab tezda chiqishi kerak
        await expect(
          room.utPage
            .getByRole('button', { name: /Jonli efirga qo'shilish/i })
            .or(room.utPage.getByText(/boshqa oyna|qurilmada ochildi|to'xtatildi/i)),
        ).toBeVisible({ timeout: 20_000 });

        await waitForRemoteVideo(tab2, RECONNECT_BUDGET_MS, 'M4 yangi sessiya video');
        await waitForRemoteVideo(room.mtPage, RECONNECT_BUDGET_MS, 'M4 shifokor yangi peer');
      } finally {
        await ctx2.close().catch(() => undefined);
      }
    } finally {
      await room.cleanup();
    }
  });

  test('M5) Konsultatsiya yakunlash → room_closed', async ({ browser }) => {
    const room = await openLiveRoom(browser);
    try {
      const mt = new ApiTestClient();
      await mt.login('doctor@ishifo.uz', PASSWORD);
      await mt.completeActiveConsultationIfAny();
      await expect(
        room.mtPage.getByText(/Konsultatsiya yakunlandi|Video xona yopildi/i).first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        room.utPage.getByText(/Konsultatsiya yakunlandi|Video xona yopildi/i).first(),
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      await room.cleanup();
    }
  });

  test('M6) A1+A2 smoke — mt-first va ut-first video live', async ({ browser }) => {
    for (const order of ['mt-first', 'ut-first'] as const) {
      const room = await openLiveRoom(browser, order);
      try {
        const mt = await snapshotPc(room.mtPage);
        const ut = await snapshotPc(room.utPage);
        expect(mt.liveRecvVideo, `${order} mt`).toBeGreaterThan(0);
        expect(ut.liveRecvVideo, `${order} ut`).toBeGreaterThan(0);
      } finally {
        await room.cleanup();
      }
    }
  });
});
