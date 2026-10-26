import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { OfflineBootstrap } from '@/components/OfflineBootstrap';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { I18nProvider } from '@/i18n';
import { BRAND } from '@ishifo/shared';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,  description: 'Uzoq masofadagi tibbiyot muassasalari va Markaziy shifoxona o\'rtasida AI-yordamida masofaviy konsultatsiya',
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <I18nProvider>
          <OfflineBootstrap />
          <ToastProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
