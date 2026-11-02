'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, Loader2, LogOut, MessageSquareText, PhoneCall, Plus, Users, Video, X } from 'lucide-react';
import { Consultation, ConsultationParticipant } from '@/lib/api';
import { doctorLabel, useConsilium } from '@/hooks/use-consilium';
import { ConsiliumDoctorPicker } from '@/components/dashboard/ConsiliumDoctorPicker';
import { ConsiliumOpinionsModal } from '@/components/dashboard/ConsiliumOpinionsModal';
import { MemberStatus, memberStatusDot, useRoomPresence } from '@/hooks/use-room-presence';
import { useInviteLink } from '@/hooks/use-invite-link';
import { useRing } from '@/hooks/use-ring';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { isInLiveCall, MEDIA_PRESENCE_EVENT } from '@/lib/video-socket-client';

interface ConsiliumPanelProps {
  consultation: Consultation | null;
  /** Joriy foydalanuvchi (shifokor) id si */
  currentDoctorId?: string;
  /** Ro'yxat o'zgargach yuqoridagi ma'lumotni yangilash */
  onChanged?: () => void;
  /** Bemor paneli ichida — o'z kartasi va chekkasisiz */
  embedded?: boolean;
}

/**
 * Konsilium — bitta bemorga bir vaqtda bir nechta shifokorni ulash.
 *
 * Mas'ul shifokor (consultation.mtDoctor) bir yo'la bir nechta shifokorni taklif
 * qiladi; taklif qilingan shifokorga darhol "Ulanish" xabari boradi. Har bir
 * maslahatchi o'z fikrini yozadi — mas'ul shifokor hammasini ko'rib yakunlaydi.
 */
export function ConsiliumPanel({ consultation, currentDoctorId, onChanged, embedded }: ConsiliumPanelProps) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [opinionsOpen, setOpinionsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const ownerId = consultation?.mtDoctor?.id ?? null;
  const isOwner = !!currentDoctorId && !!ownerId && currentDoctorId === ownerId;
  const canEdit =
    isOwner && (consultation?.status === 'IN_PROGRESS' || consultation?.status === 'QUEUED');

  const { participants, options, add, remove, saveOpinion, loadDoctors, busy, loading } = useConsilium({
    consultation,
    canEdit,
    onChanged,
  });

  const { statusOf: serverStatusOf, inRoom } = useRoomPresence(
    participants.length > 0 || canEdit ? consultation?.id : undefined,
  );
  // O'zim haqimda server emas, shu tab biladi: lobby'da turganimda eski (toza yopilmagan)
  // sessiyam sabab "xonada" deb ko'rinmasin
  const selfLive = useSelfInCall(consultation?.id);
  const statusOf = (userId?: string | null): MemberStatus => {
    const status = serverStatusOf(userId);
    if (!userId || userId !== currentDoctorId) return status;
    if (selfLive) return 'in_room';
    return status === 'in_room' ? 'online' : status;
  };
  const mine = participants.find((p) => p.doctorId === currentDoctorId);
  const isConsultant = !isOwner && !!mine;
  const invite = useInviteLink(consultation?.id);
  const roomOpen = consultation?.status === 'IN_PROGRESS' || consultation?.status === 'QUEUED';
  const ringer = useRing(consultation?.id, inRoom);
  /** Xonada bo'lmagan hamkasbni chaqirish (konsilium a'zolari bir-birini) */
  const ringable = (userId?: string | null) =>
    !!userId && userId !== currentDoctorId && roomOpen && (isOwner || isConsultant) && statusOf(userId) !== 'in_room';
  const opinionCount = participants.filter((p) => p.opinion?.trim()).length;

  useEffect(() => {
    setPickerOpen(false);
    setOpinionsOpen(false);
  }, [consultation?.id]);

  // Tashqariga bosilsa yoki Esc — taklif ro'yxati yopiladi
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const openPicker = () => {
    setPickerOpen((v) => !v);
    // Holatlar (online / Meetda) eskirgan bo'lmasin
    if (!pickerOpen) void loadDoctors();
  };

  const handleAdd = async (ids: string[]) => {
    const ok = await add(ids);
    if (ok) setPickerOpen(false);
    return ok;
  };

  if (!consultation) return null;
  // Qo'shish imkoni ham yo'q, ishtirokchi ham yo'q — panelni ko'rsatishning hojati yo'q
  if (!canEdit && participants.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1.5',
        embedded ? 'min-w-0' : 'shrink-0 mb-2 ut-glass-card px-2.5 py-1.5',
      )}
    >
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
        <Users size={12} className="text-brand-600" />
        {t('consilium.title')}
        {loading && <Loader2 size={10} className="animate-spin text-slate-400" />}
      </span>

      {consultation.mtDoctor?.fullName && (
        <span
          title={t(statusKey(statusOf(ownerId)))}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 ring-1 ring-brand-200/70"
        >
          <StatusDot status={statusOf(ownerId)} />
          {consultation.mtDoctor.fullName}
          <span className="opacity-70">· {t('consilium.lead')}</span>
          {ownerId === currentDoctorId && <span className="opacity-70">· {t('consilium.you')}</span>}
          <StatusText status={statusOf(ownerId)} />
          {ringable(ownerId) && (
            <RingButton ringing={ringer.ringingIds.includes(ownerId!)} onRing={() => void ringer.ring(ownerId!)} />
          )}
        </span>
      )}

      {participants.map((p) => (
        <ParticipantChip
          key={p.doctorId}
          p={p}
          isMe={p.doctorId === currentDoctorId}
          status={statusOf(p.doctorId)}
          ring={ringable(p.doctorId)
            ? { ringing: ringer.ringingIds.includes(p.doctorId), onRing: () => void ringer.ring(p.doctorId) }
            : undefined}
          canRemove={isOwner}
          busy={busy}
          onRemove={() => void remove(p.doctorId, p.doctorId === currentDoctorId)}
        />
      ))}

      {participants.length === 0 && canEdit && (
        <span className="text-[10px] text-slate-400">{t('consilium.empty')}</span>
      )}

      <div className={cn('flex items-center gap-1 shrink-0', !embedded && 'ml-auto')}>
        {canEdit && (
          <div ref={pickerRef} className="relative">
            <button
              type="button"
              onClick={openPicker}
              aria-expanded={pickerOpen}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-2 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-brand-800"
            >
              <Plus size={11} />
              {t('consilium.inviteDoctors')}
            </button>
            {pickerOpen && (
              // Telefonda tugma o'ngda bo'lsa ro'yxat ekrandan chiqib ketardi — u yerda butun kenglikda
              <div className="fixed inset-x-4 top-24 z-50 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-[22rem]">
                <p className="mb-2 px-0.5 text-[11px] text-slate-500">{t('consilium.inviteHint')}</p>
                <ConsiliumDoctorPicker options={options} busy={busy} onAdd={handleAdd} />
              </div>
            )}
          </div>
        )}

        {roomOpen && (isOwner || isConsultant) && (
          <button
            type="button"
            onClick={() => void invite.copy()}
            disabled={invite.busy}
            title={t('consilium.linkTitle')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {invite.busy ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
            {t('consilium.link')}
          </button>
        )}

        {participants.length > 0 && (isOwner || isConsultant) && (
          <button
            type="button"
            onClick={() => setOpinionsOpen(true)}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors',
              isConsultant && !mine?.opinion
                ? 'bg-gold-400 text-brand-950 hover:bg-gold-300'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <MessageSquareText size={11} />
            {isConsultant
              ? mine?.opinion
                ? t('consilium.editOpinion')
                : t('consilium.writeOpinion')
              : t('consilium.opinionsCount', { count: opinionCount, total: participants.length })}
          </button>
        )}

        {isConsultant && (
          <button
            type="button"
            disabled={busy}
            onClick={() => currentDoctorId && void remove(currentDoctorId, true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 text-[10px] font-semibold px-2 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title={t('consilium.youAreConsultant')}
          >
            <LogOut size={11} /> {t('consilium.leave')}
          </button>
        )}
      </div>

      <ConsiliumOpinionsModal
        open={opinionsOpen}
        onClose={() => setOpinionsOpen(false)}
        consultation={consultation}
        participants={participants}
        currentDoctorId={currentDoctorId}
        busy={busy}
        onSave={saveOpinion}
      />
    </div>
  );
}

/** Shu tabda video'ga haqiqatan ulanganmi (VideoConsultation announceMediaPresence) */
function useSelfInCall(consultationId?: string) {
  const [live, setLive] = useState(() => isInLiveCall(consultationId));
  useEffect(() => {
    setLive(isInLiveCall(consultationId));
    if (!consultationId) return;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ consultationId?: string; live?: boolean }>).detail;
      if (detail?.consultationId === consultationId) setLive(!!detail.live);
    };
    window.addEventListener(MEDIA_PRESENCE_EVENT, onChange);
    return () => window.removeEventListener(MEDIA_PRESENCE_EVENT, onChange);
  }, [consultationId]);
  return live;
}

function statusKey(status: MemberStatus) {
  if (status === 'in_room') return 'consilium.statusInRoom';
  if (status === 'online') return 'consilium.statusOnline';
  if (status === 'in_meet') return 'consilium.statusInMeet';
  if (status === 'break') return 'consilium.statusBreak';
  return 'consilium.statusOffline';
}

/** Xonada bo'lmagan a'zoni chaqirish — chip ichidagi kichik telefon */
function RingButton({ ringing, onRing }: { ringing: boolean; onRing: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onRing}
      disabled={ringing}
      aria-label={ringing ? t('ring.calling') : t('ring.callMember')}
      title={ringing ? t('ring.calling') : t('ring.callMember')}
      className="rounded p-px text-emerald-700 hover:bg-emerald-100 disabled:opacity-70"
    >
      {ringing ? <Loader2 size={11} className="animate-spin" /> : <PhoneCall size={11} />}
    </button>
  );
}

function StatusDot({ status }: { status: MemberStatus }) {
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', memberStatusDot(status))} />;
}

/** Xonada bo'lsa yashil "xonada", aks holda — online / tanaffus / offline */
function StatusText({ status }: { status: MemberStatus }) {
  const { t } = useI18n();
  return (
    <span className={cn('font-medium', status === 'in_room' ? 'text-emerald-700' : 'opacity-60')}>
      · {t(statusKey(status))}
    </span>
  );
}

/**
 * Ishtirokchi: hozir xonada (yashil) / hali umuman kirmagan — taklif qilingan (sariq) /
 * kirib chiqib ketgan (kulrang). Holat real vaqtda.
 */
function ParticipantChip({
  p,
  isMe,
  status,
  ring,
  canRemove,
  busy,
  onRemove,
}: {
  p: ConsultationParticipant;
  isMe: boolean;
  status: MemberStatus;
  ring?: { ringing: boolean; onRing: () => void };
  canRemove: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const inRoom = status === 'in_room';
  const neverJoined = !p.joinedAt && !inRoom;
  return (
    <span
      title={neverJoined ? t('consilium.invitedHint') : t(statusKey(status))}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ring-1',
        inRoom
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/70'
          : neverJoined
            ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
            : 'bg-slate-50 text-slate-600 ring-slate-200',
      )}
    >
      {inRoom ? (
        <Video size={10} className="shrink-0" />
      ) : neverJoined ? (
        <Loader2 size={10} className="shrink-0 animate-spin [animation-duration:2.5s]" />
      ) : (
        <StatusDot status={status} />
      )}
      {doctorLabel(p.doctor)}
      {isMe && <span className="opacity-70">· {t('consilium.you')}</span>}
      {neverJoined ? <span className="opacity-70">· {t('consilium.invited')}</span> : <StatusText status={status} />}
      {p.opinion?.trim() && <MessageSquareText size={10} className="shrink-0 opacity-70" aria-label={t('consilium.hasOpinion')} />}
      {ring && <RingButton ringing={ring.ringing} onRing={ring.onRing} />}
      {canRemove && (
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          aria-label={t('consilium.remove')}
          className="rounded hover:bg-black/5 disabled:opacity-50"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
