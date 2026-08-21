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
  clearJoined,
  clearOtherJoined,
} from '@/lib/video-room-session';
import { fetchIceServers } from '@/lib/video-config';
import { useDoctorPresence } from '@/hooks/use-doctor-presence';

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
    if (consultation.status === 'COMPLETED' || consultation.status === 'CANCELLED') {
      clearJoined(consultation.id);
      setJoined(false);
      setAutoRejoin(false);
    }
  }, [consultation.id, consultation.status]);

  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: joined,
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

  /** Kamera biriktiruvi o'zgargach oqimlarni qayta olish — chiqib, darhol qayta kiramiz */
  const handleReconnect = () => {
    video.leaveCall();
    setJoined(false);
    setAutoRejoin(true);
    // Xona tozalanishi uchun bir kadr kutamiz, so'ng qayta ulanadi
    setTimeout(() => setJoined(true), 0);
  };

  const handleLeave = () => {
    video.leaveCall();
    clearJoined(consultation.id);
    setJoined(false);
  };

  if (video.roomClosed || consultation.status === 'COMPLETED' || consultation.status === 'CANCELLED') {
    return (
      <div className="h-full min-h-0 flex flex-col relative rounded-xl overflow-hidden bg-slate-950">
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
      <div className="h-full min-h-0 flex flex-col">
        <UtVideoPanelView
          video={video}
          doctorName={consultation.mtDoctor?.fullName}
          patientName={patientName ?? consultation.patient.fullName}
          defaultView="doctor"
          onLeave={handleLeave}
          onReconnect={handleReconnect}
        />
      </div>
    </>
  );
}
