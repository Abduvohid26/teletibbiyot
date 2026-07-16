'use client';

import { useEffect, useState } from 'react';
import { useVideoRoom } from '@/hooks/use-video-room';
import { UtVideoPanelView } from '@/components/video/UtVideoPanelView';
import { VideoPreflightModal } from '@/components/video/VideoPreflightModal';
import { Consultation } from '@/lib/api';
import { VitalReading } from '@/lib/camera-vitals';
import { useVitalsStream } from '@/hooks/use-vitals-stream';
import { vitalsFromRecord } from '@/components/vitals/VitalsOverlayBar';

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

  const initial = vitalsFromRecord(consultation.clinicalRecord?.vitalSigns as Record<string, number> | undefined);
  const [reading, setReading] = useState<VitalReading>(initial);
  const { connected, sendVitals } = useVitalsStream(consultation.id, 'send');

  useEffect(() => {
    setReading(vitalsFromRecord(consultation.clinicalRecord?.vitalSigns as Record<string, number> | undefined));
  }, [consultation.id, consultation.clinicalRecord?.vitalSigns]);

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
          onVitalsChange={setReading}
          defaultView="equipment"
        />
      </div>
    </>
  );
}
