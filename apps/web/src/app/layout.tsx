import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { MfaRequiredGate } from '@/components/auth/MfaRequiredGate';
import { ServiceWorkerCleanup } from '@/components/ServiceWorkerCleanup';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { BRAND } from '@ishifo/shared';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,  description: 'Uzoq masofadagi tibbiyot muassasalari va Markaziy shifoxona o\'rtasida AI-yordamida masofaviy konsultatsiya',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(r) { r.unregister(); });
                });
              }
              if (window.caches) {
                caches.keys().then(function(keys) {
                  keys.forEach(function(k) { caches.delete(k); });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <ServiceWorkerCleanup />
        <ToastProvider>
          <AuthProvider>
            <MfaRequiredGate>{children}</MfaRequiredGate>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
