import { test, expect, type Browser, type Page } from '@playwright/test';
import { loginAs } from './helpers/login';
import {
  PASSWORD,
  prepareVideoConsultation,
  seedDoctorMediaPrefs,
  seedUtSession,
} from './helpers/video-setup';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TURN RELAY E2E — media AYNAN TURN orqali o'tishini tekshiradi
 * ═══════════════════════════════════════════════════════════════════════════
 * Oddiy localhost testlari TURN'ni chetlab o'tadi (to'g'ridan-to'g'ri ulanadi),
 * shuning uchun "qora ekran" (TURN ishlamasligi) bug'ini ushlay olmaydi.
 *
 * Bu yerda brauzer `iceTransportPolicy: 'relay'` ga MAJBURLANADI — ya'ni faqat
 * TURN relay candidate'lari ishlatiladi. Agar video oqsa — demak TURN relay
 * chindan ishlayapti. Agar TURN buzuq bo'lsa — ulanish yiqiladi (production'dagi
 * aynan o'sha holat) va biz buni tekshiramiz.
 *
 * Talab: lokal coturn 127.0.0.1:3478 da ishlab turishi kerak. Test o'zi
 * ishlatadigan TURN'ni ice-config fetch'ini patch qilib beradi (app env'iga
 * bog'liq emas).
 */

const TURN_HOST = process.env.E2E_TURN_HOST || '127.0.0.1';
const TURN_PORT = process.env.E2E_TURN_PORT || '3478';
const TURN_USER = process.env.E2E_TURN_USER || 'test';
const TURN_PASS = process.env.E2E_TURN_PASS || 'test123';

interface TurnPatch {
  /** Brauzerga beriladigan TURN URL (buzuq holatni sinash uchun o'zgartirsa bo'ladi) */
  turnUrl?: string;
  username?: string;
  credential?: string;
  /** true bo'lsa faqat TURN relay ishlatiladi (to'g'ridan-to'g'ri ulanish taqiqlanadi) */
  forceRelay?: boolean;
}

/**
 * ice-config fetch'ini berilgan TURN'ga yo'naltiradi va (forceRelay bo'lsa)
 * RTCPeerConnection'ni relay-only rejimga majburlaydi.
 */
async function patchTurnRelay(page: Page, patch: TurnPatch) {
  const turnUrl = patch.turnUrl ?? `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`;
  const username = patch.username ?? TURN_USER;
  const credential = patch.credential ?? TURN_PASS;
  const forceRelay = patch.forceRelay ?? true;

  await page.addInitScript(
    ({ turnUrl, username, credential, forceRelay }) => {
      // 1) ice-config fetch → bizning TURN
      const origFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/video/ice-config')) {
          return new Response(
            JSON.stringify({
              iceServers: [{ urls: [turnUrl], username, credential }],
              turnConfigured: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return origFetch(input, init);
      };

      // 2) RTCPeerConnection → relay-only (faqat TURN candidate'lari)
      if (forceRelay) {
        const Orig = window.RTCPeerConnection;
        const Patched = function (this: unknown, cfg?: RTCConfiguration) {
          const merged: RTCConfiguration = {
            ...(cfg ?? {}),
            iceTransportPolicy: 'relay',
            iceServers: [{ urls: [turnUrl], username, credential }],
          };
          const pc = new Orig(merged);
          const w = window as unknown as { __pcs: RTCPeerConnection[] };
          (w.__pcs = w.__pcs ?? []).push(pc);
          return pc;
        } as unknown as typeof RTCPeerConnection;
        Patched.prototype = Orig.prototype;
        window.RTCPeerConnection = Patched;
      }
    },
    { turnUrl, username, credential, forceRelay },
  );
}

async function hasLiveRemoteVideo(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __pcs?: RTCPeerConnection[] };
    return (w.__pcs ?? []).some(
      (pc) =>
        pc.connectionState === 'connected'
        && pc.getReceivers().some((r) => r.track?.kind === 'video' && r.track.readyState === 'live'),
    );
  });
}

async function waitForRelayVideo(page: Page, timeoutMs: number, label: string) {
  await page
    .waitForFunction(
      () => {
        const w = window as unknown as { __pcs?: RTCPeerConnection[] };
        return (w.__pcs ?? []).some(
          (pc) =>
            pc.connectionState === 'connected'
            && pc.getReceivers().some((r) => r.track?.kind === 'video' && r.track.readyState === 'live'),
        );
      },
      { timeout: timeoutMs },
    )
    .catch(() => {
      throw new Error(`${label}: ${timeoutMs / 1000}s ichida TURN relay orqali video kelmadi`);
    });
}

async function clickJoin(page: Page, label: string) {
  const btn = page.getByRole('button', { name: /Jonli efirga qo'shilish/i });
  await btn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
    throw new Error(`${label}: "Jonli efirga qo'shilish" tugmasi chiqmadi`);
  });
  await btn.click();
}

async function setupRoom(browser: Browser, patch: TurnPatch) {
  const { consultation, mt } = await prepareVideoConsultation();
  const utCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const mtCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const utPage = await utCtx.newPage();
  const mtPage = await mtCtx.newPage();

  await patchTurnRelay(utPage, patch);
  await patchTurnRelay(mtPage, patch);
  await seedUtSession(utPage, consultation.id);
  await seedDoctorMediaPrefs(mtPage);

  await loginAs(utPage, 'operator@ishifo.uz', PASSWORD, /\/ut/);
  await loginAs(mtPage, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
  await mt.startConsultation(consultation.id);

  await mtPage.goto('/dashboard');
  await clickJoin(mtPage, 'shifokor');
  await utPage.goto('/ut/vitals');
  await clickJoin(utPage, 'bemor');

  return {
    utPage,
    mtPage,
    cleanup: async () => {
      await utCtx.close().catch(() => undefined);
      await mtCtx.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    },
  };
}

test.describe('TURN relay — media aynan TURN orqali oqishi', () => {
  test.slow();

  // Bu testlar BRAUZER YETA OLADIGAN, relay qila oladigan haqiqiy TURN talab qiladi.
  // Lokal coturn sukut bo'yicha loopback/LAN peer'larga relay qilishni taqiqlaydi
  // (403 Forbidden IP), shuning uchun opt-in:
  //   E2E_TURN_RELAY=1 E2E_TURN_HOST=<ip> E2E_TURN_USER=<u> E2E_TURN_PASS=<p> npx playwright test e2e/video-turn-relay.spec.ts
  test.skip(
    !process.env.E2E_TURN_RELAY,
    'Haqiqiy TURN kerak — E2E_TURN_RELAY=1 va E2E_TURN_* sozlamalari bilan ishga tushiring',
  );

  test('T1) ISHLAYDIGAN TURN: relay-only rejimda video oqadi', async ({ browser }) => {
    const room = await setupRoom(browser, { forceRelay: true });
    try {
      // relay-only bo'lgani uchun, video kelsa — u FAQAT TURN orqali kelgan.
      await waitForRelayVideo(room.mtPage, 45000, 'shifokor (TURN relay)');
      await waitForRelayVideo(room.utPage, 45000, 'bemor (TURN relay)');

      expect(await hasLiveRemoteVideo(room.mtPage)).toBe(true);
      expect(await hasLiveRemoteVideo(room.utPage)).toBe(true);
    } finally {
      await room.cleanup();
    }
  });

  test('T2) BUZUQ TURN: relay-only da ulanmaydi va foydalanuvchiga XATO ko\'rsatiladi (qora ekran emas)', async ({
    browser,
  }) => {
    // Erishib bo'lmaydigan TURN (yopiq port) → relay-only → ICE yiqiladi.
    const room = await setupRoom(browser, {
      forceRelay: true,
      turnUrl: 'turn:127.0.0.1:59999?transport=udp',
      username: 'nobody',
      credential: 'wrong',
    });
    try {
      // Video KELMASLIGI kerak (TURN ishlamaydi).
      await room.mtPage.waitForTimeout(20000);
      expect(await hasLiveRemoteVideo(room.mtPage), 'buzuq TURN bilan video oqmasligi kerak').toBe(false);

      // Eng muhimi: qora ekran o'rniga foydalanuvchiga SABAB ko'rsatilishi kerak.
      await expect(
        room.mtPage.getByText(/Video ulanib bo'lmadi/i).first(),
      ).toBeVisible({ timeout: 30000 });
    } finally {
      await room.cleanup();
    }
  });
});
