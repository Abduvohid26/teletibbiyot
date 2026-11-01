'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, CheckCheck, Loader2, MonitorSmartphone, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { presentationOf } from '@/lib/notification-meta';
import { playSound } from '@/lib/sounds';
import { toast } from '@/lib/toast';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { LOCALE_BCP47 } from '@/i18n/locales';

/** "5 daqiqa oldin" — oddiy, tilga mos */
function useRelativeTime() {
  const { t, locale } = useI18n();
  return (iso: string) => {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60_000);
    if (min < 1) return t('notify.justNow');
    if (min < 60) return t('notify.minutesAgo', { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('notify.hoursAgo', { n: h });
    return new Date(iso).toLocaleDateString(LOCALE_BCP47[locale], { day: 'numeric', month: 'short' });
  };
}

/**
 * Headerdagi qo'ng'iroqcha: o'qilmaganlar soni, oxirgi 50 ta bildirishnoma,
 * ovozni yoqish/o'chirish va brauzer bildirishnomalariga ruxsat.
 * Barcha rollarda bir xil (shifokor, UT operator, admin).
 */
export function NotificationBell({ className }: { className?: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const relative = useRelativeTime();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!ctx || !user) return null;
  const { items, unread, loading, markAllRead, soundEnabled, browserPermission } = ctx;
  const BellIcon = unread > 0 ? BellRing : Bell;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          // Ro'yxat ochilganda o'sha xabarlarning toastlari ustma-ust chiqmasin
          if (!open) toast.dismiss();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={unread > 0 ? t('notify.bellUnread', { count: unread }) : t('notify.bell')}
        title={t('notify.bell')}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
      >
        <BellIcon size={17} className={cn(unread > 0 && 'text-gold-300')} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white ring-2 ring-brand-950">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-x-3 top-16 z-[90] flex max-h-[min(34rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
          role="dialog"
          aria-label={t('notify.title')}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-brand-950">
              {t('notify.title')}
              {unread > 0 && <span className="ml-1.5 text-xs font-semibold text-rose-600">· {unread}</span>}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                <CheckCheck size={13} /> {t('notify.markAll')}
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> {t('common.loading')}
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell size={28} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">{t('notify.empty')}</p>
                <p className="mt-1 text-xs text-slate-500">{t('notify.emptyHint')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => {
                  const meta = presentationOf(n, user.role);
                  const Icon = meta.icon;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          ctx.open(n);
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                          !n.read && 'bg-brand-50/40',
                        )}
                      >
                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.tone)}>
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className={cn('flex-1 text-[13px] leading-snug', n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900')}>
                              {n.title}
                            </span>
                            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label={t('notify.unread')} />}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-slate-400">{relative(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                ctx.setSoundEnabled(next);
                if (next) playSound('chime');
              }}
              aria-pressed={soundEnabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {soundEnabled ? <Volume2 size={13} className="text-emerald-600" /> : <VolumeX size={13} className="text-slate-400" />}
              {soundEnabled ? t('notify.soundOn') : t('notify.soundOff')}
            </button>
            {browserPermission === 'default' && (
              <button
                type="button"
                onClick={ctx.requestBrowserPermission}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MonitorSmartphone size={13} className="text-brand-600" />
                {t('notify.enableBrowser')}
              </button>
            )}
            {browserPermission === 'denied' && (
              <span className="text-[11px] text-slate-500">{t('notify.browserDenied')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
