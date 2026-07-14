'use client';

const DB_NAME = 'ishifo-offline';
const STORE = 'outbox';
const MAX_RETRIES = 5;

export interface OfflineFilePayload {
  name: string;
  type: string;
  base64: string;
}

export interface OfflineConsultationPayload {
  patient: unknown;
  consultation: unknown;
  files?: OfflineFilePayload[];
}

export interface OfflineSubmission {
  id: string;
  type: 'consultation';
  payload: OfflineConsultationPayload;
  createdAt: number;
  retries: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function base64ToFile(payload: OfflineFilePayload): File {
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], payload.name, { type: payload.type || 'application/octet-stream' });
}

export async function queueOfflineSubmission(payload: OfflineConsultationPayload) {
  const id = crypto.randomUUID();
  const item: OfflineSubmission = { id, type: 'consultation', payload, createdAt: Date.now(), retries: 0 };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}

async function saveOfflineSubmission(item: OfflineSubmission) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOfflineQueue(): Promise<OfflineSubmission[]> {
  const db = await openDb();
  const items = await new Promise<OfflineSubmission[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OfflineSubmission[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOfflineSubmission(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function flushOfflineQueue(
  submitFn: (payload: OfflineConsultationPayload) => Promise<unknown>,
): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  const queue = await getOfflineQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await submitFn(item.payload);
      await removeOfflineSubmission(item.id);
      synced++;
    } catch {
      item.retries += 1;
      if (item.retries >= MAX_RETRIES) {
        await removeOfflineSubmission(item.id);
      } else {
        await saveOfflineSubmission(item);
      }
      failed++;
    }
  }

  return { synced, failed };
}
