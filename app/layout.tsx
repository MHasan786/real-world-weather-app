import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'WeatherNow — Live Global Weather & 5-Day Forecast',
  description:
    'Live Global Weather & 5-Day Forecast dashboard with real-time meteorological data, dynamic atmospheric themes, geolocation, and unit conversion.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'WeatherNow — Live Global Weather & 5-Day Forecast',
    description:
      'Live Global Weather & 5-Day Forecast dashboard with real-time meteorological data, dynamic atmospheric themes, geolocation, and unit conversion.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeatherNow — Live Global Weather & 5-Day Forecast',
    description:
      'Live Global Weather & 5-Day Forecast dashboard with real-time meteorological data, dynamic atmospheric themes, geolocation, and unit conversion.',
  },
};

const EXTENSION_ERROR_GUARD = `(function(){if(typeof window==='undefined')return;window.addEventListener('error',function(e){var msg=(e&&e.message)||'';var src=(e&&e.filename)||'';var stack=(e&&e.error&&e.error.stack)||'';if(msg.indexOf('ResizeObserver loop')!==-1||src.indexOf('chrome-extension://')===0||src.indexOf('moz-extension://')===0||stack.indexOf('chrome-extension://')!==-1||stack.indexOf('moz-extension://')!==-1){e.preventDefault();e.stopImmediatePropagation();}},true);})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EXTENSION_ERROR_GUARD }} />
      </head>
      <body className="font-sans antialiased selection:bg-white/25" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
