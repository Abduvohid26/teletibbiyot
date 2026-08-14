import type { Page } from '@playwright/test';
import {
  ApiTestClient,
  buildTestConsultation,
  buildTestPatient,
} from './api-client';

export const PASSWORD = process.env.SEED_PASSWORD || 'password123';
export const UT_ACTIVE_CONSULTATION_KEY = 'ishifo_ut_active_consultation';
export const MEDIA_PREFS_KEY = 'ishifo-media-preferences';

export interface VideoConsultationFixture {
  ut: ApiTestClient;
  mt: ApiTestClient;
  patient: { id: string };
  consultation: { id: string; status: string };
}

/** Create patient + consultation; optionally start as IN_PROGRESS on doctor side. */
export async function prepareVideoConsultation(options?: {
  start?: boolean;
}): Promise<VideoConsultationFixture> {
  const ut = new ApiTestClient();
  const mt = new ApiTestClient();

  await ut.login('operator@ishifo.uz', PASSWORD);
  const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);
  await mt.completeActiveConsultationIfAny();

  const doctorId = mtLogin.user?.id;
  if (!doctorId) throw new Error('Doctor id topilmadi');

  const patient = await ut.createPatient(buildTestPatient());
  const consultation = await ut.createConsultation(buildTestConsultation(patient.id, doctorId));

  if (options?.start) {
    await mt.startConsultation(consultation.id);
  }

  return { ut, mt, patient, consultation };
}

/** UT vitals page picks active session from sessionStorage. */
export async function seedUtSession(page: Page, consultationId: string) {
  await page.addInitScript(
    ({ key, id, mediaKey }) => {
      sessionStorage.setItem(key, id);
      localStorage.setItem(
        mediaKey,
        JSON.stringify({
          qualityPreset: 'standard',
          videoDeviceId: '',
          audioDeviceId: '',
          utCameraMapping: {},
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          preflightEnabled: false,
        }),
      );
    },
    {
      key: UT_ACTIVE_CONSULTATION_KEY,
      id: consultationId,
      mediaKey: MEDIA_PREFS_KEY,
    },
  );
}

export async function seedDoctorMediaPrefs(page: Page) {
  await page.addInitScript((mediaKey) => {
    localStorage.setItem(
      mediaKey,
      JSON.stringify({
        qualityPreset: 'standard',
        videoDeviceId: '',
        audioDeviceId: '',
        utCameraMapping: {},
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        preflightEnabled: false,
      }),
    );
  }, MEDIA_PREFS_KEY);
}

/** At least one <video> element has decoded frames (WebRTC connected). */
export async function waitForPlayingVideo(page: Page, timeoutMs = 45000) {
  await page.waitForFunction(
    () => {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos.some((v) => v.videoWidth > 0 && v.readyState >= 2);
    },
    { timeout: timeoutMs },
  );
}

const STUN_ONLY_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  turnConfigured: false,
};

/** Docker TURN hostnames are unreachable from host browser — force STUN-only ICE in the app. */
export async function patchIceConfigFetch(...pages: Page[]) {
  for (const page of pages) {
    await page.addInitScript((payload) => {
      const origFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/video/ice-config')) {
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return origFetch(input, init);
      };
    }, STUN_ONLY_ICE);
  }
}

/** Playwright route fallback (kept for API-level tests). */
export async function stubStunOnlyIceConfig(...pages: Page[]) {
  for (const page of pages) {
    await page.route(/ice-config/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STUN_ONLY_ICE),
      });
    });
  }
}
