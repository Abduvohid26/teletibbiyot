import { test, expect, type Browser, type Page } from '@playwright/test';
import { RoomServiceClient } from 'livekit-server-sdk';
import { ApiTestClient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import {
  clickLobbyJoin,
  installPcProbe,
  joinOrAutoRejoin,
  FIRST_CONNECT_BUDGET_MS,
  RECONNECT_BUDGET_MS,
} from './helpers/video-live-room';
import {
  PASSWORD,
  patchIceConfigFetch,
  prepareVideoConsultation,
  seedDoctorMediaPrefs,
  seedUtSession,
} from './helpers/video-setup';

/**
 * Konsilium — Meet uslubida 3 tomonlama qo'ng'iroq:
 * UT operator + mas'ul shifokor + konsiliumga qo'shilgan shifokor.
 * Har bir ishtirokchi qolgan IKKALASINI ko'rishi va eshitishi shart.
 */
const CONSULTANT_EMAIL = process.env.E2E_CONSULTANT_EMAIL || 'doctor2@ishifo.uz';
/**
 * LiveKit (SFU) rejimi: har klientda 2 ta PC (publish + subscribe), barcha
 * uzoq oqimlar BITTA subscriber PC orqali keladi — shuning uchun peer emas,
 * oqimlar sanaladi. API `E2E_LIVEKIT=true` bilan ishga tushirilgan bo'lishi kerak.
 */
const SFU = process.env.E2E_LIVEKIT === 'true';

interface MediaProbe {
  connectedPcs: number;
  /** Video kadri haqiqatan kelayotgan peer'lar soni */
  peersWithVideo: number;
  /** Audio paketi haqiqatan kelayotgan peer'lar soni */
  peersWithAudio: number;
  /** Har bir ulangan peer: [dekodlangan video oqimlar, audio oqimlar] */
  perPeer: Array<[number, number]>;
  /** Barcha PC'lar bo'yicha kadr kelayotgan video / paket kelayotgan audio oqimlar */
  videoStreams: number;
  audioStreams: number;
  playingVideos: number;
  /** Shu sahifada umuman yaratilgan PeerConnection'lar (qayta qurish = churn) */
  totalCreated: number;
  /** Ekranda ijro etilayotgan (mute qilinmagan) begona audio track'lar soni */
  audibleRemoteTracks: number;
  /** Ekranda kadr chizayotgan begona video oqimlar soni */
  visibleRemoteVideos: number;
}

/**
 * Receiver track'i "live" bo'lishi media KELAYOTGANINI bildirmaydi (recvonly
 * transceiver ham live track beradi). Shuning uchun getStats bilan haqiqatan
 * kadr dekodlangan / audio paket kelgan oqimlarni sanaymiz.
 */
async function probe(page: Page): Promise<MediaProbe> {
  return page.evaluate(async () => {
    const w = window as unknown as { __pcs?: RTCPeerConnection[] };
    const open = (w.__pcs ?? []).filter((pc) => pc.connectionState === 'connected');
    const perPeer: Array<[number, number]> = [];
    for (const pc of open) {
      let v = 0;
      let a = 0;
      const stats = await pc.getStats();
      stats.forEach((s) => {
        if (s.type !== 'inbound-rtp') return;
        if (s.kind === 'video' && (s.framesDecoded ?? 0) > 0) v += 1;
        if (s.kind === 'audio' && (s.packetsReceived ?? 0) > 0) a += 1;
      });
      perPeer.push([v, a]);
    }
    const playingVideos = Array.from(document.querySelectorAll('video')).filter(
      (v) => v.videoWidth > 0 && v.readyState >= 2 && !!v.srcObject,
    ).length;
    // Qabul qilingan track id'lari — o'zimizning kamera/mikrofonni ajratish uchun
    const remoteIds = new Set<string>();
    open.forEach((pc) => pc.getReceivers().forEach((r) => r.track && remoteIds.add(r.track.id)));
    const audible = new Set<string>();
    const visible = new Set<string>();
    document.querySelectorAll('audio, video').forEach((el) => {
      const m = el as HTMLMediaElement;
      const src = m.srcObject as MediaStream | null;
      if (!src) return;
      if (!m.muted && !m.paused) {
        src.getAudioTracks().forEach((t) => {
          if (t.readyState === 'live' && remoteIds.has(t.id)) audible.add(t.id);
        });
      }
      if (m instanceof HTMLVideoElement && m.videoWidth > 0) {
        src.getVideoTracks().forEach((t) => {
          if (t.readyState === 'live' && remoteIds.has(t.id)) visible.add(t.id);
        });
      }
    });
    return {
      connectedPcs: open.length,
      peersWithVideo: perPeer.filter(([v]) => v > 0).length,
      peersWithAudio: perPeer.filter(([, a]) => a > 0).length,
      perPeer,
      playingVideos,
      totalCreated: (w.__pcs ?? []).length,
      videoStreams: perPeer.reduce((n, [v]) => n + v, 0),
      audioStreams: perPeer.reduce((n, [, a]) => n + a, 0),
      audibleRemoteTracks: audible.size,
      visibleRemoteVideos: visible.size,
    };
  });
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();
  await installPcProbe(page);
  await patchIceConfigFetch(page);
  return { ctx, page };
}

type Who = 'ut' | 'lead' | 'consultant';
const ALL: Who[] = ['ut', 'lead', 'consultant'];

interface Konsilium {
  pages: Record<Who, Page>;
  consultationId: string;
  mt: ApiTestClient;
  consultantId: string;
  join: (who: Who) => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * "Itoatsiz klient": serverdan kelgan `room-closed` xabarini tashlab yuboradi,
 * ya'ni o'zi xonadan chiqmaydi. Shunda chiqarishni faqat server bajara oladi.
 */
async function ignoreRoomClosed(page: Page) {
  await page.addInitScript(() => {
    const Orig = window.WebSocket;
    class Filtered extends Orig {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('message', (e) => {
          if (typeof e.data === 'string' && e.data.includes('"room-closed"')) {
            e.stopImmediatePropagation();
          }
        });
      }
    }
    window.WebSocket = Filtered as typeof WebSocket;
  });
}

/** Brauzerlarni tayyorlaydi; kim qachon qo'shilishini test o'zi hal qiladi */
async function prepareKonsilium(
  browser: Browser,
  opts: { ignoreRoomClosed?: Who } = {},
): Promise<Konsilium> {
  const { consultation, mt } = await prepareVideoConsultation();
  const consultant = new ApiTestClient();
  const cLogin = await consultant.login(CONSULTANT_EMAIL, PASSWORD);
  const consultantId = cLogin.user!.id;

  const ut = await newPage(browser);
  const lead = await newPage(browser);
  const cons = await newPage(browser);
  await seedUtSession(ut.page, consultation.id);
  await seedDoctorMediaPrefs(lead.page);
  await seedDoctorMediaPrefs(cons.page);
  if (opts.ignoreRoomClosed) {
    await ignoreRoomClosed({ ut: ut.page, lead: lead.page, consultant: cons.page }[opts.ignoreRoomClosed]);
  }

  await mt.startConsultation(consultation.id);
  await mt.post(`/consultations/${consultation.id}/participants`, { doctorIds: [consultantId] });

  await loginAs(ut.page, 'operator@ishifo.uz', PASSWORD, /\/ut/);
  await loginAs(lead.page, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);
  await loginAs(cons.page, CONSULTANT_EMAIL, PASSWORD, /\/dashboard/);

  const pages = { ut: ut.page, lead: lead.page, consultant: cons.page };
  const join = async (who: Who) => {
    if (who === 'ut') {
      await ut.page.goto('/ut/vitals');
      await clickLobbyJoin(ut.page, 'UT');
    } else if (who === 'lead') {
      await lead.page.goto('/dashboard');
      await clickLobbyJoin(lead.page, 'mas\'ul shifokor');
    } else {
      // Real yo'l: "Bemorlar" ro'yxatida "Ulash"
      await cons.page.goto('/dashboard/patients');
      await cons.page.getByRole('button', { name: /^Ulash$/ }).first().click();
      await clickLobbyJoin(cons.page, 'konsilium shifokori');
    }
  };

  return {
    pages,
    consultationId: consultation.id,
    mt,
    consultantId,
    join,
    cleanup: async () => {
      await ut.ctx.close().catch(() => undefined);
      await lead.ctx.close().catch(() => undefined);
      await cons.ctx.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    },
  };
}

async function snapshot(k: Konsilium, who: Who[] = ALL) {
  const out = {} as Record<Who, MediaProbe>;
  for (const w of who) out[w] = await probe(k.pages[w]);
  return out;
}

const netVideo = (p: MediaProbe) => (SFU ? p.videoStreams : p.peersWithVideo);
const netAudio = (p: MediaProbe) => (SFU ? p.audioStreams : p.peersWithAudio);

const fullyMeshed = (p: MediaProbe, peers: number) =>
  netVideo(p) >= peers
  && netAudio(p) >= peers
  && p.visibleRemoteVideos >= peers
  && p.audibleRemoteTracks >= peers;

/** Har bir ishtirokchi `peers` ta boshqasini ko'rib-eshitguncha kutadi */
async function expectMesh(k: Konsilium, label: string, who: Who[] = ALL, budgetMs = FIRST_CONNECT_BUDGET_MS) {
  const peers = who.length - 1;
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;
  let snap = await snapshot(k, who);
  while (Date.now() < deadline && !who.every((w) => fullyMeshed(snap[w], peers))) {
    await k.pages.ut.waitForTimeout(1500);
    snap = await snapshot(k, who);
  }
  console.log(`[${label}] ${((Date.now() - startedAt) / 1000).toFixed(1)}s`, JSON.stringify(snap));
  for (const w of who) {
    expect(netVideo(snap[w]), `${label} — ${w}: ${peers} tomondan video`).toBeGreaterThanOrEqual(peers);
    expect(netAudio(snap[w]), `${label} — ${w}: ${peers} tomondan ovoz`).toBeGreaterThanOrEqual(peers);
    expect(snap[w].visibleRemoteVideos, `${label} — ${w}: ekranda ${peers} video`).toBeGreaterThanOrEqual(peers);
    expect(snap[w].audibleRemoteTracks, `${label} — ${w}: ${peers} ovoz eshitiladi`).toBeGreaterThanOrEqual(peers);
  }
  return snap;
}

test.describe('Konsilium video (3 tomon)', () => {
  test.slow();

  test('K1) UT + mas\'ul + konsilium shifokori — hamma hammani ko\'radi va eshitadi', async ({ browser }) => {
    const k = await prepareKonsilium(browser);
    try {
      await k.join('lead');
      await k.join('ut');
      await k.join('consultant');
      await expectMesh(k, 'K1');
    } finally {
      await k.cleanup();
    }
  });

  test('K2) Teskari tartib — avval konsilium shifokori, keyin UT, oxirida mas\'ul', async ({ browser }) => {
    const k = await prepareKonsilium(browser);
    try {
      await k.join('consultant');
      await k.join('ut');
      await k.join('lead');
      await expectMesh(k, 'K2');
    } finally {
      await k.cleanup();
    }
  });

  test('K3) Barqarorlik — 30s davomida hech kim uzilmaydi, ulanish qayta qurilmaydi', async ({ browser }) => {
    const k = await prepareKonsilium(browser);
    try {
      await k.join('lead');
      await k.join('ut');
      await k.join('consultant');
      const base = await expectMesh(k, 'K3 boshi');
      for (let i = 0; i < 10; i++) {
        await k.pages.ut.waitForTimeout(3000);
        const snap = await snapshot(k);
        for (const w of ALL) {
          expect(fullyMeshed(snap[w], 2), `K3 ${i * 3 + 3}s — ${w} uzildi: ${JSON.stringify(snap[w])}`).toBe(true);
          expect(snap[w].totalCreated, `K3 — ${w}: PeerConnection qayta qurildi (pir-pirlash)`).toBe(
            base[w].totalCreated,
          );
        }
      }
    } finally {
      await k.cleanup();
    }
  });

  for (const who of ALL) {
    test(`K4) ${who} F5 qiladi — ${RECONNECT_BUDGET_MS / 1000}s ichida hamma qayta ulanadi`, async ({ browser }) => {
      const k = await prepareKonsilium(browser);
      try {
        await k.join('lead');
        await k.join('ut');
        await k.join('consultant');
        await expectMesh(k, `K4 ${who} oldin`);

        await k.pages[who].reload();
        await joinOrAutoRejoin(k.pages[who], `${who} (reload)`);

        // Qolgan ikkalasi o'zaro uzilmasligi kerak
        const others = ALL.filter((w) => w !== who);
        const during = await snapshot(k, others);
        for (const w of others) {
          expect(netVideo(during[w]), `K4 — ${who} refresh paytida ${w} sherigini yo'qotdi`).toBeGreaterThanOrEqual(1);
        }

        await expectMesh(k, `K4 ${who} keyin`, ALL, RECONNECT_BUDGET_MS);
      } finally {
        await k.cleanup();
      }
    });
  }

  test('K5) Konsilium shifokori "Uzish" → qolganlar ulanishda, qayta qo\'shilsa — to\'liq', async ({ browser }) => {
    const k = await prepareKonsilium(browser);
    try {
      await k.join('lead');
      await k.join('ut');
      await k.join('consultant');
      await expectMesh(k, 'K5 boshi');

      const c = k.pages.consultant;
      await c.getByRole('button', { name: /Video uzish|^Uzish$/i }).first().click();
      await c.waitForTimeout(3000);
      await expectMesh(k, 'K5 chiqqandan keyin (UT+mas\'ul)', ['ut', 'lead'], RECONNECT_BUDGET_MS);

      await clickLobbyJoin(c, 'konsilium shifokori (qayta)');
      await expectMesh(k, 'K5 qaytgandan keyin', ALL, RECONNECT_BUDGET_MS);
    } finally {
      await k.cleanup();
    }
  });

  test('K6) Mas\'ul shifokor konsiliumdan chiqaradi → chiqarilgan xonadan uziladi, qolganlar uzilmaydi', async ({
    browser,
  }) => {
    // SFU: konsilium shifokori o'zi chiqmaydi — chiqarishni server bajarishi shart
    const k = await prepareKonsilium(browser, SFU ? { ignoreRoomClosed: 'consultant' } : {});
    try {
      await k.join('lead');
      await k.join('ut');
      await k.join('consultant');
      const base = await expectMesh(k, 'K6 boshi');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/consultations/${k.consultationId}/participants/${k.consultantId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${k.mt.accessToken}`, 'X-Ishifo-Client': 'web' } },
      );
      expect(res.ok, `DELETE participant: ${res.status}`).toBe(true);

      // Chiqarilgan shifokorda media qolmasligi kerak (SFU'da server uni uzadi)
      await expect
        .poll(async () => {
          const p = await probe(k.pages.consultant);
          return SFU ? netVideo(p) : p.connectedPcs;
        }, { timeout: 15_000 })
        .toBe(0);

      // SFU: server tomonda ham xonadan chiqarilgan bo'lishi shart (klient
      // "o'zi chiqishiga" tayanib bo'lmaydi)
      if (SFU) {
        const rooms = new RoomServiceClient(
          process.env.LIVEKIT_API_URL || 'http://localhost:7880',
          process.env.LIVEKIT_API_KEY || 'ishifo_devkey',
          process.env.LIVEKIT_API_SECRET || 'ishifo_livekit_dev_secret_32chars!!',
        );
        await expect
          .poll(async () => (await rooms.listParticipants(k.consultationId)).map((p) => p.identity), {
            timeout: 10_000,
          })
          .not.toContain(k.consultantId);
      }

      // UT ↔ mas'ul: uzilishsiz, qayta qurilmasdan davom etadi
      const after = await expectMesh(k, 'K6 keyin (UT+mas\'ul)', ['ut', 'lead'], RECONNECT_BUDGET_MS);
      for (const w of ['ut', 'lead'] as const) {
        expect(after[w].totalCreated, `K6 — ${w}: ulanish qayta qurildi`).toBe(base[w].totalCreated);
      }
    } finally {
      await k.cleanup();
    }
  });

  test('K7) SFU: konsiliumdan chiqarilgan shifokorni SERVER uzadi (klient o\'zi chiqmasa ham)', async ({ browser }) => {
    test.skip(!SFU, 'Faqat LiveKit (SFU) rejimi uchun');
    const { consultation, mt } = await prepareVideoConsultation();
    const consultant = new ApiTestClient();
    const cLogin = await consultant.login(CONSULTANT_EMAIL, PASSWORD);
    const consultantId = cLogin.user!.id;
    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const page = await ctx.newPage();
    const rooms = new RoomServiceClient(
      process.env.LIVEKIT_API_URL || 'http://localhost:7880',
      process.env.LIVEKIT_API_KEY || 'ishifo_devkey',
      process.env.LIVEKIT_API_SECRET || 'ishifo_livekit_dev_secret_32chars!!',
    );
    try {
      await mt.startConsultation(consultation.id);
      await mt.post(`/consultations/${consultation.id}/participants`, { doctorIds: [consultantId] });
      const sfu = await consultant.get<{ url: string; token: string }>(`/video/sfu-token/${consultation.id}`);

      // Ilova mantiqisiz "xom" klient — hech qachon o'zi xonadan chiqmaydi
      await page.goto('/privacy');
      await page.addScriptTag({ path: require('path').join(process.cwd(), 'node_modules/livekit-client/dist/livekit-client.umd.js') });
      await page.evaluate(async ({ url, token }) => {
        const w = window as unknown as { LivekitClient: { Room: new () => { connect: (u: string, t: string) => Promise<void> } } };
        const room = new w.LivekitClient.Room();
        await room.connect(url, token);
      }, { url: sfu.url, token: sfu.token });

      await expect
        .poll(async () => (await rooms.listParticipants(consultation.id)).map((x) => x.identity), { timeout: 10_000 })
        .toContain(consultantId);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/consultations/${consultation.id}/participants/${consultantId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${mt.accessToken}`, 'X-Ishifo-Client': 'web' } },
      );
      expect(res.ok).toBe(true);

      await expect
        .poll(async () => (await rooms.listParticipants(consultation.id)).map((x) => x.identity), { timeout: 10_000 })
        .not.toContain(consultantId);

      // Chiqarilgan shifokor yangi token ham ololmaydi
      await expect(consultant.get(`/video/sfu-token/${consultation.id}`)).rejects.toThrow(/403/);
    } finally {
      await ctx.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });

  test('K8) SFU: konsultatsiya yakunlanganda SERVER xonani yopadi va yangi token bermaydi', async ({ browser }) => {
    test.skip(!SFU, 'Faqat LiveKit (SFU) rejimi uchun');
    const { consultation, mt } = await prepareVideoConsultation();
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const page = await ctx.newPage();
    const rooms = new RoomServiceClient(
      process.env.LIVEKIT_API_URL || 'http://localhost:7880',
      process.env.LIVEKIT_API_KEY || 'ishifo_devkey',
      process.env.LIVEKIT_API_SECRET || 'ishifo_livekit_dev_secret_32chars!!',
    );
    try {
      await mt.startConsultation(consultation.id);
      const sfu = await ut.get<{ url: string; token: string }>(`/video/sfu-token/${consultation.id}`);
      await page.goto('/privacy');
      await page.addScriptTag({ path: require('path').join(process.cwd(), 'node_modules/livekit-client/dist/livekit-client.umd.js') });
      await page.evaluate(async ({ url, token }) => {
        const w = window as unknown as { LivekitClient: { Room: new () => { connect: (u: string, t: string) => Promise<void> } } };
        await new w.LivekitClient.Room().connect(url, token);
      }, { url: sfu.url, token: sfu.token });
      await expect
        .poll(async () => (await rooms.listParticipants(consultation.id)).length, { timeout: 10_000 })
        .toBeGreaterThan(0);

      await mt.completeConsultation(consultation.id, {
        diagnosis: 'E2E konsilium yakun',
        icd10Code: 'Z00.0',
        recommendations: 'Test',
      });

      await expect
        .poll(async () => (await rooms.listRooms([consultation.id])).length, { timeout: 10_000 })
        .toBe(0);
      await expect(ut.get(`/video/sfu-token/${consultation.id}`)).rejects.toThrow(/403/);
    } finally {
      await ctx.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny().catch(() => undefined);
    }
  });
});
