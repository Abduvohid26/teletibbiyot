'use client';

import { useEffect, useMemo } from 'react';
import { useVideoRoom } from '@/hooks/use-video-room';
import { UtVideoPanelView } from '@/components/video/UtVideoPanelView';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { Consultation } from '@/lib/api';
import { useVitalsStream } from '@/hooks/use-vitals-stream';
import { useMonitorVitalsReader } from '@/hooks/use-monitor-vitals-reader';
import { isUtStreamLive } from '@/lib/ut-camera-streams';

interface UtConsultationSessionProps {
  consultation: Consultation;
  patientName?: string;
}

/** UT: barcha kameralar + vital qurilmalar oqimida */
export function UtConsultationSession({ consultation, patientName }: UtConsultationSessionProps) {
  const video = useVideoRoom({
    consultationId: consultation.id,
    role: 'ut',
    enabled: true,
    skipPreflight: consultation.status === 'QUEUED',
  });

  const equipmentStream = useMemo(
    () => video.utCameraStreams.find((c) => c.id === 'equipment')?.stream ?? null,
    [video.utCameraStreams],
  );

  const { reading, analyzing } = useMonitorVitalsReader({
    stream: equipmentStream,
    consultationId: consultation.id,
    enabled: isUtStreamLive(equipmentStream),
    intervalMs: 4000,
  });

  const { connected, sendVitals } = useVitalsStream(consultation.id, 'send');

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => sendVitals(reading), 1000);
    return () => clearInterval(interval);
  }, [connected, reading, sendVitals]);

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
          vitalsReading={reading}
          vitalsAnalyzing={analyzing}
          defaultView="equipment"
        />
      </div>
    </>
  );
}
