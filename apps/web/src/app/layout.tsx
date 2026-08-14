import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { OfflineBootstrap } from '@/components/OfflineBootstrap';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { I18nProvider } from '@/i18n';
import { BRAND } from '@ishifo/shared';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,  description: 'Uzoq masofadagi tibbiyot muassasalari va Markaziy shifoxona o\'rtasida AI-yordamida masofaviy konsultatsiya',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <OfflineBootstrap />
        <ToastProvider>
          <I18nProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </I18nProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
