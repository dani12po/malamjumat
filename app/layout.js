import './globals.css';
import Script from 'next/script';
import { headers } from 'next/headers';
import { readDB } from '@/lib/db';
import { splitAdScripts } from '@/lib/ads';

export const metadata = {
  title: 'Drive Video',
  robots: 'noindex, nofollow'
};

// Selalu render fresh per request: settings iklan + database tidak boleh
// terjebak di cache static (pernah kejadian: fallback kosong ke-cache).
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  let settings = {};
  try {
    settings = (await readDB()).settings || {};
  } catch {
    settings = {};
  }
  // Script src-only dimuat di <head> sebelum interaktif = tayang cepat.
  // HTML body dirender mentah (SSR) langsung di page f/d — GlobalAds idle (hindari duplikat).
  const { headSrcs } = splitAdScripts(settings);
  // /admin steril total dari iklan (cek server-side via middleware).
  const pageIsAdmin = (headers().get('x-pathname') || '').startsWith('/admin');
  return (
    <html lang="id">
      <body>
        {children}
        {!pageIsAdmin && headSrcs.map((src) => (
          <Script key={src} src={src} strategy="beforeInteractive" data-cfasync="false" />
        ))}
      </body>
    </html>
  );
}
