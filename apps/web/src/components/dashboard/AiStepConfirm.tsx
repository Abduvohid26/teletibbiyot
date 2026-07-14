'use client';

import { useState } from 'react';
import { api, AiAnalysisStep } from '@/lib/api';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn, toUserMessage } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface AiStepConfirmProps {
  consultationId?: string;
  steps?: AiAnalysisStep[];
  onConfirmed?: () => void;
  canConfirm?: boolean;
  compact?: boolean;
}

export function AiStepConfirm({ consultationId, steps, onConfirmed, canConfirm, compact }: AiStepConfirmProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (!steps?.length || !consultationId) return null;

  const pending = steps.filter((s) => s.status === 'DONE' && s.step !== 'DATA_COLLECTION' && !s.doctorConfirmed);

  const handleConfirm = async (stepId: string) => {
    setConfirmingId(stepId);
    try {
      await api.confirmAiStep(consultationId, stepId);
      onConfirmed?.();
    } catch (err) {
      toast(toUserMessage(err, 'Tasdiqlashda xatolik'), 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
      {steps.map((step) => (
        <div key={step.id} className={cn(
          'flex items-center justify-between rounded-lg bg-slate-50',
          compact ? 'text-[10px] py-0.5 px-1' : 'text-xs py-1.5 px-2',
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {step.doctorConfirmed ? (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            ) : step.status === 'IN_PROGRESS' ? (
              <Loader2 size={14} className="text-brand-500 animate-spin shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-slate-200 shrink-0" />
            )}
            <span className="truncate text-slate-700">{step.label}</span>
          </div>
          {canConfirm && step.status === 'DONE' && !step.doctorConfirmed && step.step !== 'DATA_COLLECTION' && (
            <button
              type="button"
              disabled={confirmingId === step.id}
              onClick={() => handleConfirm(step.id)}
              className="text-[10px] font-semibold text-brand-600 hover:underline shrink-0 disabled:opacity-50"
            >
              {confirmingId === step.id ? '...' : 'Tasdiqlash'}
            </button>
          )}
        </div>
      ))}
      {canConfirm && pending.length > 0 && !compact && (
        <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2">
          Yakuniy tashxisdan oldin {pending.length} ta AI bosqichini tasdiqlang
        </p>
      )}
    </div>
  );
}
