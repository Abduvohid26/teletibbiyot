'use client';

import { useEffect, useState } from 'react';
import { useVideoRoom } from '@/hooks/use-video-room';
import { UtVideoPanelView } from '@/components/video/UtVideoPanelView';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { VideoLobby } from '@/components/video/VideoLobby';
import { Consultation } from '@/lib/api';

interface UtConsultationSessionProps {
  consultation: Consultation;
  patientName?: string;
}

/** UT: barcha kameralar video oqimi (Google Meet uslubi — "Jonli efirga qo'shilish") */
export function UtConsultationSession({ consultation, patientName }: UtConsultationSessionProps) {
  // Video sahifa ochilishi bilan emas, faqat efirga qo'shilgandan keyin ulanadi.
  // Refresh'da bu holat nolga tushadi → lobby qaytadi (Google Meet kabi).
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    setJoined(false);
  }, [consultation.id]);

  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: joined,
    skipPreflight: consultation.status === 'QUEUED',
  });

  if (!joined) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <VideoLobby
          role="ut"
          peerName={consultation.mtDoctor?.fullName}
          onJoin={() => setJoined(true)}
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
          onLeave={() => setJoined(false)}
        />
      </div>
    </>
  );
}
