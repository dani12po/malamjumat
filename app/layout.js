import './globals.css';
import Script from 'next/script';
import { headers } from 'next/headers';
import { getSettings } from '@/lib/db';
import { splitAdScripts, parseAdUnit } from '@/lib/ads';
import AdProvider from './AdProvider';
import AdSessionManager from './AdSessionManager';
import AdDebugPanel from './AdDebugPanel';
import StickyFooterAd from './StickyFooterAd';

export const metadata = {
  title: 'Drive Video',
  robots: 'noindex, nofollow'
};

// Selalu render fresh per request agar konten user tidak terjebak cache static
// (pernah kejadian: fallback kosong ke-cache). Settings iklan sendiri di-cache
// 30 detik via getSettings (cukup segar, tahan cold-start Neon).
export const dynamic = 'force-dynamic';

function adFlags(settings) {
  return {
    maxAdsPerPage: Number(settings?.maxAdsPerPage ?? 10),
    maxAdsPerSession: Number(settings?.maxAdsPerSession ?? 0),
    stickyFooter: settings?.stickyFooter !== false,
    refreshSeconds: Number(settings?.refreshSeconds ?? 0),
    isolateBanners: settings?.isolateBanners === true
  };
}

export default async function RootLayout({ children }) {
  let settings = {};
  try {
    settings = (await getSettings()) || {};
  } catch {
    settings = {};
  }
  // Script src-only dimuat di <head> sebelum interaktif = tayang cepat.
  // Unit body + metadata dioper ke pool client (tanpa duplikat antar slot).
  const { headSrcs, bodyHtml } = splitAdScripts(settings);
  const units = bodyHtml.map((html) => ({ html, ...parseAdUnit(html) }));
  const flags = adFlags(settings);
  // /admin steril total dari iklan (cek server-side via middleware).
  const pageIsAdmin = (headers().get('x-pathname') || '').startsWith('/admin');
  const showDebug = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_AD_DEBUG === '1';
  return (
    <html lang="id">
      <body>
        <AdProvider units={units} flags={flags}>
          {children}
          {!pageIsAdmin && <AdSessionManager />}
          {!pageIsAdmin && <StickyFooterAd />}
          {showDebug && !pageIsAdmin && <AdDebugPanel />}
          {!pageIsAdmin && headSrcs.map((src) => (
            <Script key={src} src={src} strategy="beforeInteractive" data-cfasync="false" />
          ))}
        </AdProvider>
      </body>
    </html>
  );
}
