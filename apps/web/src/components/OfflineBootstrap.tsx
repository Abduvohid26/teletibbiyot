'use client';

import { useEffect } from 'react';
import { flushOfflineQueue, getOfflineQueue, type OfflineConsultationPayload } from '@/lib/offline-sync';
import { api } from '@/lib/api';
import { base64ToFile } from '@/lib/offline-sync';
import { toast } from '@/lib/toast';

async function submitOfflinePayload(payload: OfflineConsultationPayload) {
  const patientPayload = payload.patient as Parameters<typeof api.createPatient>[0];
  let patient;
  if (patientPayload.pinfl) {
    try {
      const existing = await api.findPatientByPinfl(patientPayload.pinfl);
      patient = await api.updatePatient(existing.id, patientPayload);
    } catch {
      patient = await api.createPatient(patientPayload);
    }
  } else {
    patient = await api.createPatient(patientPayload);
  }
  const consultation = await api.createConsultation({
    ...(payload.consultation as Parameters<typeof api.createConsultation>[0]),
    patientId: patient.id,
  });
  if (payload.files?.length) {
    for (const filePayload of payload.files) {
      await api.uploadAttachment(consultation.id, base64ToFile(filePayload));
    }
    await api.finalizeAttachments(consultation.id);
  }
  return consultation;
}

export function OfflineBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
        // Yangi SW darhol faol bo'lsin (eski / keshini tozalash)
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch {
        /* brauzer cheklovi */
      }
    };

    const syncQueue = async () => {
      if (!navigator.onLine) return;
      const result = await flushOfflineQueue(submitOfflinePayload);
      if (result.synced > 0) {
        toast(`${result.synced} ta offline ma'lumot sinxronlandi`, 'success');
      }
      if (result.failed > 0) {
        const remaining = await getOfflineQueue();
        if (remaining.length > 0) {
          toast(`${result.failed} ta offline ma'lumot sinxronlanmadi`, 'error');
        }
      }
    };

    void registerServiceWorker();
    void syncQueue();

    window.addEventListener('online', syncQueue);
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_OFFLINE') void syncQueue();
    });

    return () => window.removeEventListener('online', syncQueue);
  }, []);

  return null;
}
