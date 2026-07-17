import { test, expect } from '@playwright/test';
import {
  ApiTestClient,
  buildTestConsultation,
  buildTestPatient,
} from './helpers/api-client';
import {
  connectVideoSocket,
  joinRoom,
  waitForEvent,
} from './helpers/video-socket';
import { PASSWORD } from './helpers/video-setup';

test.describe('Video reconnect signaling', () => {
  test('UT media-resumed → doctor receives offer-requested', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    const utLogin = await ut.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);
    expect(utLogin.accessToken).toBeTruthy();
    expect(mtLogin.accessToken).toBeTruthy();

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));
    expect(consultation.status).toBe('QUEUED');

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
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));
    expect(consultation.status).toBe('QUEUED');

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
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));
    expect(consultation.status).toBe('QUEUED');

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
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));
    expect(consultation.status).toBe('QUEUED');

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
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));

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
});
