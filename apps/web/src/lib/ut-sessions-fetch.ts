import { api, type Consultation } from '@/lib/api';

const ACTIVE_STATUSES = new Set(['QUEUED', 'IN_PROGRESS']);

function mergeActiveSessions(lists: Consultation[][]): Consultation[] {
  const byId = new Map<string, Consultation>();
  for (const list of lists) {
    for (const item of list) {
      if (ACTIVE_STATUSES.has(item.status)) byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'IN_PROGRESS' ? -1 : 1;
    }
    const aTime = a.startedAt || a.createdAt || '';
    const bTime = b.startedAt || b.createdAt || '';
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

/** UT operator: navbat + jonli sessiyalar (eski API bilan ham ishlaydi) */
export async function fetchUtSessionConsultations(): Promise<Consultation[]> {
  try {
    const direct = await api.getUtSessionConsultations();
    if (direct.length > 0) return direct;
  } catch {
    /* yangi endpoint bo'lmasa yoki 404 — fallback */
  }

  try {
    const queue = await api.getQueue();
    const merged = mergeActiveSessions([queue]);
    if (merged.length > 0) return merged;
  } catch {
    /* keyingi fallback */
  }

  try {
    const list = await api.getConsultationsList({ limit: 100 });
    const merged = mergeActiveSessions([list.items]);
    if (merged.length > 0) return merged;
  } catch {
    /* keyingi fallback */
  }

  try {
    const [queued, inProgress] = await Promise.all([
      api.getConsultationsList({ status: 'QUEUED', limit: 50 }),
      api.getConsultationsList({ status: 'IN_PROGRESS', limit: 50 }),
    ]);
    return mergeActiveSessions([queued.items, inProgress.items]);
  } catch {
    return [];
  }
}
