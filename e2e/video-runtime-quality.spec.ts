import { test, expect } from '@playwright/test';
import { openLiveRoom } from './helpers/video-live-room';

/**
 * ISHLASH JARAYONI testi — "ulandimi?" emas, "OQIM UZLUKSIZMI?".
 *
 * Oldingi testlar faqat trek borligini tekshirardi. Foydalanuvchi ko'rgan
 * muammo esa boshqacha: ulanish tirik, lekin tasvir qotib qoladi va
 * "Tasvir tiklanmoqda…" qoplamasi chiqadi. VideoTile o'sha qoplamani
 * `video.currentTime` 1.5 soniya siljimaganda ko'rsatadi.
 *
 * Shuning uchun bu yerda WebRTC statistikasi bo'yicha o'lchaymiz:
 * kadrlar kelyaptimi, dekodlanyaptimi, nechta freeze bo'ldi.
 */

interface VideoSample {
  t: number;
  framesReceived: number;
  framesDecoded: number;
  framesDropped: number;
  freezeCount: number;
  totalFreezesDuration: number;
  bytesReceived: number;
  packetsLost: number;
  frameWidth: number;
  frameHeight: number;
  /** <video> elementining o'z vaqti — foydalanuvchi ko'radigan haqiqat */
  mediaTime: number;
}

async function sampleInbound(page: import('@playwright/test').Page): Promise<VideoSample | null> {
  return page.evaluate(async () => {
    const w = window as unknown as { __pcs?: RTCPeerConnection[] };
    const pcs = (w.__pcs ?? []).filter((pc) => pc.connectionState !== 'closed');

    let best: Record<string, number> | null = null;
    for (const pc of pcs) {
      const stats = await pc.getStats();
      stats.forEach((r) => {
        const rep = r as unknown as Record<string, unknown>;
        if (rep.type !== 'inbound-rtp' || rep.kind !== 'video') return;
        const framesReceived = Number(rep.framesReceived ?? 0);
        if (best && framesReceived <= best.framesReceived) return;
        best = {
          framesReceived,
          framesDecoded: Number(rep.framesDecoded ?? 0),
          framesDropped: Number(rep.framesDropped ?? 0),
          freezeCount: Number(rep.freezeCount ?? 0),
          totalFreezesDuration: Number(rep.totalFreezesDuration ?? 0),
          bytesReceived: Number(rep.bytesReceived ?? 0),
          packetsLost: Number(rep.packetsLost ?? 0),
          frameWidth: Number(rep.frameWidth ?? 0),
          frameHeight: Number(rep.frameHeight ?? 0),
        };
      });
    }
    if (!best) return null;

    // Ekrandagi eng katta <video> ning haqiqiy vaqti
    const videos = Array.from(document.querySelectorAll('video'));
    const main = videos
      .filter((v) => v.srcObject && v.readyState >= 2)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];

    return { t: Date.now(), mediaTime: main?.currentTime ?? 0, ...best };
  });
}

test('R1) 40 soniya davomida oqim uzluksiz — kadrlar kelib turadi, freeze yo\'q', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const room = await openLiveRoom(browser);

  try {
    const samples: VideoSample[] = [];
    for (let i = 0; i < 20; i++) {
      await room.mtPage.waitForTimeout(2000);
      const s = await sampleInbound(room.mtPage);
      if (s) samples.push(s);
    }

    expect(samples.length, 'statistika yig\'ilishi kerak').toBeGreaterThan(10);

    const first = samples[0];
    const last = samples[samples.length - 1];
    const seconds = (last.t - first.t) / 1000;

    const fps = (last.framesDecoded - first.framesDecoded) / seconds;
    const kbps = ((last.bytesReceived - first.bytesReceived) * 8) / seconds / 1000;
    const freezes = last.freezeCount - first.freezeCount;
    const freezeSec = last.totalFreezesDuration - first.totalFreezesDuration;
    const mediaAdvance = last.mediaTime - first.mediaTime;

    // eslint-disable-next-line no-console
    console.log(
      `\n=== ${seconds.toFixed(1)}s natija ===\n` +
        `  dekodlangan FPS : ${fps.toFixed(1)}\n` +
        `  bitrate         : ${kbps.toFixed(0)} kbps\n` +
        `  o'lcham         : ${last.frameWidth}x${last.frameHeight}\n` +
        `  freeze soni     : ${freezes}\n` +
        `  freeze davomi   : ${freezeSec.toFixed(2)}s\n` +
        `  tashlangan kadr : ${last.framesDropped - first.framesDropped}\n` +
        `  yo'qolgan paket : ${last.packetsLost - first.packetsLost}\n` +
        `  <video> siljish : ${mediaAdvance.toFixed(1)}s / ${seconds.toFixed(1)}s\n`,
    );

    // Har bir oraliqda kadr kelgan bo'lishi kerak — birorta ham to'liq to'xtash bo'lmasin
    const stalled: string[] = [];
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].framesDecoded === samples[i - 1].framesDecoded) {
        stalled.push(`${((samples[i].t - first.t) / 1000).toFixed(0)}s`);
      }
    }
    // eslint-disable-next-line no-console
    if (stalled.length) console.log(`  TO'XTAGAN oraliqlar: ${stalled.join(', ')}`);

    expect(fps, 'dekodlangan FPS').toBeGreaterThan(5);
    expect(kbps, 'bitrate kbps').toBeGreaterThan(30);
    // <video> vaqti real vaqtning kamida 80% ida siljishi kerak
    expect(mediaAdvance / seconds, '<video> siljish nisbati').toBeGreaterThan(0.8);
    expect(stalled.length, `to'xtagan oraliqlar: ${stalled.join(', ')}`).toBe(0);
    expect(freezeSec, 'umumiy freeze soniyalari').toBeLessThan(2);
  } finally {
    await room.cleanup();
  }
});
