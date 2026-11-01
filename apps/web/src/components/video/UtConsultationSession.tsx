'use client';

import { useEffect, useState } from 'react';
import { useVideoRoom } from '@/hooks/use-video-room';
import { UtVideoPanelView } from '@/components/video/UtVideoPanelView';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { VideoLobby } from '@/components/video/VideoLobby';
import { VideoRoomPresence } from '@/components/video/VideoRoomPresence';
import { Consultation } from '@/lib/api';
import {
  wasJoined,
  markJoined,
  CALL_ACCEPTED_EVENT,
  clearJoined,
  clearOtherJoined,
} from '@/lib/video-room-session';
import { fetchIceServers } from '@/lib/video-config';
import { announceMediaPresence } from '@/lib/video-socket-client';
import { useDoctorPresence } from '@/hooks/use-doctor-presence';
import { AloneInRoomPrompt, useAloneInRoom } from '@/components/video/AloneInRoomPrompt';
import { useRoomPresence } from '@/hooks/use-room-presence';
import { useRing } from '@/hooks/use-ring';
import { useI18n } from '@/i18n';

interface UtConsultationSessionProps {
  consultation: Consultation;
  patientName?: string;
}

/** UT: Meet-uslubidagi video xona — refreshda auto-rejoin */
export function UtConsultationSession({ consultation, patientName }: UtConsultationSessionProps) {
  // Lobbyda shifokor holatini ko'rsatish uchun — operator kutish kerakmi yoki yo'qmi bilsin
  const doctorPresence = useDoctorPresence(consultation.mtDoctor?.id);
  const [joined, setJoined] = useState(() => wasJoined(consultation.id));
  const [autoRejoin, setAutoRejoin] = useState(() => wasJoined(consultation.id));

  useEffect(() => {
    // ICE warm-up — Join oldidan TURN/STUN xatolarini erta ko'rsatish
    void fetchIceServers();
  }, []);

  useEffect(() => {
    clearOtherJoined(consultation.id);
    const restore = wasJoined(consultation.id);
    setJoined(restore);
    setAutoRejoin(restore);
  }, [consultation.id]);

  useEffect(() => {
    // Yakunlanish operatorni xonadan chiqarmaydi (Meet): ichkarida odam bor ekan
    // suhbat davom etadi, oxirgisi chiqqanda server xonani yopadi
    if (consultation.status === 'CANCELLED') {
      clearJoined(consultation.id);
      setJoined(false);
      setAutoRejoin(false);
    }
  }, [consultation.id, consultation.status]);

  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: joined,
    leadDoctorId: consultation.mtDoctor?.id,
    skipPreflight: consultation.status === 'QUEUED' || autoRejoin,
    autoRejoin,
  });

  useEffect(() => {
    if (video.roomClosed || video.sessionKicked) {
      clearJoined(consultation.id);
      setJoined(false);
      setAutoRejoin(false);
    }
  }, [video.roomClosed, video.sessionKicked, consultation.id]);

  const handleJoin = () => {
    markJoined(consultation.id, 'ut');
    setAutoRejoin(false);
    setJoined(true);
  };

  // Shifokorlar ekranida "UT xonada" ko'rinishi uchun (konsilium paneli)
  const inMedia = joined && video.roomPhase !== 'room_closed';
  useEffect(() => {
    if (!inMedia) return;
    return announceMediaPresence(consultation.id);
  }, [inMedia, consultation.id]);

  // "Shifokor sizni kutmoqda" qo'ng'irog'i qabul qilindi — lobby'siz ulanamiz
  useEffect(() => {
    const onAccepted = (e: Event) => {
      if ((e as CustomEvent<{ consultationId?: string }>).detail?.consultationId !== consultation.id) return;
      markJoined(consultation.id, 'ut');
      setAutoRejoin(false);
      setJoined(true);
    };
    window.addEventListener(CALL_ACCEPTED_EVENT, onAccepted);
    return () => window.removeEventListener(CALL_ACCEPTED_EVENT, onAccepted);
  }, [consultation.id]);

  /**
   * Kamera biriktiruvi o'zgargach FAQAT o'sha katak almashtiriladi.
   * SFU xonasi uzilmaydi, qolgan kameralar va shifokor bilan aloqa saqlanadi.
   */
  const handleReconnect = () => video.applyCameraMapping();

  const handleLeave = () => {
    video.leaveCall();
    clearJoined(consultation.id);
    setJoined(false);
  };

  const sessionEnded = consultation.status === 'COMPLETED';
  const aloneState = useAloneInRoom(video.roomPhase, joined && !video.roomClosed);
  // Mas'ul xonada yo'q — operator uni chaqira oladi
  const { inRoom } = useRoomPresence(consultation.id, false);
  const ringer = useRing(consultation.id, inRoom);
  const leadId = consultation.mtDoctor?.id;
  const canRingLead =
    joined && !sessionEnded && !!leadId && !inRoom.has(leadId)
    && (consultation.status === 'IN_PROGRESS' || consultation.status === 'QUEUED');

  if (
    video.roomClosed
    || consultation.status === 'CANCELLED'
    // Yakunlangan va operator xonada emas — qayta kirish yo'q
    || (sessionEnded && !joined)
  ) {
    return (
      <div className="h-full min-h-0 flex flex-col relative rounded-xl overflow-hidden bg-brand-950">
        <VideoRoomPresence phase="room_closed" />
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <VideoLobby
          role="ut"
          peerName={consultation.mtDoctor?.fullName}
          consultationStatus={consultation.status}
          peerPresence={consultation.mtDoctor?.id ? doctorPresence.status : undefined}
          peerActiveCount={doctorPresence.activeCount}
          patientName={patientName ?? consultation.patient.fullName}
          onJoin={handleJoin}
        />
      </div>
    );
  }

  return (
    <>
      {video.preflightPending && (
        <VideoPreflightModal role="ut" onConfirm={video.confirmPreflight} onCancel={video.cancelPreflight} />
      )}
      <AloneInRoomPrompt
        open={aloneState.alone}
        sessionEnded={sessionEnded}
        onStay={aloneState.keepWaiting}
        onRing={leadId && !sessionEnded ? () => {
          aloneState.keepWaiting();
          void ringer.ring();
        } : undefined}
        onEnd={() => {
          aloneState.keepWaiting();
          handleLeave();
        }}
      />
      <div className="h-full min-h-0 flex flex-col">
        {sessionEnded && <SessionEndedBanner />}
        <UtVideoPanelView
          video={video}
          doctorName={consultation.mtDoctor?.fullName}
          patientName={patientName ?? consultation.patient.fullName}
          defaultView="doctor"
          onLeave={handleLeave}
          onApplyCameraMapping={handleReconnect}
          consultationStatus={consultation.status}
          ring={{ show: canRingLead, ringing: ringer.ringing, onRing: () => void ringer.ring() }}
        />
      </div>
    </>
  );
}

/** Mas'ul yakunladi, lekin xonada odam bor — suhbat davom etishi mumkin */
export function SessionEndedBanner() {
  const { t } = useI18n();
  return (
    <div className="mb-2 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-semibold">{t('video.sessionEndedTitle')}</span> {t('video.sessionEndedHint')}
    </div>
  );
}
