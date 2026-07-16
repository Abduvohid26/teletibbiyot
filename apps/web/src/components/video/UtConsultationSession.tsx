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

/** UT tomonda bitta video hook — 5 kamera sloti (4 UT + shifokor) + vital */
export function UtConsultationSession({ consultation, patientName }: UtConsultationSessionProps) {
  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: true,
  });

  const vitals = consultation.clinicalRecord?.vitalSigns || {};
  const streamFor = (id: string) => video.utCameraStreams.find((c) => c.id === id)?.stream ?? null;
  const monitorStream =
    streamFor('equipment')
    ?? streamFor('room')
    ?? video.vitalsStream
    ?? null;

  return (
    <>
      {video.preflightPending && (
        <VideoPreflightModal role="ut" onConfirm={video.confirmPreflight} onCancel={video.cancelPreflight} />
      )}
      <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 lg:gap-3 items-stretch">
        {!video.preflightPending && (
          <div className="min-h-0 flex flex-col">
            <CameraVitalsMonitor
              consultationId={consultation.id}
              patientName={patientName ?? consultation.patient.fullName}
              initialVitals={vitals as Record<string, number>}
              sharedVideoStream={monitorStream}
              monitorMode
              compact
            />
          </div>
        )}
        <div className="min-h-0 flex flex-col">
          <UtVideoPanelView
            video={video}
            doctorName={consultation.mtDoctor?.fullName}
            consultationStatus={consultation.status}
            patientName={patientName ?? consultation.patient.fullName}
          />
        </div>
      </div>
    </>
  );
}
