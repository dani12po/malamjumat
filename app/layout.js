import './globals.css';
import Script from 'next/script';
import { readDB } from '@/lib/db';
import { splitAdScripts } from '@/lib/ads';
import GlobalAds from './GlobalAds';

export const metadata = {
  title: 'Drive Video',
  robots: 'noindex, nofollow'
};

export default function RootLayout({ children }) {
  let settings = {};
  try {
    settings = readDB().settings || {};
  } catch {
    settings = {};
  }
  // Script src-only (mis: popunder) dimuat di <head> sebelum interaktif = tayang cepat.
  // Sisanya disuntik client via GlobalAds. Lihat lib/ads.js + docs Adsterra.
  const { headSrcs, bodyHtml } = splitAdScripts(settings);
  const clientSettings = { ...settings, adScripts: bodyHtml, popunderScript: '', customHeadScript: '' };
  return (
    <html lang="id">
      <body>
        {children}
        <GlobalAds settings={clientSettings} />
        {headSrcs.map((src) => (
          <Script key={src} src={src} strategy="beforeInteractive" data-cfasync="false" />
        ))}
      </body>
    </html>
  );
}
