'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { TopBar } from '@/components/layout/TopBar';
import { VideoConsultation } from '@/components/dashboard/VideoConsultation';
import { PatientInfo } from '@/components/dashboard/PatientInfo';
import { AiAnalysisPanel } from '@/components/dashboard/AiAnalysisPanel';
import { BottomPanels } from '@/components/dashboard/BottomPanels';
import { PatientDocumentsPanel } from '@/components/dashboard/PatientDocumentsPanel';
import { Consultation, DeviceStatus } from '@/lib/api';

interface ObserverDashboardViewProps {
  consultation: Consultation | null;
  inProgressList: Consultation[];
  queue: Consultation[];
  devices: DeviceStatus[];
  attachmentCount: number;
  documentsConsultationId?: string;
  error: string;
  onReload: () => void;
  onQuickAction: (action: string) => void;
  onSelectConsultation: (id: string) => void;
}

export function ObserverDashboardView({
  consultation,
  inProgressList,
  queue,
  devices,
  attachmentCount,
  documentsConsultationId,
  error,
  onReload,
  onQuickAction,
  onSelectConsultation,
}: ObserverDashboardViewProps) {
  return (
    <SidebarProvider>
      <div className="page-shell">
        <Sidebar />
        <div className="page-main">
          <TopBar />
          <div className="page-content flex flex-col gap-4 !py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 flex justify-between gap-3">
                <span>{error}</span>
                <button type="button" onClick={onReload} className="text-xs font-semibold underline shrink-0">
                  Qayta
                </button>
              </div>
            )}

            {inProgressList.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {inProgressList.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectConsultation(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                      consultation?.id === c.id
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {c.utFacility.code} — {c.patient.fullName}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
              <div className="col-span-12 lg:col-span-5 min-h-[320px]">
                <VideoConsultation
                  facilityCode={consultation?.utFacility?.code}
                  consultationId={consultation?.id}
                  onEndCall={onReload}
                  observeMode
                />
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-3 min-h-[280px]">
                <PatientInfo
                  patient={consultation?.patient}
                  clinicalRecord={consultation?.clinicalRecord}
                  consultationId={consultation?.id}
                />
              </div>
              <div className="col-span-12 sm:col-span-6 lg:col-span-4 min-h-[240px] panel overflow-hidden flex flex-col">
                <div className="shrink-0 px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Bemor hujjatlari (UT → Markaz)</span>
                  {attachmentCount > 0 && (
                    <span className="text-[10px] font-bold bg-brand-600 text-white px-2 py-0.5 rounded-full">
                      {attachmentCount}
                    </span>
                  )}
                </div>
                <PatientDocumentsPanel
                  consultationId={documentsConsultationId}
                  allowUpload={false}
                  onChange={onReload}
                  className="flex-1 min-h-0 px-2"
                />
              </div>
              <div className="col-span-12 min-h-[200px]">
                <AiAnalysisPanel
                  analysis={consultation?.aiAnalysis}
                  consultationId={consultation?.id}
                  onRefresh={onReload}
                />
              </div>
            </div>

            <BottomPanels
              queue={queue}
              consultationId={consultation?.id}
              consultationStartedAt={consultation?.startedAt}
              aiSteps={consultation?.aiAnalysisSteps}
              aiAnalysis={consultation?.aiAnalysis}
              devices={devices}
              onAiConfirmed={onReload}
              onQuickAction={onQuickAction}
            />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
