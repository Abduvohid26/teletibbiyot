'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, SecondOpinion } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isMtDoctor } from '@ishifo/shared';
import { MessageSquarePlus } from 'lucide-react';
import { toUserMessage } from '@/lib/utils';

interface SecondOpinionPanelProps {
  consultationId?: string;
  onRequested?: () => void;
}

export function SecondOpinionPanel({ consultationId, onRequested }: SecondOpinionPanelProps) {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string; specialty?: string }>>([]);
  const [opinions, setOpinions] = useState<SecondOpinion[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    if (!consultationId) return;
    api.getConsultation(consultationId)
      .then((c) => setOpinions(c.secondOpinions || []))
      .catch((err) => setMessage(toUserMessage(err)));
  }, [consultationId]);

  useEffect(() => {
    api.getDoctors().then(setDoctors).catch((err) => setMessage(toUserMessage(err)));
    load();
  }, [load]);

  if (!consultationId) return null;

  const submit = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await api.requestSecondOpinion(
        consultationId,
        question.trim(),
        assignedDoctorId || undefined,
      );
      setQuestion('');
      setAssignedDoctorId('');
      setMessage('Ikkinchi fikr so\'rovi yuborildi');
      load();
      onRequested?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async (opinionId: string) => {
    if (!responseText.trim()) return;
    setLoading(true);
    try {
      await api.respondSecondOpinion(opinionId, responseText.trim());
      setRespondingId(null);
      setResponseText('');
      load();
      setMessage('Javob yuborildi');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {opinions.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {opinions.map((o) => (
            <div key={o.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm">
              <p className="text-xs text-slate-500 mb-1">
                {o.requestedBy?.fullName || 'So\'rovchi'}
                {o.assignedDoctor ? ` → ${o.assignedDoctor.fullName}` : ''}
                · {o.status}
              </p>
              <p className="text-slate-800">{o.question}</p>
              {o.response && (
                <p className="mt-2 text-slate-700 bg-white rounded-lg p-2 border border-slate-100">
                  <span className="text-xs font-semibold text-violet-600">Javob: </span>
                  {o.response}
                </p>
              )}
              {!o.response && o.status === 'PENDING' && isMtDoctor(user?.role || '') && (
                respondingId === o.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      className="form-input min-h-[60px] text-xs w-full"
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Javobingiz..."
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => submitResponse(o.id)} disabled={loading} className="btn-primary !text-xs !py-1.5">
                        Yuborish
                      </button>
                      <button type="button" onClick={() => setRespondingId(null)} className="btn-secondary !text-xs !py-1.5">
                        Bekor
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setRespondingId(o.id)} className="mt-2 text-xs text-violet-600 font-medium">
                    Javob berish
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquarePlus size={16} className="text-violet-600" />
          <h3 className="font-semibold text-sm text-slate-900">Yangi so&apos;rov</h3>
        </div>
        {doctors.length > 0 && (
          <select
            className="form-input text-xs mb-2"
            value={assignedDoctorId}
            onChange={(e) => setAssignedDoctorId(e.target.value)}
          >
            <option value="">Shifokor tanlang (ixtiyoriy)</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName}{d.specialty ? ` (${d.specialty})` : ''}</option>
            ))}
          </select>
        )}
        <textarea
          className="form-input min-h-[72px] text-sm"
          placeholder="Murakkab holat — ikkinchi shifokordan fikr so'rang..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !question.trim()}
          className="btn-secondary !text-xs mt-2 w-full disabled:opacity-50"
        >
          {loading ? 'Yuborilmoqda...' : 'So\'rov yuborish'}
        </button>
        {message && <p className="text-xs text-slate-600 mt-2">{message}</p>}
      </div>
    </div>
  );
}
