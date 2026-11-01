import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Cpu,
  FileText,
  MessageSquareText,
  PhoneCall,
  PlugZap,
  UserMinus,
  UserPlus,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { isAdminRole, isMtDoctor, isUtRole } from '@ishifo/shared';
import type { AppNotification, NotificationType } from '@/lib/api';
import type { RingtoneKind, SoundKind } from '@/lib/sounds';

/**
 * Qo'ng'iroq turi:
 *  - consilium   — mas'ul shifokor konsilium shifokorini chaqiryapti
 *  - doctorReady — shifokor qabulni boshladi, UT operatorni kutyapti
 *  - newPatient  — UT shifokorga bemor yubordi
 *  - emergency   — favqulodda bemor
 */
export type CallKind = 'consilium' | 'doctorReady' | 'newPatient' | 'emergency';

export interface NotificationPresentation {
  icon: LucideIcon;
  /** Ikonka foni/rangi */
  tone: string;
  sound: SoundKind | null;
  call: { kind: CallKind; ringtone: RingtoneKind } | null;
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
  gold: 'bg-gold-50 text-gold-700',
};

/** Rolga qarab: qaysi bildirishnoma qo'ng'iroq bo'lib jiringlaydi, qaysi biri faqat ovoz */
export function presentationOf(n: Pick<AppNotification, 'type'>, role: string): NotificationPresentation {
  const type: NotificationType = n.type ?? 'info';
  const doctor = isMtDoctor(role);
  const ut = isUtRole(role);
  switch (type) {
    case 'consilium_call':
      return { icon: PhoneCall, tone: TONES.green, sound: null, call: doctor ? { kind: 'consilium', ringtone: 'call' } : null };
    case 'consultation_started':
      return { icon: Video, tone: TONES.green, sound: ut ? null : 'chime', call: ut ? { kind: 'doctorReady', ringtone: 'call' } : null };
    case 'consultation_queued':
      return { icon: UserPlus, tone: TONES.brand, sound: null, call: doctor ? { kind: 'newPatient', ringtone: 'call' } : null };
    case 'emergency':
      return { icon: AlertTriangle, tone: TONES.red, sound: 'alert', call: doctor ? { kind: 'emergency', ringtone: 'urgent' } : null };
    case 'consilium_invite':
      return { icon: Users, tone: TONES.brand, sound: 'chime', call: null };
    case 'consilium_joined':
      return { icon: UserPlus, tone: TONES.green, sound: 'chime', call: null };
    case 'consilium_opinion':
      return { icon: MessageSquareText, tone: TONES.gold, sound: 'chime', call: null };
    case 'consilium_left':
    case 'consilium_removed':
      return { icon: UserMinus, tone: TONES.amber, sound: 'chime', call: null };
    case 'consultation_completed':
    case 'report_ready':
      return { icon: type === 'report_ready' ? FileText : CheckCircle2, tone: TONES.green, sound: 'chime', call: null };
    case 'consultation_cancelled':
      return { icon: XCircle, tone: TONES.amber, sound: 'chime', call: null };
    case 'appointment':
      return { icon: CalendarClock, tone: TONES.brand, sound: 'chime', call: null };
    case 'second_opinion':
      return { icon: MessageSquareText, tone: TONES.brand, sound: 'chime', call: null };
    case 'device_offline':
      return { icon: PlugZap, tone: TONES.red, sound: 'alert', call: null };
    case 'ai_unavailable':
      return { icon: Cpu, tone: TONES.amber, sound: 'alert', call: null };
    default:
      return { icon: Bell, tone: TONES.slate, sound: 'chime', call: null };
  }
}

/** Bildirishnoma bosilganda qayerga o'tiladi (rolga qarab) */
export function notificationHref(n: AppNotification, role: string): string | null {
  const type = n.type ?? 'info';
  if (isAdminRole(role)) return '/admin';
  if (isUtRole(role)) {
    if (type === 'consultation_started') return '/ut/vitals';
    if (type === 'report_ready' || type === 'consultation_completed') return '/ut/patients?filter=tashxis';
    if (type === 'consultation_cancelled') return '/ut/patients';
    return n.consultationId ? '/ut/patients' : null;
  }
  if (isMtDoctor(role)) {
    if (type === 'appointment') return '/dashboard/appointments';
    if (
      type === 'consilium_call'
      || type === 'consilium_invite'
      || type === 'consilium_opinion'
      || type === 'consilium_left'
      || type === 'consilium_joined'
    ) {
      return '/dashboard';
    }
    return '/dashboard/patients';
  }
  return null;
}
