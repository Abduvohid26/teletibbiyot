import { test, expect } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import {
  ApiTestClient,
  API_BASE,
  buildTestConsultation,
  buildTestPatient,
} from './helpers/api-client';

const PASSWORD = process.env.SEED_PASSWORD || 'password123';
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_IO_PATH || '/socket.io';

function connectVideoSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${API_BASE}/video`, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 12000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Video socket auth timeout'));
    }, 15000);

    socket.on('ws-authenticated', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on('ws-error', (payload: { message?: string }) => {
      clearTimeout(timer);
      reject(new Error(payload.message || 'WebSocket auth rejected'));
    });
  });
}

function joinRoom(socket: Socket, roomId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-room timeout')), 10000);
    socket.emit('join-room', { roomId }, (ack: { success?: boolean; error?: string }) => {
      clearTimeout(timer);
      if (ack?.success) resolve();
      else reject(new Error(ack?.error || 'join-room failed'));
    });
  });
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

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
    // Video xonasiga QUEUED holatda ham qo'shilish mumkin
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
    // Video xonasiga QUEUED holatda ham qo'shilish mumkin
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
