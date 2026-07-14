'use client';

import { Consultation, AiAnalysisStep, DeviceStatus } from '@/lib/api';
import { formatStatus, formatTriage, cn } from '@/lib/utils';
import { AiStepConfirm } from '@/components/dashboard/AiStepConfirm';
import { ChatTranscript } from '@/components/dashboard/ChatTranscript';
import { ClientDateText } from '@/components/ui/ClientDateText';
import {
  CheckCircle2, Circle, Loader2, ListOrdered, Brain, Wifi, Zap,
  UserPlus, FileText, Monitor, Video, MessageSquare, Clock, Activity,
} from 'lucide-react';

interface BottomPanelsProps {
  queue: Consultation[];
  consultationId?: string;
  aiSteps?: AiAnalysisStep[];
  aiAnalysis?: { diagnoses: Array<{ name: string; icd10Code: string }>; triageLevel: string };
  devices?: DeviceStatus[];
  onQuickAction?: (action: string) => void;
  onStartConsultation?: (id: string) => void;
  canStartConsultation?: boolean;
  canConfirmAi?: boolean;
  onAiConfirmed?: () => void;
  onDocumentsChange?: () => void;
  showPatientDocuments?: boolean;
  compact?: boolean;
}

function PanelShell({
  icon: Icon,
  title,
  iconColor,
  children,
  compact,
  className,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('glass-panel h-full flex flex-col min-h-0 overflow-hidden', compact && '!rounded-xl', className)}>
      <div className={cn('glass-header shrink-0', compact ? 'py-1 px-2' : 'py-2.5 px-3')}>
        <Icon size={compact ? 12 : 14} className={iconColor} />
        <span className={cn('panel-title', compact ? 'text-[10px]' : 'text-xs')}>{title}</span>
      </div>
      <div className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden', compact ? 'px-1.5 py-1' : 'panel-body pt-2 pb-3')}>
        {children}
      </div>
    </div>
  );
}

export function ConsultationQueue({
  queue,
  onStartConsultation,
  canStartConsultation = false,
  compact,
}: {
  queue: Consultation[];
  onStartConsultation?: (id: string) => void;
  canStartConsultation?: boolean;
  compact?: boolean;
}) {
  const queued = queue.filter((c) => c.status === 'QUEUED' || c.status === 'IN_PROGRESS');

  return (
    <PanelShell icon={ListOrdered} title="Navbat" iconColor="text-brand-600" compact={compact}>
      <div className={cn('space-y-1', compact ? '' : 'space-y-1.5')}>
        {queued.map((c) => {
          const status = formatStatus(c.status);
          return (
            <div
              key={c.id}
              className={cn(
                'flex items-center justify-between rounded-lg transition-all duration-200 group gap-1 glass-preview-card !p-1.5',
                compact ? 'text-[10px]' : 'text-xs',
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-brand-700 bg-brand-50/80 px-1.5 py-0.5 rounded-md text-[10px] shrink-0">
                  {c.utFacility.code}
                </span>
                <span className="text-slate-600 truncate group-hover:text-slate-900">
                  {c.patient.fullName.split(' ')[0]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canStartConsultation && c.status === 'QUEUED' && onStartConsultation && (
                  <button
                    type="button"
                    onClick={() => onStartConsultation(c.id)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Boshlash
                  </button>
                )}
                <span className={cn('status-badge', status.className)}>{status.label}</span>
              </div>
            </div>
          );
        })}
        {queued.length === 0 && (
          <div className="space-y-1.5 py-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-preview-card flex items-center gap-2 opacity-60">
                <div className="w-8 h-4 shimmer-line !h-3 rounded-md" />
                <div className="flex-1 shimmer-line !h-3" />
                <div className="w-12 shimmer-line !h-3 rounded-full" />
              </div>
            ))}
            <p className="text-[10px] text-slate-400 text-center pt-1">Navbat bo&apos;sh — yangi bemor kutilmoqda</p>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function AiProcessSteps({
  steps,
  consultationId,
  canConfirm,
  onConfirmed,
  compact,
}: {
  steps?: AiAnalysisStep[];
  consultationId?: string;
  canConfirm?: boolean;
  onConfirmed?: () => void;
  compact?: boolean;
}) {
  const displaySteps = steps?.length ? steps : [];

  return (
    <PanelShell icon={Brain} title="AI jarayon" iconColor="text-violet-600" compact={compact}>
      {steps?.length ? (
        <AiStepConfirm
          consultationId={consultationId}
          steps={steps}
          canConfirm={canConfirm}
          onConfirmed={onConfirmed}
          compact={compact}
        />
      ) : consultationId ? (
        <div className="space-y-1.5">
          {displaySteps.length > 0 ? displaySteps.map((step, i) => (
            <div key={step.id || i} className="flex items-center gap-2 text-[10px] glass-preview-card !p-1.5">
              {step.status === 'DONE' ? (
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              ) : step.status === 'IN_PROGRESS' ? (
                <Loader2 size={13} className="text-violet-500 animate-spin shrink-0" />
              ) : (
                <Circle size={13} className="text-slate-300 shrink-0" />
              )}
              <span className="text-slate-600 truncate">{step.label}</span>
            </div>
          )) : (
            <p className="text-[10px] text-slate-400 text-center py-2">AI tahlil kutilmoqda...</p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-slate-400 text-center py-2">Faol konsultatsiya yo&apos;q</p>
      )}
    </PanelShell>
  );
}

export function AiReportSummary({ analysis, compact }: { analysis?: BottomPanelsProps['aiAnalysis']; compact?: boolean }) {
  const triage = formatTriage(analysis?.triageLevel);
  const diagnosis = analysis?.diagnoses?.[0];

  return (
    <PanelShell icon={FileText} title="AI xulosa" iconColor="text-indigo-600" compact={compact}>
      {diagnosis ? (
        <div className={cn('rounded-xl glass-preview-card border-indigo-100/50', compact ? '!p-1.5' : '!p-3')}>
          <p className={cn('font-bold text-slate-900 leading-snug', compact ? 'text-[10px] line-clamp-2' : 'text-sm')}>
            {diagnosis.name}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{diagnosis.icd10Code}</p>
          <div className="mt-2 pt-2 border-t border-white/40">
            <span className="text-[10px] text-slate-500">Xavf: </span>
            <span className={cn('text-xs font-bold', triage.color)}>{triage.label}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 py-1">
          <div className="glass-preview-card !p-2 space-y-1.5">
            <div className="shimmer-line w-3/4" />
            <div className="shimmer-line w-1/2" />
            <div className="h-1.5 bg-slate-100/80 rounded-full overflow-hidden mt-2">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 animate-pulse-soft" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 text-center">Tahlil kutilmoqda...</p>
        </div>
      )}
    </PanelShell>
  );
}

export function DeviceStatusPanel({ devices, compact }: { devices?: DeviceStatus[]; compact?: boolean }) {
  const displayDevices = devices ?? [];

  return (
    <PanelShell icon={Wifi} title="Qurilmalar" iconColor="text-emerald-600" compact={compact}>
      {displayDevices.length === 0 ? (
        <p className="text-[10px] text-slate-400 text-center py-2">Qurilma ma&apos;lumoti yo&apos;q</p>
      ) : (
      <div className="space-y-1">
        {displayDevices.slice(0, compact ? 5 : undefined).map((d) => (
          <div key={d.id} className={cn('flex items-center justify-between glass-preview-card !py-1 !px-1.5', compact ? 'text-[10px]' : 'text-xs')}>
            <span className="text-slate-600 truncate pr-2">{d.name}</span>
            <span
              className={cn(
                'text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                d.connected
                  ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-300/40'
                  : 'bg-red-500/15 text-red-600 ring-1 ring-red-300/40',
              )}
            >
              {d.connected ? (d.status === 'good' ? 'Ulangan' : 'Ogohl.') : 'Uzilgan'}
            </span>
          </div>
        ))}
      </div>
      )}
    </PanelShell>
  );
}

function SessionStatusPanel({ compact, hasConsultation }: { compact?: boolean; hasConsultation?: boolean }) {
  return (
    <PanelShell icon={Clock} title="Sessiya" iconColor="text-sky-600" compact={compact}>
      <div className="space-y-1.5">
        <div className="glass-preview-card !p-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Vaqt</span>
          <ClientDateText
            className="text-xs font-bold text-slate-800"
            format={{ hour: '2-digit', minute: '2-digit' }}
          />
        </div>
        <div className="glass-preview-card !p-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Holat</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', hasConsultation ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700')}>
            {hasConsultation ? 'Faol' : 'Kutilmoqda'}
          </span>
        </div>
        <div className="glass-preview-card !p-2 flex items-center gap-2">
          <Activity size={12} className="text-brand-500 shrink-0" />
          <span className="text-[10px] text-slate-600">Real vaqt monitoring yoqilgan</span>
        </div>
      </div>
    </PanelShell>
  );
}

const QUICK_ACTIONS = [
  { id: 'new-consultation', label: 'Yangi konsultatsiya', icon: Video, primary: true },
  { id: 'add-patient', label: 'Bemor qo\'shish', icon: UserPlus },
  { id: 'create-report', label: 'Hisobot yaratish', icon: FileText },
  { id: 'device-check', label: 'Qurilma tekshiruvi', icon: Monitor },
];

export function QuickActions({ onAction, compact }: { onAction?: (action: string) => void; compact?: boolean }) {
  return (
    <PanelShell icon={Zap} title="Amallar" iconColor="text-amber-500" compact={compact}>
      <div className={cn('grid gap-1', compact ? 'grid-cols-2' : 'grid-cols-2 gap-1.5')}>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction?.(action.id)}
            className={cn(
              'flex items-center gap-1 font-semibold rounded-lg transition-all duration-200 text-left',
              compact ? 'text-[9px] py-1 px-1.5' : 'text-[10px] py-2.5 px-2.5 rounded-xl',
              action.primary
                ? 'gradient-btn col-span-2 !justify-start shadow-glow'
                : 'glass-preview-card hover:!bg-white/60 text-slate-700',
            )}
          >
            <action.icon size={compact ? 11 : 13} className={action.primary ? 'text-white/90' : 'text-slate-400'} />
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

export function BottomPanels({
  queue,
  consultationId,
  aiSteps,
  aiAnalysis,
  devices,
  onQuickAction,
  onStartConsultation,
  canStartConsultation,
  canConfirmAi,
  onAiConfirmed,
  showPatientDocuments,
  compact,
}: BottomPanelsProps) {
  if (showPatientDocuments) {
    return (
      <div className={cn('h-full min-h-0 grid gap-1.5', compact ? 'grid-cols-8' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3')}>
        <ConsultationQueue
          queue={queue}
          onStartConsultation={onStartConsultation}
          canStartConsultation={canStartConsultation}
          compact={compact}
        />
        <AiProcessSteps
          steps={aiSteps}
          consultationId={consultationId}
          canConfirm={canConfirmAi}
          onConfirmed={onAiConfirmed}
          compact={compact}
        />
        <AiReportSummary analysis={aiAnalysis} compact={compact} />
        <DeviceStatusPanel devices={devices} compact={compact} />
        <SessionStatusPanel compact={compact} hasConsultation={!!consultationId} />
        <div className="min-h-0 overflow-hidden col-span-2">
          <PanelShell icon={MessageSquare} title="Chat arxiv" iconColor="text-violet-500" compact={compact}>
            <ChatTranscript consultationId={consultationId} compact={compact} />
          </PanelShell>
        </div>
        <QuickActions onAction={onQuickAction} compact={compact} />
      </div>
    );
  }

  return (
    <div className={cn('h-full min-h-0 grid gap-1.5', compact ? 'grid-cols-5' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3')}>
      <ConsultationQueue
        queue={queue}
        onStartConsultation={onStartConsultation}
        canStartConsultation={canStartConsultation}
        compact={compact}
      />
      <AiProcessSteps
        steps={aiSteps}
        consultationId={consultationId}
        canConfirm={canConfirmAi}
        onConfirmed={onAiConfirmed}
        compact={compact}
      />
      <AiReportSummary analysis={aiAnalysis} compact={compact} />
      <DeviceStatusPanel devices={devices} compact={compact} />
      <QuickActions onAction={onQuickAction} compact={compact} />
    </div>
  );
}
