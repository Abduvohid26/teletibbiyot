import { api, Consultation, DashboardStats, DeviceStatus } from '@/lib/api';
import { safeAsync } from '@/lib/errors';

export interface DashboardSnapshot {
  consultation: Consultation | null;
  inProgressList: Consultation[];
  queue: Consultation[];
  stats: DashboardStats | null;
  devices: DeviceStatus[];
  attachmentCount: number;
  notificationCount: number;
}

export async function loadDashboardSnapshot(params: {
  isDoctor: boolean;
  observedId: string | null;
}): Promise<DashboardSnapshot> {
  const { isDoctor, observedId } = params;

  const [active, queue, stats, inProgress, notifications] = await Promise.all([
    isDoctor ? api.getActiveConsultation() : Promise.resolve(null),
    api.getQueue(),
    api.getStats(),
    api.getInProgressConsultations(),
    isDoctor ? safeAsync('notifications', () => api.getNotifications(true), []) : Promise.resolve([]),
  ]);

  const observerConsultation = !isDoctor
    ? inProgress.find((c) => c.id === observedId) ?? inProgress[0] ?? null
    : null;
  const consultation = isDoctor ? active : observerConsultation;

  const queued = queue.filter((c) => c.status === 'QUEUED');
  const facilityId = consultation?.utFacility?.id ?? queued[0]?.utFacility?.id;

  const devices = facilityId
    ? await api.getDevices(facilityId)
    : [];

  const docId = consultation?.id ?? queued[0]?.id;
  const attachments = docId
    ? await safeAsync('attachments', () => api.getAttachments(docId), [])
    : [];

  return {
    consultation,
    inProgressList: inProgress,
    queue,
    stats,
    devices,
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
