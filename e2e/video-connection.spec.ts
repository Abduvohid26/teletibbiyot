import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import type { Socket } from 'socket.io-client';
import { ApiTestClient } from './helpers/api-client';
import { loginAs } from './helpers/login';
import {
  connectVideoSocket,
  fetchIceConfig,
  joinRoom,
  waitForEvent,
} from './helpers/video-socket';
import {
  PASSWORD,
  prepareVideoConsultation,
  patchIceConfigFetch,
  seedDoctorMediaPrefs,
  seedUtSession,
  waitForPlayingVideo,
} from './helpers/video-setup';

async function createVideoContext(browser: import('@playwright/test').Browser) {
  return browser.newContext({
    permissions: ['camera', 'microphone'],
  });
}

async function dismissPreflightIfVisible(page: Page) {
  const confirm = page.getByRole('button', { name: /konsultatsiyani boshlash/i });
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirm.click();
  }
}

function relayIceToPage(
  socket: Socket,
  page: Page,
  peerSocketId: string,
  handlerName: '__addIceCandidate',
) {
  socket.on('ice-candidate', (data: {
    socketId?: string;
    targetSocketId?: string;
    candidate?: RTCIceCandidateInit;
  }) => {
    if (data.socketId !== peerSocketId || !data.candidate) return;
    void page.evaluate(
      ({ name, candidate }) => {
        const fn = (window as unknown as Record<string, (c: RTCIceCandidateInit) => void>)[name];
        fn?.(candidate);
      },
      { name: handlerName, candidate: data.candidate },
    );
  });
}

test.describe('Video WebRTC connection', () => {
  test('offer/answer/ICE relay establishes peer connection via socket', async ({ browser }) => {
    const { consultation } = await prepareVideoConsultation();

    const ut = new ApiTestClient();
    const mt = new ApiTestClient();
    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const iceConfig = await fetchIceConfig(mtLogin.accessToken!);

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    const context = await createVideoContext(browser);
    const utPage = await context.newPage();
    const mtPage = await context.newPage();

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const utSocketId = utSocket.id!;
      const mtSocketId = mtSocket.id!;

      await utPage.goto('/');
      await mtPage.goto('/');

      await mtPage.exposeFunction('__sendOffer', (payload: unknown) => {
        mtSocket.emit('offer', payload);
      });
      await mtPage.exposeFunction('__sendIceMt', (payload: unknown) => {
        mtSocket.emit('ice-candidate', payload);
      });
      await utPage.exposeFunction('__sendAnswer', (payload: unknown) => {
        utSocket.emit('answer', payload);
      });
      await utPage.exposeFunction('__sendIceUt', (payload: unknown) => {
        utSocket.emit('ice-candidate', payload);
      });

      relayIceToPage(utSocket, utPage, mtSocketId, '__addIceCandidate');
      relayIceToPage(mtSocket, mtPage, utSocketId, '__addIceCandidate');

      const answerPromise = waitForEvent<{ socketId?: string; answer?: RTCSessionDescriptionInit }>(
        mtSocket,
        'answer',
        20000,
      );

      const offerForUtPromise = waitForEvent<{
        socketId?: string;
        offer?: RTCSessionDescriptionInit;
      }>(utSocket, 'offer', 15000);

      await mtPage.evaluate(
        async ({ iceServers, targetSocketId, roomId }) => {
          const pc = new RTCPeerConnection({ iceServers });
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          (window as unknown as { __e2ePc: RTCPeerConnection }).__e2ePc = pc;
          (window as unknown as { __addIceCandidate: (c: RTCIceCandidateInit) => void }).__addIceCandidate = (
            candidate,
          ) => {
            void pc.addIceCandidate(candidate);
          };

          pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            (window as unknown as { __sendIceMt: (p: unknown) => void }).__sendIceMt({
              roomId,
              targetSocketId,
              candidate: event.candidate.toJSON(),
            });
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await new Promise<void>((resolve) => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
              return;
            }
            const onChange = () => {
              if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', onChange);
                resolve();
              }
            };
            pc.addEventListener('icegatheringstatechange', onChange);
            setTimeout(resolve, 2500);
          });

          (window as unknown as { __sendOffer: (p: unknown) => void }).__sendOffer({
            roomId,
            targetSocketId,
            offer: pc.localDescription,
          });
        },
        { iceServers: iceConfig.iceServers, targetSocketId: utSocketId, roomId: consultation.id },
      );

      const offerForUt = await offerForUtPromise;
      expect(offerForUt.socketId).toBe(mtSocketId);

      const utConnected = utPage.evaluate(
        async ({ iceServers, fromSocketId, roomId, offer }) => {
          const pc = new RTCPeerConnection({ iceServers });
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          (window as unknown as { __e2ePc: RTCPeerConnection }).__e2ePc = pc;
          (window as unknown as { __addIceCandidate: (c: RTCIceCandidateInit) => void }).__addIceCandidate = (
            candidate,
          ) => {
            void pc.addIceCandidate(candidate);
          };

          pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            (window as unknown as { __sendIceUt: (p: unknown) => void }).__sendIceUt({
              roomId,
              targetSocketId: fromSocketId,
              candidate: event.candidate.toJSON(),
            });
          };

          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          (window as unknown as { __sendAnswer: (p: unknown) => void }).__sendAnswer({
            roomId,
            targetSocketId: fromSocketId,
            answer: pc.localDescription,
          });

          return new Promise<boolean>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('UT WebRTC connect timeout')), 20000);
            pc.onconnectionstatechange = () => {
              if (pc.connectionState === 'connected') {
                clearTimeout(timer);
                resolve(true);
              }
              if (pc.connectionState === 'failed') {
                clearTimeout(timer);
                reject(new Error('UT WebRTC connection failed'));
              }
            };
          });
        },
        {
          iceServers: iceConfig.iceServers,
          fromSocketId: mtSocketId,
          roomId: consultation.id,
          offer: offerForUt.offer,
        },
      );

      const answerPayload = await answerPromise;
      expect(answerPayload.socketId).toBe(utSocketId);
      expect(answerPayload.answer?.type).toBe('answer');

      await mtPage.evaluate(async (answer) => {
        const pc = (window as unknown as { __e2ePc?: RTCPeerConnection }).__e2ePc;
        if (!pc) throw new Error('Missing MT peer connection');
        await pc.setRemoteDescription(answer);
        return new Promise<boolean>((resolve, reject) => {
          if (pc.connectionState === 'connected') {
            resolve(true);
            return;
          }
          const timer = setTimeout(() => reject(new Error('MT WebRTC connect timeout')), 20000);
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              clearTimeout(timer);
              resolve(true);
            }
            if (pc.connectionState === 'failed') {
              clearTimeout(timer);
              reject(new Error('MT WebRTC connection failed'));
            }
          };
        });
      }, answerPayload.answer);

      await expect(utConnected).resolves.toBe(true);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
      await context.close();
    }
  });

  test('UT and doctor UI establish live video (fake media)', async ({ browser }) => {
    test.skip(
      !process.env.RUN_UI_VIDEO_E2E,
      'Full UI WebRTC: set RUN_UI_VIDEO_E2E=1 (needs STUN-only or reachable TURN)',
    );
    const { consultation, mt } = await prepareVideoConsultation();

    let utContext: BrowserContext | undefined;
    let mtContext: BrowserContext | undefined;

    try {
      utContext = await createVideoContext(browser);
      mtContext = await createVideoContext(browser);

      const utPage = await utContext.newPage();
      const mtPage = await mtContext.newPage();

      await seedUtSession(utPage, consultation.id);
      await seedDoctorMediaPrefs(mtPage);
      await patchIceConfigFetch(utPage, mtPage);

      await loginAs(utPage, 'operator@ishifo.uz', PASSWORD, /\/ut/);
      await loginAs(mtPage, 'doctor@ishifo.uz', PASSWORD, /\/dashboard/);

      await mt.startConsultation(consultation.id);

      await utPage.goto('/ut/vitals');
      await mtPage.goto('/dashboard');

      await dismissPreflightIfVisible(utPage);
      await dismissPreflightIfVisible(mtPage);

      await mtPage.getByRole('button', { name: /^Bemor$/i }).click();

      await expect(mtPage.getByText(/UT kamera kutmoqda/)).toBeHidden({ timeout: 60000 });
      await waitForPlayingVideo(mtPage, 60000);

      await expect(utPage.getByRole('button', { name: /Shifokor/i })).not.toContainText('Ulanmagan', {
        timeout: 60000,
      });
    } finally {
      await utContext?.close().catch(() => undefined);
      await mtContext?.close().catch(() => undefined);
      await mt.completeActiveConsultationIfAny();
    }
  });
});
