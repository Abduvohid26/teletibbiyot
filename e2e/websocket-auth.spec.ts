import { test, expect } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_IO_PATH || '/socket.io';

function connectWithCookie(cookieHeader: string): Promise<{ userId: string; socket: Socket }> {
  return new Promise((resolve, reject) => {
    const socket = io(`${API_BASE}/video`, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieHeader },
      auth: {},
      reconnection: false,
      timeout: 10000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('WebSocket auth timeout'));
    }, 15000);

    socket.on('ws-authenticated', (payload: { userId?: string }) => {
      clearTimeout(timer);
      resolve({ userId: payload.userId ?? '', socket });
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

test.describe('WebSocket HttpOnly cookie auth', () => {
  test('login sets HttpOnly token cookie', async ({ request }) => {
    const login = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: 'doctor@ishifo.uz', password: DEFAULT_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();

    const storage = await request.storageState();
    const tokenCookie = storage.cookies.find((c) => c.name === 'token');
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie!.httpOnly).toBe(true);
    expect(tokenCookie!.value.length).toBeGreaterThan(20);
  });

  test('video socket authenticates with cookie only (no Bearer in handshake)', async ({ request }) => {
    const login = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: 'doctor@ishifo.uz', password: DEFAULT_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();

    const storage = await request.storageState();
    const tokenCookie = storage.cookies.find((c) => c.name === 'token');
    expect(tokenCookie).toBeTruthy();

    const { userId, socket } = await connectWithCookie(`token=${tokenCookie!.value}`);
    expect(userId.length).toBeGreaterThan(0);
    socket.disconnect();
  });

  test('video socket rejects connection without auth cookie', async () => {
    await expect(connectWithCookie('')).rejects.toThrow(/Token|auth|timeout|rejected/i);
  });

  test('browser session cookie works for WebSocket after UI login', async ({ page, context }) => {
    test.setTimeout(90000);
    await loginAs(page, 'doctor@ishifo.uz', DEFAULT_PASSWORD, /\/dashboard/);

    const cookies = await context.cookies();
    const tokenCookie = cookies.find((c) => c.name === 'token');
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie!.httpOnly).toBe(true);

    const { userId, socket } = await connectWithCookie(`token=${tokenCookie!.value}`);
    expect(userId.length).toBeGreaterThan(0);
    socket.disconnect();
  });
});
