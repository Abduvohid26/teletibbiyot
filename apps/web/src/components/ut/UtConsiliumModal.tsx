'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Loader2, MessageSquareText, Stethoscope, Users, Video, X } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { doctorLabel, useConsilium } from '@/hooks/use-consilium';
import { ConsiliumDoctorPicker } from '@/components/dashboard/ConsiliumDoctorPicker';
import { cn } from '@/lib/utils';
import { MemberStatus, memberStatusDot, useRoomPresence } from '@/hooks/use-room-presence';
import { useInviteLink } from '@/hooks/use-invite-link';

function statusText(status: MemberStatus, t: (k: string) => string) {
  if (status === 'in_room') return t('consilium.statusInRoomLong');
  if (status === 'online') return t('consilium.statusOnlineLong');
  if (status === 'in_meet') return t('consilium.statusInMeetLong');
  if (status === 'break') return t('consilium.statusBreakLong');
  return t('consilium.statusOfflineLong');
}
import { useI18n } from '@/i18n';

interface UtConsiliumModalProps {
  consultation: Consultation | null;
  open: boolean;
  onClose: () => void;
  /** Ro'yxat o'zgargach bemorlar ro'yxatini yangilash */
  onChanged?: () => void;
}

/**
 * UT operator uchun konsilium oynasi — bemorga bir nechta shifokorni biriktirish.
 * Mas'ul shifokor o'zgarmaydi; bu yerda unga QO'SHIMCHA shifokorlar qo'shiladi.
 */
export function UtConsiliumModal({ consultation, open, onClose, onChanged }: UtConsiliumModalProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  const editable = consultation?.status === 'QUEUED' || consultation?.status === 'IN_PROGRESS';
  const { participants, options, add, remove, loadDoctors, busy, loading } = useConsilium({
    consultation,
    canEdit: !!open && !!editable,
    onChanged,
  });

  const { statusOf } = useRoomPresence(open ? consultation?.id : undefined);
  const invite = useInviteLink(consultation?.id);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    // Shifokorlar holati (online / Meetda) har ochilganda yangilanadi
    void loadDoctors();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, consultation?.id, loadDoctors]);

  if (!mounted || !open || !consultation) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-lg max-h-[92dvh] min-h-0 flex flex-col shadow-2xl animate-slide-up overflow-hidden">
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-slate-100 bg-white/90">
          <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 text-sm truncate">{t('consilium.title')}</h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">{consultation.patient.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('consilium.lead')}
            </p>
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-brand-50/80 ring-1 ring-brand-200/70">
              <Stethoscope size={14} className="text-brand-600 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-brand-900 truncate">
                  {consultation.mtDoctor?.fullName ?? t('common.emptyDash')}
                </span>
                {consultation.mtDoctor?.id && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span className={cn('h-1.5 w-1.5 rounded-full', memberStatusDot(statusOf(consultation.mtDoctor.id)))} />
                    {statusText(statusOf(consultation.mtDoctor.id), t)}
                  </span>
                )}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              {t('consilium.title')}
              {loading && <Loader2 size={10} className="animate-spin text-slate-400" />}
            </p>
            {participants.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">{t('consilium.empty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {participants.map((p) => (
                  <li
                    key={p.doctorId}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded-xl ring-1',
                      statusOf(p.doctorId) === 'in_room'
                        ? 'bg-emerald-50/80 ring-emerald-200/70'
                        : p.joinedAt
                          ? 'bg-slate-50 ring-slate-200'
                          : 'bg-amber-50/80 ring-amber-200/80',
                    )}
                  >
                    {statusOf(p.doctorId) === 'in_room' ? (
                      <Video size={14} className="text-emerald-600 shrink-0" />
                    ) : (
                      <Stethoscope size={14} className="text-amber-600 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 truncate">
                        {doctorLabel(p.doctor)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span className={cn('h-1.5 w-1.5 rounded-full', memberStatusDot(statusOf(p.doctorId)))} />
                        {!p.joinedAt && statusOf(p.doctorId) !== 'in_room'
                          ? `${t('consilium.invitedHint')} · ${statusText(statusOf(p.doctorId), t)}`
                          : statusText(statusOf(p.doctorId), t)}
                      </span>
                    </span>
                    {p.opinion?.trim() && (
                      <MessageSquareText
                        size={14}
                        className="text-slate-400 shrink-0"
                        aria-label={t('consilium.hasOpinion')}
                      />
                    )}
                    {editable && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(p.doctorId)}
                        aria-label={t('consilium.remove')}
                        className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editable ? (
            <div className="pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('consilium.inviteDoctors')}
              </p>
              <ConsiliumDoctorPicker options={options} busy={busy} onAdd={add} />
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t('consilium.closedHint')}</p>
          )}
        </div>

        <div className="shrink-0 flex gap-2 border-t border-slate-100 p-3 sm:p-4">
          {editable && (
            <button
              type="button"
              onClick={() => void invite.copy()}
              disabled={invite.busy}
              title={t('consilium.linkTitle')}
              className="btn-secondary flex-1 inline-flex items-center justify-center gap-1.5"
            >
              {invite.busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {t('consilium.linkCopy')}
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
