import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { Header } from '../components/ui/Header';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const dmsans = DM_Sans({ subsets: ['latin'], variable: '--font-dmsans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Fuzzy Flo — 3D Bouquet Visualizer',
  description: 'Lihat buket bunga kawat bulu Fuzzy Flo dalam 3D dan bandingkan ukurannya dengan tinggi badan.',
  icons: { icon: '/brand/logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fbf7f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${fraunces.variable} ${dmsans.variable}`}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
