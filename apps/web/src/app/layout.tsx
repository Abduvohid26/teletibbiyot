import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { OfflineBootstrap } from '@/components/OfflineBootstrap';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { BRAND } from '@ishifo/shared';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,  description: 'Uzoq masofadagi tibbiyot muassasalari va Markaziy shifoxona o\'rtasida AI-yordamida masofaviy konsultatsiya',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-scroll-behavior="smooth">
      <body>
        <OfflineBootstrap />
        <ToastProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
