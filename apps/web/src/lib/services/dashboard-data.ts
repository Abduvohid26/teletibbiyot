import { api, Consultation, DashboardStats } from '@/lib/api';
import { safeAsync } from '@/lib/errors';

export interface DashboardSnapshot {
  consultation: Consultation | null;
  inProgressList: Consultation[];
  queue: Consultation[];
  stats: DashboardStats | null;
  attachmentCount: number;
  notificationCount: number;
}

export async function loadDashboardSnapshot(params: {
  isDoctor: boolean;
  observedId: string | null;
  activeConsultationId?: string | null;
}): Promise<DashboardSnapshot> {
  const { isDoctor, observedId, activeConsultationId } = params;

  const [active, queue, stats, inProgress, notifications] = await Promise.all([
    isDoctor
      ? safeAsync('active-consultation', () => api.getActiveConsultation(activeConsultationId || undefined), null)
      : Promise.resolve(null),
    safeAsync('queue', () => api.getQueue(), []),
    safeAsync('stats', () => api.getStats(), null),
    safeAsync('in-progress', () => api.getInProgressConsultations(), []),
    isDoctor ? safeAsync('notifications', () => api.getNotifications(true), []) : Promise.resolve([]),
  ]);

  const observerConsultation = !isDoctor
    ? inProgress.find((c) => c.id === observedId) ?? inProgress[0] ?? null
    : null;
  const consultation = isDoctor
    ? (
      active
      ?? (activeConsultationId
        ? inProgress.find((c) => c.id === activeConsultationId) ?? null
        : null)
    )
    : observerConsultation;

  const queued = queue.filter((c) => c.status === 'QUEUED');
  const docId = consultation?.id ?? queued[0]?.id;
  const attachments = docId
    ? await safeAsync('attachments', () => api.getAttachments(docId), [])
    : [];

  return {
    consultation,
    inProgressList: inProgress,
    queue,
    stats,
    attachmentCount: attachments.length,
    notificationCount: notifications.length,
  };
}

export function collectRealtimeConsultationIds(
  consultation: Consultation | null,
  queue: Consultation[],
  limit = 10,
): string[] {
  const ids = new Set<string>();
  if (consultation?.id) ids.add(consultation.id);
  queue
    .filter((c) => c.status === 'QUEUED' || c.status === 'IN_PROGRESS')
    .slice(0, limit)
    .forEach((c) => ids.add(c.id));
  return [...ids];
}
