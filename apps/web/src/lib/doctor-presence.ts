import type { DoctorOption } from '@/lib/api';

export type DoctorPresence = NonNullable<DoctorOption['presence']>;
type T = (key: string, vars?: Record<string, string | number>) => string;

const PRESENCE_RANK: Record<DoctorPresence, number> = {
  online: 0,
  in_meet: 1,
  break: 2,
  offline: 3,
};

export function presenceLabel(status: DoctorPresence | undefined, t: T) {
  if (status === 'online') return t('presence.online');
  if (status === 'in_meet') return t('presence.inMeet');
  if (status === 'break') return t('presence.break');
  return t('presence.offline');
}

export function presenceDotClass(status: DoctorPresence | undefined) {
  if (status === 'online') return 'bg-emerald-500';
  if (status === 'in_meet') return 'bg-amber-500';
  if (status === 'break') return 'bg-orange-400';
  return 'bg-slate-400';
}

export function presenceHint(status: DoctorPresence | undefined, t: T) {
  if (status === 'in_meet') return t('presence.doctorInMeet');
  if (status === 'break') return t('presence.doctorBreak');
  if (status === 'online') return t('presence.doctorOnline');
  return t('presence.doctorOffline');
}

/** Bir xil holatdagilar ichida yuklamasi kamrog'i tepada — operator bo'shini tanlasin */
export function loadLabel(doctor: DoctorOption, t: T) {
  const count = doctor.activeCount ?? 0;
  return count === 0 ? t('presence.free') : t('presence.loadCount', { count });
}

export function sortDoctorsByPresence(list: DoctorOption[], localeTag = 'uz-UZ') {
  return [...list].sort((a, b) => {
    const ra = PRESENCE_RANK[a.presence || 'offline'];
    const rb = PRESENCE_RANK[b.presence || 'offline'];
    if (ra !== rb) return ra - rb;
    const la = a.activeCount ?? 0;
    const lb = b.activeCount ?? 0;
    if (la !== lb) return la - lb;
    return a.fullName.localeCompare(b.fullName, localeTag);
  });
}
