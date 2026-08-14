import { test, expect } from '@playwright/test';
import {
  ApiTestClient,
  buildTestConsultation,
  buildTestPatient,
} from './helpers/api-client';
import {
  connectVideoSocket,
  joinRoom,
  joinRoomWithAck,
  requestRoomSync,
  waitForAnyEvent,
  waitForEvent,
} from './helpers/video-socket';
import { PASSWORD } from './helpers/video-setup';

/**
 * Socket.IO signaling testlari — lobby qayta kirish oqimi (WebRTC siz).
 *
 * S1  UT join → shifokorga offer-requested
 * S2  Shifokor join (UT kutmoqda) → offer-requested + others
 * S3  UT disconnect + lobby rejoin → participant-rejoined + offer-requested
 * S4  request-room-sync → others + offer-requested
 * S5  Shifokor lobby rejoin → UT peer-media-resumed
 * S6  media-resumed / end-call / participant-rejoined (asosiy signal)
 */

test.describe('Video lobby signaling', () => {
  async function freshConsultation() {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();
    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);
    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));
    return { ut, mt, utLogin, mtLogin, consultation };
  }

  test('S1) UT lobby join (birinchi) → kutayotgan shifokorga offer-requested', async () => {
    const { utLogin, mtLogin, consultation } = await freshConsultation();
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);
    const utSocket = await connectVideoSocket(utLogin.accessToken!);

    try {
      await joinRoom(mtSocket, consultation.id);
      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');
      await joinRoom(utSocket, consultation.id);
      const payload = await offerRequested;
      expect(payload.targetSocketId).toBe(utSocket.id);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('S2) Shifokor lobby join (UT allaqachon xonada) → offer-requested + others', async () => {
    const { utLogin, mtLogin, consultation } = await freshConsultation();
    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);

      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');
      const roomJoined = waitForEvent<{ others?: { role?: string; socketId?: string }[] }>(
        mtSocket,
        'room-joined',
      );

      const ack = await joinRoomWithAck(mtSocket, consultation.id);
      const [offerPayload, joinedPayload] = await Promise.all([offerRequested, roomJoined]);

      expect(offerPayload.targetSocketId).toBe(utSocket.id);
      expect(joinedPayload.others?.some((p) => p.role === 'UT_OPERATOR')).toBe(true);
      expect(ack.others?.some((p) => p.role === 'UT_OPERATOR')).toBe(true);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('S3) UT lobby rejoin (disconnect + join) → shifokor yangi ishtirokchi + offer-requested', async () => {
    const { utLogin, mtLogin, consultation } = await freshConsultation();
    const utSocket1 = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket1, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const utBack = waitForAnyEvent<{ socketId?: string; role?: string }>(mtSocket, [
        'participant-rejoined',
        'participant-joined',
      ]);
      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');

      const oldId = utSocket1.id;
      utSocket1.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      const utSocket2 = await connectVideoSocket(utLogin.accessToken!);
      await joinRoom(utSocket2, consultation.id);

      const [{ payload: joinedPayload }, offerPayload] = await Promise.all([utBack, offerRequested]);
      expect(joinedPayload.role).toBe('UT_OPERATOR');
      expect(joinedPayload.socketId).toBe(utSocket2.id);
      expect(joinedPayload.socketId).not.toBe(oldId);
      expect(offerPayload.targetSocketId).toBe(utSocket2.id);

      utSocket2.disconnect();
    } finally {
      mtSocket.disconnect();
    }
  });

  test('S4) request-room-sync → others ro\'yxati va offer-requested', async () => {
    const { utLogin, mtLogin, consultation } = await freshConsultation();
    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const roomParticipants = waitForEvent<{ socketId?: string; role?: string }[]>(
        mtSocket,
        'room-participants',
      );
      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');

      const syncAck = await requestRoomSync(mtSocket, consultation.id);
      const [participants, offerPayload] = await Promise.all([roomParticipants, offerRequested]);

      expect(syncAck.success).toBe(true);
      expect(syncAck.others?.some((p) => p.role === 'UT_OPERATOR')).toBe(true);
      expect(participants.some((p) => p.role === 'UT_OPERATOR')).toBe(true);
      expect(offerPayload.targetSocketId).toBe(utSocket.id);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('S5) Shifokor lobby rejoin → UT shifokor qaytganini biladi', async () => {
    const { utLogin, mtLogin, consultation } = await freshConsultation();
    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket1 = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket1, consultation.id);

      const doctorBack = waitForAnyEvent<{ socketId?: string; role?: string }>(utSocket, [
        'peer-media-resumed',
        'participant-joined',
        'participant-rejoined',
      ]);
      mtSocket1.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      const mtSocket2 = await connectVideoSocket(mtLogin.accessToken!);
      await joinRoom(mtSocket2, consultation.id);

      const { event, payload } = await doctorBack;
      expect(payload.socketId).toBe(mtSocket2.id);
      if (event === 'participant-joined' || event === 'participant-rejoined') {
        expect(payload.role).toBe('MT_DOCTOR');
      }

      mtSocket2.disconnect();
    } finally {
      utSocket.disconnect();
    }
  });
});

test.describe('Video reconnect signaling (legacy)', () => {
  test('UT media-resumed → doctor receives offer-requested', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');
      utSocket.emit('media-resumed', { roomId: consultation.id });
      utSocket.emit('request-offers', { roomId: consultation.id });

      const payload = await offerRequested;
      expect(payload.targetSocketId).toBe(utSocket.id);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('UT media-resumed → doctor receives peer-media-resumed', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const peerResumed = waitForEvent<{ socketId?: string }>(mtSocket, 'peer-media-resumed');
      utSocket.emit('media-resumed', { roomId: consultation.id });

      const payload = await peerResumed;
      expect(payload.socketId).toBe(utSocket.id);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('end-call notifies peer without echo to sender', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const callEndedOnDoctor = waitForEvent<{ socketId?: string }>(mtSocket, 'call-ended');
      let utReceivedOwnEnd = false;
      utSocket.on('call-ended', (data: { socketId?: string }) => {
        if (data?.socketId === utSocket.id) utReceivedOwnEnd = true;
      });

      utSocket.emit('end-call', { roomId: consultation.id });

      const payload = await callEndedOnDoctor;
      expect(payload.socketId).toBe(utSocket.id);
      await new Promise((r) => setTimeout(r, 300));
      expect(utReceivedOwnEnd).toBe(false);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('UT media-resumed → doctor receives participant-rejoined', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const rejoined = waitForEvent<{ socketId?: string; role?: string }>(
        mtSocket,
        'participant-rejoined',
      );
      utSocket.emit('media-resumed', { roomId: consultation.id });

      const payload = await rejoined;
      expect(payload.socketId).toBe(utSocket.id);
      expect(payload.role).toBe('UT_OPERATOR');
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('after end-call, media-resumed still triggers offer-requested to doctor', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      const callEnded = waitForEvent<{ socketId?: string }>(mtSocket, 'call-ended');
      utSocket.emit('end-call', { roomId: consultation.id });
      await callEnded;

      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');
      utSocket.emit('media-resumed', { roomId: consultation.id });
      utSocket.emit('request-offers', { roomId: consultation.id });

      const payload = await offerRequested;
      expect(payload.targetSocketId).toBe(utSocket.id);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });

  test('lobby rejoin: end-call then join again → offer-requested', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const utSocket = await connectVideoSocket(utLogin.accessToken!);
    const mtSocket = await connectVideoSocket(mtLogin.accessToken!);

    try {
      await joinRoom(utSocket, consultation.id);
      await joinRoom(mtSocket, consultation.id);

      utSocket.emit('end-call', { roomId: consultation.id });
      await new Promise((r) => setTimeout(r, 300));

      const offerRequested = waitForEvent<{ targetSocketId?: string }>(mtSocket, 'offer-requested');
      utSocket.emit('media-resumed', { roomId: consultation.id });
      utSocket.emit('request-offers', { roomId: consultation.id });

      const payload = await offerRequested;
      expect(payload.targetSocketId).toBe(utSocket.id);
    } finally {
      utSocket.disconnect();
      mtSocket.disconnect();
    }
  });
});
