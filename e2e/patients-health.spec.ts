import { test, expect } from '@playwright/test';
import {
  ApiTestClient,
  buildTestConsultation,
  buildTestPatient,
} from './helpers/api-client';
import { DEFAULT_PASSWORD, loginAs } from './helpers/login';

const PASSWORD = process.env.SEED_PASSWORD || DEFAULT_PASSWORD;

test.describe('Patients API', () => {
  test('UT operator can create patient and search list', async () => {
    const client = new ApiTestClient();
    const mt = new ApiTestClient();
    await client.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const suffix = Date.now();
    const patient = await client.createPatient(buildTestPatient(suffix));
    expect(patient.id).toBeTruthy();

    await client.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const list = await client.get<{ items: Array<{ id: string }>; total: number }>(
      `/patients?search=Test Bemor ${suffix}`,
    );
    expect(list.total).toBeGreaterThan(0);
    expect(list.items.some((p) => p.id === patient.id)).toBeTruthy();
  });

  test('UT operator can read own facility patient after consultation', async () => {
    const client = new ApiTestClient();
    const mt = new ApiTestClient();
    await client.login('operator@ishifo.uz', PASSWORD);
    const mtLogin = await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await client.createPatient(buildTestPatient());
    await client.createConsultation(buildTestConsultation(patient.id, mtLogin.user!.id));

    const detail = await client.get<{ id: string }>(`/patients/${patient.id}`);
    expect(detail.id).toBe(patient.id);
  });
});

test.describe('Health endpoints', () => {
  test('ready endpoint responds when DB is up', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/health/ready`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ready).toBe(true);
  });

  test('health check returns database status in dev', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await request.get(`${apiBase}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBeTruthy();
  });
});

test.describe('Dashboard stats API', () => {
  test('doctor can fetch dashboard stats', async () => {
    const client = new ApiTestClient();
    await client.login('doctor@ishifo.uz', PASSWORD);
    const stats = await client.get<Record<string, unknown>>('/dashboard/stats');
    expect(stats).toBeTruthy();
  });
});
