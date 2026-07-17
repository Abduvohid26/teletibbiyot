'use client';

import { useVideoRoom } from '@/hooks/use-video-room';
import { UtVideoPanelView } from '@/components/video/UtVideoPanelView';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { Consultation } from '@/lib/api';

interface UtConsultationSessionProps {
  consultation: Consultation;
  patientName?: string;
}

/** UT: barcha kameralar video oqimi */
export function UtConsultationSession({ consultation, patientName }: UtConsultationSessionProps) {
  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: true,
    skipPreflight: consultation.status === 'QUEUED',
  });

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
          defaultView="equipment"
        />
      </div>
    </>
  );
}
