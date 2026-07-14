import { test, expect } from '@playwright/test';
import {
  ApiTestClient,
  buildTestConsultation,
  buildTestPatient,
} from './helpers/api-client';

const PASSWORD = process.env.SEED_PASSWORD || 'password123';

test.describe('Full consultation flow (API)', () => {
  test('UT creates consultation → MT doctor starts from queue', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    await ut.login('operator@ishifo.uz', PASSWORD);
    await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    expect(patient.id).toBeTruthy();

    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));
    expect(consultation.status).toBe('QUEUED');

    const queue = await mt.getQueue();
    expect(queue.some((c) => c.id === consultation.id)).toBeTruthy();

    const started = await mt.startConsultation(consultation.id);
    expect(started).toBeTruthy();
  });

  test('MT doctor completes consultation with diagnosis', async () => {
    const ut = new ApiTestClient();
    const mt = new ApiTestClient();

    await ut.login('operator@ishifo.uz', PASSWORD);
    await mt.login('doctor@ishifo.uz', PASSWORD);

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(buildTestConsultation(patient.id));
    await mt.startConsultation(consultation.id);

    const completed = await mt.completeConsultation(consultation.id, {
      diagnosis: 'Virusli infeksiya',
      icd10Code: 'J06.9',
      recommendations: 'Dam olish, suyuqlik, kuzatuv',
      prescription: 'Paracetamol 500mg — 3 marta kuniga — 5 kun',
    });
    expect(completed).toBeTruthy();
  });
});

test.describe('Integrations API', () => {
  test('status endpoint returns integration flags', async () => {
    const client = new ApiTestClient();
    await client.login('admin@ishifo.uz', process.env.SEED_PASSWORD || 'password123');
    const status = await client.getIntegrationsStatus();
    expect(status).toHaveProperty('oneId');
    expect(status).toHaveProperty('prescription');
    expect(status).toHaveProperty('dicom');
  });
});
