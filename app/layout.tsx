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
        <link rel="icon" href="/logo-bg.png" />
        <meta name="theme-color" content="#0049af" />
        <link rel="apple-touch-icon" href="/logo-bg.png" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then(reg => console.log('SW registered:', reg))
                .catch(err => console.log('SW registration failed:', err));
            }
          `}
        </Script>
      </body>
    </html>
  );
}
