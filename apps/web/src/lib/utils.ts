import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateAge(birthDate: string): number | null {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age < 0 || age > 130) return null;
  return age;
}

export function formatGender(gender: string): string {
  return gender === 'MALE' ? 'Erkak' : 'Ayol';
}

export function formatTriage(level?: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Past', color: 'text-emerald-600' },
    MEDIUM: { label: 'O\'rta', color: 'text-amber-600' },
    HIGH: { label: 'Yuqori', color: 'text-orange-600' },
    EMERGENCY: { label: 'Favqulodda', color: 'text-red-600' },
  };
  return map[level || 'LOW'] || map.LOW;
}

export { toUserMessage, AppError, safeAsync } from '@/lib/errors';

export function formatStatus(status: string): { labelKey: string; className: string } {
  const map: Record<string, { labelKey: string; className: string }> = {
    IN_PROGRESS: { labelKey: 'status.inProgress', className: 'status-in-progress' },
    QUEUED: { labelKey: 'status.queued', className: 'status-waiting' },
    COMPLETED: { labelKey: 'status.completed', className: 'status-completed' },
    CANCELLED: { labelKey: 'status.cancelled', className: 'status-cancelled' },
  };
  return map[status] || { labelKey: status, className: 'status-completed' };
}
