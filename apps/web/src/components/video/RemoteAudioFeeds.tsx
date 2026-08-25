'use client';

import { useEffect, useRef } from 'react';

interface RemoteAudioFeedsProps {
  feeds: Array<{ id: string; stream: MediaStream }>;
  /** Dinamik yoqilganmi (o'chirilgan bo'lsa hamma oqim susturiladi) */
  enabled: boolean;
}

/**
 * Har bir uzoq ishtirokchi uchun ALOHIDA <audio> elementi.
 *
 * Ilgari bitta element bo'lgani uchun konsiliumda ikkinchi shifokor ulanishi
 * bilan birinchisining ovozi almashib ketardi — natijada shifokorlar
 * bir-birini eshitmasdi.
 */
export function RemoteAudioFeeds({ feeds, enabled }: RemoteAudioFeedsProps) {
  return (
    <>
      {feeds.map((feed) => (
        <RemoteAudioFeed key={feed.id} stream={feed.stream} enabled={enabled} />
      ))}
    </>
  );
}

function RemoteAudioFeed({ stream, enabled }: { stream: MediaStream; enabled: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = !enabled;
    void el.play().catch(() => undefined);
  }, [stream, enabled]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
