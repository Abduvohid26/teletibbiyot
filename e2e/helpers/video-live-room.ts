import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { loginAs } from './login';
import {
  PASSWORD,
  prepareVideoConsultation,
  patchIceConfigFetch,
  seedDoctorMediaPrefs,
  seedUtSession,
} from './video-setup';

/** Lobby orqali qayta ulanish — 30s ichida bo'lishi kerak. */
export const RECONNECT_BUDGET_MS = 30_000;
export const FIRST_CONNECT_BUDGET_MS = 45_000;

export interface PcSnapshot {
  pcCount: number;
  totalCreated: number;
  connected: number;
  liveRecvVideo: number;
}

export interface LiveRoom {
  utContext: BrowserContext;
  mtContext: BrowserContext;
  utPage: Page;
  mtPage: Page;
  consultationId: string;
  /** Sahifaga qaytish + lobby "Qo'shilish" */
  reopenUt: () => Promise<void>;
  reopenMt: () => Promise<void>;
  /** Haqiqiy F5 reload + lobby "Qo'shilish" */
  reloadUt: () => Promise<void>;
  reloadMt: () => Promise<void>;
  /** Uzish → lobby */
  leaveUtViaUi: () => Promise<void>;
  leaveMtViaUi: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export async function installPcProbe(page: Page) {
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

export async function snapshotPc(page: Page): Promise<PcSnapshot> {
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

export async function waitForRemoteVideo(
  page: Page,
  timeoutMs = FIRST_CONNECT_BUDGET_MS,
  label = 'video',
) {
  await page
    .waitForFunction(
      () => {
        const w = window as unknown as { __pcs?: RTCPeerConnection[] };
        return (w.__pcs ?? []).some(
          (pc) =>
            pc.connectionState === 'connected'
            && pc.getReceivers().some(
              (r) => r.track?.kind === 'video' && r.track.readyState === 'live',
            ),
        );
      },
      { timeout: timeoutMs },
    )
    .catch(() => {
      throw new Error(`${label}: ${timeoutMs / 1000}s ichida jonli video kelmadi`);
    });
}

export async function waitForBothRemoteVideo(
  mtPage: Page,
  utPage: Page,
  timeoutMs = RECONNECT_BUDGET_MS,
  labelPrefix = '',
) {
  await waitForRemoteVideo(mtPage, timeoutMs, `${labelPrefix}shifokor`.trim());
  await waitForRemoteVideo(utPage, timeoutMs, `${labelPrefix}bemor`.trim());
}

export async function expectLobbyVisible(page: Page, who: string) {
  const btn = page.getByRole('button', { name: /Jonli efirga qo'shilish/i });
  await expect(btn, `${who}: lobby ko'rinishi kerak`).toBeVisible({ timeout: 15_000 });
}

export async function clickLobbyJoin(page: Page, label = 'efir') {
  const btn = page.getByRole('button', { name: /Jonli efirga qo'shilish/i });
  await btn.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {
    throw new Error(`${label}: "Jonli efirga qo'shilish" tugmasi chiqmadi`);
  });
  await btn.click();
}

export async function expectNoVideoErrorBanner(page: Page, who: string) {
  const err = page.getByText(/Video javob qabul qilishda xatolik/i);
  await expect(err, `${who}: xato banner bo'lmasligi kerak`).toHaveCount(0);
}

async function newVideoContext(browser: Browser) {
  return browser.newContext({ permissions: ['camera', 'microphone'] });
}

export type JoinOrder = 'mt-first' | 'ut-first';

/**
 * Jonli video sessiya: ikkala tomonda lobby orqali join.
 * Refresh/reload = lobby → qayta "Jonli efirga qo'shilish".
 */
export async function openLiveRoom(
  browser: Browser,
  joinOrder: JoinOrder = 'mt-first',
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
    await clickLobbyJoin(mtPage, 'shifokor');
    await mtPage.waitForTimeout(2500);
    await utPage.goto('/ut/vitals');
    await clickLobbyJoin(utPage, 'bemor');
  } else {
    await utPage.goto('/ut/vitals');
    await clickLobbyJoin(utPage, 'bemor');
    await utPage.waitForTimeout(2500);
    await mtPage.goto('/dashboard');
    await clickLobbyJoin(mtPage, 'shifokor');
  }

  await waitForBothRemoteVideo(mtPage, utPage, FIRST_CONNECT_BUDGET_MS, 'dastlabki ');

  const reopenUt = async () => {
    await utPage.goto('/ut/vitals');
    await clickLobbyJoin(utPage, 'bemor (qayta)');
  };

  const reopenMt = async () => {
    await mtPage.goto('/dashboard');
    await clickLobbyJoin(mtPage, 'shifokor (qayta)');
  };

  const reloadUt = async () => {
    await utPage.reload();
    await clickLobbyJoin(utPage, 'bemor (reload)');
  };

  const reloadMt = async () => {
    await mtPage.reload();
    await clickLobbyJoin(mtPage, 'shifokor (reload)');
  };

  const leaveUtViaUi = async () => {
    await utPage.getByRole('button', { name: /^Uzish$/i }).click();
    await expectLobbyVisible(utPage, 'bemor');
  };

  const leaveMtViaUi = async () => {
    const btn = mtPage.getByRole('button', { name: /Video uzish|^Uzish$/i });
    await btn.first().click();
    await expectLobbyVisible(mtPage, 'shifokor');
  };

  return {
    utContext,
    mtContext,
    utPage,
    mtPage,
    consultationId: consultation.id,
    reopenUt,
    reopenMt,
    reloadUt,
    reloadMt,
    leaveUtViaUi,
    leaveMtViaUi,
    cleanup: async () => {
      await utContext.close().catch(() => undefined);
      await mtContext.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    },
  };
}
