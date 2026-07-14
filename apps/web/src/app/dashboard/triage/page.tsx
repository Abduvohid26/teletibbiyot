'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AuthPageGate } from '@/components/auth/AuthLoadingScreen';
import { api, Consultation } from '@/lib/api';
import { formatStatus } from '@/lib/utils';
import { AlertTriangle, ArrowUpCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ROLES_MT_DASHBOARD } from '@/lib/roles';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';

export default function TriagePage() {
  const { user, loading, authError, retryAuth } = useRequireAuth([...ROLES_MT_DASHBOARD]);
  const [queue, setQueue] = useState<Consultation[]>([]);
  const [error, setError] = useState('');
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [pendingTriage, setPendingTriage] = useState<{ id: string; level: string } | null>(null);
  const [pendingPriority, setPendingPriority] = useState<{ id: string; priority: number } | null>(null);

  const load = useCallback(() => {
    api.getQueue()
      .then(setQueue)
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'));
  }, []);

  const realtimeIds = useMemo(
    () => queue.filter((c) => c.status === 'QUEUED' || c.status === 'IN_PROGRESS').map((c) => c.id),
    [queue],
  );

  useConsultationRealtime(realtimeIds, {
    onConsultationStarted: () => load(),
    onConsultationCompleted: () => load(),
    onAttachmentUploaded: () => load(),
  });

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [user, loading, load]);

  const handleEscalate = async (id: string, level: 'SENIOR_REVIEW' | 'EMERGENCY') => {
    setEscalatingId(id);
    try {
      await api.escalateConsultation(id, level, level === 'EMERGENCY' ? 'Triage hamshira favqulodda eskalatsiya' : 'Katta shifokor ko\'rib chiqishi kerak');
      toast(level === 'EMERGENCY' ? 'Favqulodda eskalatsiya yuborildi' : 'Katta shifokorga yuborildi', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Eskalatsiya xatosi', 'error');
    } finally {
      setEscalatingId(null);
    }
  };

  const handleTriage = async (id: string, level: string) => {
    try {
      await api.updateTriage(id, level);
      toast('Triage yangilandi', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Xatolik', 'error');
    } finally {
      setPendingTriage(null);
    }
  };

  const handlePriority = async (id: string, priority: number) => {
    try {
      await api.updatePriority(id, priority);
      toast('Ustuvorlik oshirildi', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Xatolik', 'error');
    } finally {
      setPendingPriority(null);
    }
  };

  const queued = queue.filter((c) => c.status === 'QUEUED');
  const inProgress = queue.filter((c) => c.status === 'IN_PROGRESS');

  return (
    <AuthPageGate loading={loading} user={user} authError={authError} retryAuth={retryAuth}>
      <DashboardLayout title="Triage navbat va eskalatsiya">
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>}

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-600">
            Navbatdagi va jarayondagi konsultatsiyalar real vaqtda yangilanadi.
          </p>
          <button type="button" onClick={load} className="btn-secondary text-sm">
            <RefreshCw size={14} /> Yangilash
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <QueueSection title="Navbatda" icon={Clock} items={queued} escalatingId={escalatingId} onEscalate={handleEscalate} onTriage={(id, level) => setPendingTriage({ id, level })} onPriority={(id, p) => setPendingPriority({ id, priority: p })} />
          <QueueSection title="Jarayonda" icon={AlertTriangle} items={inProgress} escalatingId={escalatingId} onEscalate={handleEscalate} onTriage={(id, level) => setPendingTriage({ id, level })} onPriority={(id, p) => setPendingPriority({ id, priority: p })} />
        </div>

        {pendingTriage && (
          <ConfirmDialog
            title="Triage darajasini o'zgartirish"
            message={`Triage darajasini "${pendingTriage.level}" ga o'zgartirasizmi?`}
            onCancel={() => setPendingTriage(null)}
            onConfirm={() => handleTriage(pendingTriage.id, pendingTriage.level)}
          />
        )}
        {pendingPriority && (
          <ConfirmDialog
            title="Ustuvorlikni oshirish"
            message="Bu konsultatsiyaning ustuvorligini oshirasizmi?"
            onCancel={() => setPendingPriority(null)}
            onConfirm={() => handlePriority(pendingPriority.id, pendingPriority.priority)}
          />
        )}
      </DashboardLayout>
    </AuthPageGate>
  );
}

function QueueSection({
  title,
  icon: Icon,
  items,
  escalatingId,
  onEscalate,
  onTriage,
  onPriority,
}: {
  title: string;
  icon: React.ElementType;
  items: Consultation[];
  escalatingId: string | null;
  onEscalate: (id: string, level: 'SENIOR_REVIEW' | 'EMERGENCY') => void;
  onTriage: (id: string, level: string) => void;
  onPriority: (id: string, priority: number) => void;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <Icon size={16} />
        <span className="panel-title">{title}</span>
        <span className="ml-auto text-xs font-semibold text-slate-500">{items.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">Hozircha yo&apos;q</p>
        ) : (
          items.map((c) => {
            const status = formatStatus(c.status);
            return (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{c.patient.fullName}</p>
                    <p className="text-xs text-slate-500">{c.utFacility.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Shifokor: {c.mtDoctor?.fullName || '—'}
                    </p>
                  </div>
                  <span className={`status-badge ${status.className}`}>{status.label}</span>
                </div>
                {c.clinicalRecord?.complaints && (
                  <p className="text-xs text-slate-600 line-clamp-2">{c.clinicalRecord.complaints}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <select
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) onTriage(c.id, e.target.value); e.target.value = ''; }}
                  >
                    <option value="">Triage...</option>
                    <option value="LOW">Past</option>
                    <option value="MEDIUM">O&apos;rta</option>
                    <option value="HIGH">Yuqori</option>
                    <option value="EMERGENCY">Favqulodda</option>
                  </select>
                  <button type="button" onClick={() => onPriority(c.id, 10)} className="text-xs px-2 py-1.5 rounded-lg bg-amber-50 text-amber-800 font-medium">
                    ↑ Ustuvor
                  </button>
                  <button
                    type="button"
                    disabled={escalatingId === c.id}
                    onClick={() => onEscalate(c.id, 'SENIOR_REVIEW')}
                    className="btn-secondary text-xs !py-1.5"
                  >
                    <ArrowUpCircle size={14} /> Katta shifokor
                  </button>
                  <button
                    type="button"
                    disabled={escalatingId === c.id}
                    onClick={() => onEscalate(c.id, 'EMERGENCY')}
                    className="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                  >
                    <AlertTriangle size={14} className="inline mr-1" />
                    Favqulodda
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary !text-xs">Bekor</button>
          <button type="button" onClick={onConfirm} className="gradient-btn !text-xs">Tasdiqlash</button>
        </div>
      </div>
    </div>
  );
}
