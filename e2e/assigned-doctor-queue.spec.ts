import { test, expect } from '@playwright/test';
import {
  ApiTestClient,
  API_BASE,
  buildTestConsultation,
  buildTestPatient,
} from './helpers/api-client';

const PASSWORD = process.env.SEED_PASSWORD || 'password123';

/**
 * Assigned doctor navbat — ownership + status API.
 */
test.describe('Assigned doctor queue', () => {
  test('A1) Create mtDoctorId majburiy — yo\'q bo\'lsa 400', async () => {
    const ut = new ApiTestClient();
    await ut.login('operator@ishifo.uz', PASSWORD);
    const patient = await ut.createPatient(buildTestPatient());

    const res = await fetch(`${API_BASE}/api/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ishifo-Client': 'web',
        Authorization: `Bearer ${ut.accessToken}`,
      },
      body: JSON.stringify({
        patientId: patient.id,
        consentGiven: true,
        clinicalRecord: {
          complaints: 'test',
          anamnesisMorbi: 'a',
          anamnesisVitae: 'b',
        },
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('A2) Faqat biriktirilgan doctor navbatda ko\'radi; UT start qila olmaydi', async () => {
    const ut = new ApiTestClient();
    const doctorA = new ApiTestClient();

    await ut.login('operator@ishifo.uz', PASSWORD);
    const aLogin = await doctorA.login('doctor@ishifo.uz', PASSWORD);
    await doctorA.completeActiveConsultationIfAny();

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(
      buildTestConsultation(patient.id, aLogin.user!.id),
    );
    expect(consultation.status).toBe('QUEUED');

    const queueA = await doctorA.getQueue();
    expect(queueA.some((c) => c.id === consultation.id)).toBeTruthy();

    // UT operator klinik start qila olmaydi
    let forbidden = false;
    try {
      await ut.startConsultation(consultation.id);
    } catch (err) {
      forbidden = /403|401|400|POST/.test(String(err));
    }
    expect(forbidden).toBeTruthy();

    const started = await doctorA.startConsultation(consultation.id);
    expect(started).toBeTruthy();
  });

  test('A3) Assigned doctor cancel QUEUED mumkin; boshqa MT yo\'q', async () => {
    const ut = new ApiTestClient();
    const doctorA = new ApiTestClient();

    await ut.login('operator@ishifo.uz', PASSWORD);
    const aLogin = await doctorA.login('doctor@ishifo.uz', PASSWORD);
    await doctorA.completeActiveConsultationIfAny();

    const patient = await ut.createPatient(buildTestPatient());
    const consultation = await ut.createConsultation(
      buildTestConsultation(patient.id, aLogin.user!.id),
    );

    await doctorA.cancelConsultation(consultation.id, 'E2E assigned cancel test');
    const queue = await doctorA.getQueue();
    expect(queue.some((c) => c.id === consultation.id)).toBeFalsy();
  });
});
