const ACTIVE_CONSULTATION_KEY = 'ishifo:active-consultation';

export function readActiveConsultationId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACTIVE_CONSULTATION_KEY);
}

export function writeActiveConsultationId(id: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACTIVE_CONSULTATION_KEY, id);
}

export function clearActiveConsultationId() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACTIVE_CONSULTATION_KEY);
}
