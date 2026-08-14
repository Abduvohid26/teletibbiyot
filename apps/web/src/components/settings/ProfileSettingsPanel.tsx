'use client';

import { useEffect, useState } from 'react';
import { Pencil, Save, X, Building2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface ProfileSettingsPanelProps {
  compact?: boolean;
}

export function ProfileSettingsPanel({ compact }: ProfileSettingsPanelProps) {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!editing) {
      setFullName(user?.fullName ?? '');
      setPhone(user?.phone ?? '');
    }
  }, [user?.fullName, user?.phone, editing]);

  const resetForm = () => {
    setFullName(user?.fullName ?? '');
    setPhone(user?.phone ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: {
        fullName?: string;
        phone?: string | null;
        currentPassword?: string;
        newPassword?: string;
      } = {};

      const trimmedName = fullName.trim();
      if (trimmedName && trimmedName !== (user?.fullName ?? '')) {
        payload.fullName = trimmedName;
      }
      const trimmedPhone = phone.trim();
      if (trimmedPhone !== (user?.phone ?? '')) {
        payload.phone = trimmedPhone || null;
      }
      if (newPassword.trim()) {
        payload.newPassword = newPassword.trim();
        payload.currentPassword = currentPassword;
      }

      if (!payload.fullName && payload.phone === undefined && !payload.newPassword) {
        toast(t('profile.noChanges'), 'info');
        setEditing(false);
        return;
      }

      await api.updateProfile(payload);
      if (payload.newPassword) {
        toast(t('profile.passwordUpdated'), 'success');
      }
      await refreshUser();
      toast(t('profile.updated'), 'success');
      resetForm();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const inputClass = cn(
    'input w-full',
    compact ? '!py-1.5 !text-sm' : '!text-sm',
  );

  return (
    <div className={cn(compact ? 'space-y-3' : 'space-y-4')}>
      <div className="flex items-center justify-between gap-2">
        {!compact && (
          <p className="text-xs text-slate-500">
            {t('profile.hint')}
          </p>
        )}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              'inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800',
              compact ? 'text-xs ml-auto' : 'btn-secondary !py-1.5 !px-3 !text-xs ml-auto',
            )}
          >
            <Pencil size={compact ? 13 : 14} />
            {t('common.edit')}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="btn-secondary !py-1.5 !px-2.5 !text-xs inline-flex items-center gap-1"
            >
              <X size={13} />
              {t('profile.cancelShort')}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="gradient-btn !py-1.5 !px-2.5 !text-xs inline-flex items-center gap-1"
            >
              <Save size={13} />
              {saving ? t('profile.saving') : t('common.save')}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className={cn('space-y-3', compact && 'text-sm')}>
          <Field label={t('profile.fullName')} compact={compact}>
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profile.fullNamePlaceholder')}
            />
          </Field>
          <Field label={t('profile.phone')} compact={compact}>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998..."
            />
          </Field>
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('profile.changePassword')}</p>
            <Field label={t('profile.currentPassword')} compact={compact}>
              <input
                type="password"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label={t('profile.newPassword')} compact={compact}>
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={t('profile.minChars')}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className={cn(compact ? 'space-y-2' : 'space-y-0')}>
          <InfoRow label={t('profile.fullName')} value={user.fullName} compact={compact} />
          <InfoRow label={t('profile.email')} value={user.email} compact={compact} />
          <InfoRow label={t('profile.phone')} value={user.phone || '—'} compact={compact} />
          <InfoRow label={t('profile.role')} value={user.role} compact={compact} />
          <InfoRow label={t('profile.facility')} value={user.facility?.name || '—'} icon={Building2} compact={compact} />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className={cn('font-medium text-slate-600', compact ? 'text-xs' : 'text-sm')}>{label}</span>
      {children}
    </label>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  compact,
}: {
  label: string;
  value?: string;
  icon?: React.ElementType;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-col gap-0.5 min-w-0 border-b border-slate-50 last:border-0 py-1">
        <span className="text-slate-500 flex items-center gap-1 text-xs">
          {Icon ? <Icon size={12} /> : <User size={12} className="opacity-0 w-3" aria-hidden />}
          {label}
        </span>
        <span className="font-medium text-slate-800 truncate text-sm">{value || '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-500 flex items-center gap-1.5 text-sm">
        {Icon && <Icon size={14} />}
        {label}
      </span>
      <span className="font-medium text-slate-800 text-right truncate ml-2 text-sm">{value || '—'}</span>
    </div>
  );
}
