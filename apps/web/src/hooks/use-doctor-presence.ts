'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import type { DoctorOption } from '@/lib/api/types';

export type DoctorPresence = NonNullable<DoctorOption['presence']>;

export interface DoctorPresenceState {
  status: DoctorPresence;
  activeCount: number;
}

/**
 * Bitta shifokorning jonli holati (online / in_meet / break / offline) va yuklamasi.
 * Boshlang'ich qiymat `/users/doctors` dan, keyingi o'zgarishlar staff-feed socketidan.
 */
export function useDoctorPresence(doctorId?: string | null): DoctorPresenceState {
  const [state, setState] = useState<DoctorPresenceState>({ status: 'offline', activeCount: 0 });

  useEffect(() => {
    if (!doctorId) {
      setState({ status: 'offline', activeCount: 0 });
      return;
    }
    let cancelled = false;
    api
      .getDoctors()
      .then((doctors) => {
        if (cancelled) return;
        const found = doctors.find((d) => d.id === doctorId);
        if (found) {
          setState({ status: found.presence ?? 'offline', activeCount: found.activeCount ?? 0 });
        }
      })
      .catch(() => {
        /* holat ko'rsatkichi — xatolikni jim o'tkazamiz */
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  useConsultationRealtime(
    [],
    {
      onDoctorPresenceUpdated: ({ doctorId: id, status, activeCount }) => {
        if (!doctorId || id !== doctorId) return;
        setState((prev) => ({ status, activeCount: activeCount ?? prev.activeCount }));
      },
    },
    { staffFeed: true, enabled: !!doctorId },
  );

  return state;
}
