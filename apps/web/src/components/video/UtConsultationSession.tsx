'use client';

import { useVideoRoom } from '@/hooks/use-video-room';
import { UtVideoPanelView } from '@/components/video/UtVideoPanelView';
import { CameraVitalsMonitor } from '@/components/vitals/CameraVitalsMonitor';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { Consultation } from '@/lib/api';

interface UtConsultationSessionProps {
  consultation: Consultation;
  patientName?: string;
}

/** UT tomonda bitta video hook — 4 kamera + vital + shifokor ko'rinishi */
export function UtConsultationSession({ consultation, patientName }: UtConsultationSessionProps) {
  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: true,
  });

  const vitals = consultation.clinicalRecord?.vitalSigns || {};

  return (
    <>
      {video.preflightPending && (
        <VideoPreflightModal role="ut" onConfirm={video.confirmPreflight} onCancel={video.cancelPreflight} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <UtVideoPanelView
          video={video}
          doctorName={consultation.mtDoctor?.fullName}
          consultationStatus={consultation.status}
          patientName={patientName ?? consultation.patient.fullName}
        />
        {!video.preflightPending && (
          <CameraVitalsMonitor
            consultationId={consultation.id}
            patientName={consultation.patient.fullName}
            initialVitals={vitals as Record<string, number>}
            sharedVideoStream={video.vitalsStream}
          />
        )}
      </div>
    </>
  );
}
