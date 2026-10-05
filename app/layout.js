import './globals.css';
import { headers } from 'next/headers';
import { getSettings } from '@/lib/db';
import { splitAdScripts, parseAdUnit } from '@/lib/ads';
import AdProvider from './AdProvider';
import AdAutoScripts from './AdAutoScripts';
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
    maxAdsPerPage: Number(settings?.maxAdsPerPage ?? 20),
    maxAdsPerSession: Number(settings?.maxAdsPerSession ?? 0),
    stickyFooter: settings?.stickyFooter !== false,
    refreshSeconds: Number(settings?.refreshSeconds ?? 0),
    // Default FALSE — Adsterra banner tidak kompatibel dengan iframe sandbox.
    // Aktifkan hanya bila ada konflik container ID antar unit (jarang terjadi).
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
  // autoSrcs = script Adsterra auto-behavior: popunder, social bar, in-page push.
  // Cukup di-load ke body satu kali — Adsterra otomatis tampilkan overlay/popup.
  // bodyHtml = banner yang butuh container, dioper ke pool client via AdProvider.
  const { autoSrcs, autoInlines, bodyHtml } = splitAdScripts(settings);
  const units = bodyHtml.map((html) => ({ html, ...parseAdUnit(html) }));
  const flags = adFlags(settings);
  // /admin steril total dari iklan (cek server-side via middleware).
  // Panel debug tampil bila ?ads_debug=1 (cek client-side di komponennya).
  const pathname = headers().get('x-pathname') || '';
  const pageIsAdmin = pathname.startsWith('/admin') || pathname.startsWith('/pantau');
  return (
    <html lang="id">
      <body>
        <AdProvider units={units} flags={flags}>
          {children}
          {!pageIsAdmin && <AdSessionManager />}
          {!pageIsAdmin && <StickyFooterAd />}
          {!pageIsAdmin && <AdDebugPanel />}
          {/* Script auto-behavior Adsterra (popunder, social bar, in-page push):
              di-inject ke body satu kali saat mount. Adsterra yang mengontrol
              kapan dan bagaimana iklan tampil — tanpa intervensi dari kode ini. */}
          {!pageIsAdmin && (autoSrcs.length > 0 || autoInlines.length > 0) && (
            <AdAutoScripts srcs={autoSrcs} inlines={autoInlines} />
          )}
        </AdProvider>
      </body>
    </html>
  );
}
