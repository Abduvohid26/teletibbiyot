'use client';

import { Video, Mic, CheckCircle2, X } from 'lucide-react';
import { MediaDevicePanel } from './MediaDevicePanel';

interface VideoPreflightModalProps {
  role: 'mt' | 'ut';
  onConfirm: () => void;
  onCancel?: () => void;
}

export function VideoPreflightModal({ role, onConfirm, onCancel }: VideoPreflightModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Video size={20} className="text-brand-600" />
              Konsultatsiya oldidan tekshiruv
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Kamera, mikrofon va internet sifatini tekshiring</p>
          </div>
          {onCancel && (
            <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-5">
          <MediaDevicePanel role={role} compact />
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Bekor qilish
            </button>
          )}
          <button type="button" onClick={onConfirm} className="btn-primary flex items-center gap-2">
            <CheckCircle2 size={16} />
            <Mic size={14} /> Konsultatsiyani boshlash
          </button>
        </div>
      </div>
    </div>
  );
}
