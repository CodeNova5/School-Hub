// @ts-expect-error CSS imports are handled by Next.js
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'School Management System',
  description: 'Comprehensive school management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#0049af" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
        <Script id="sw-register" strategy="afterInteractive">
          {`
            function registerServiceWorker() {
              if (!('serviceWorker' in navigator)) {
                console.warn('Service Workers not supported');
                return;
              }

              navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then(reg => {
                  console.log('✓ Service Worker registered:', reg.scope);
                  // Check for updates periodically
                  setInterval(() => {
                    reg.update().catch(err => console.log('SW update check failed:', err));
                  }, 60000); // Check every minute
                })
                .catch(err => {
                  console.error('✗ Service Worker registration failed:', err);
                  // Retry after 5 seconds
                  setTimeout(() => {
                    console.log('Retrying Service Worker registration...');
                    registerServiceWorker();
                  }, 5000);
                });
            }

            // Register on page load
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', registerServiceWorker);
            } else {
              registerServiceWorker();
            }

            // Check for controller change (SW activation)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              console.log('✓ Service Worker controller changed (new version active)');
            });
          `}
        </Script>
      </body>
    </html>
  );
}
