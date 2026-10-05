import { NextResponse } from 'next/server';

// Path yang tidak perlu ditrack (asset, API internal, admin, pantau)
const SKIP_PREFIXES = [
  '/_next/', '/api/', '/admin', '/pantau',
  '/favicon', '/icon', '/blank', '/robots', '/sitemap'
];
const SKIP_EXTENSIONS = /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|map|json)$/i;

function shouldTrack(pathname) {
  if (SKIP_EXTENSIONS.test(pathname)) return false;
  for (const p of SKIP_PREFIXES) {
    if (pathname.startsWith(p)) return false;
  }
  return true;
}

// Buat/pertahankan session ID via cookie (anonim, bukan PII).
// Dipakai untuk dedup "visitor aktif" dan hitung unique session.
function getOrCreateSid(req) {
  const existing = req.cookies.get('_asid')?.value;
  if (existing && /^[a-z0-9]{16,32}$/.test(existing)) return { sid: existing, isNew: false };
  // Buat baru
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const sid = [...bytes].map(x => x.toString(36)).join('').slice(0, 24);
  return { sid, isNew: true };
}

export function middleware(req) {
  const pathname = req.nextUrl.pathname;

  // Selalu teruskan pathname ke layout (untuk mematikan iklan di /admin)
  const headers = new Headers(req.headers);
  headers.set('x-pathname', pathname);

  const response = NextResponse.next({ request: { headers } });

  // Session cookie: 30 hari, httpOnly, SameSite=Lax
  const { sid, isNew } = getOrCreateSid(req);
  if (isNew) {
    response.cookies.set('_asid', sid, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });
  }

  // Track asynchronously — fire and forget via waitUntil bila tersedia,
  // fallback fetch biasa (tidak await agar tidak lambatkan response).
  if (shouldTrack(pathname)) {
    const origin = req.nextUrl.origin;
    const referrer = req.headers.get('referer') || '';
    const body = JSON.stringify({ path: pathname, referrer, sid });

    // Kirim ke API internal — pakai keepalive agar tidak dibatalkan
    try {
      fetch(`${origin}/api/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward header negara dari CDN ke API
          ...(req.headers.get('x-vercel-ip-country') ? { 'x-vercel-ip-country': req.headers.get('x-vercel-ip-country') } : {}),
          ...(req.headers.get('cf-ipcountry') ? { 'cf-ipcountry': req.headers.get('cf-ipcountry') } : {}),
          ...(req.headers.get('x-vercel-ip-city') ? { 'x-vercel-ip-city': req.headers.get('x-vercel-ip-city') } : {}),
          ...(req.headers.get('x-forwarded-for') ? { 'x-forwarded-for': req.headers.get('x-forwarded-for') } : {}),
          ...(req.headers.get('user-agent') ? { 'user-agent': req.headers.get('user-agent') } : {}),
        },
        body,
        // @ts-ignore — keepalive tersedia di Edge runtime
        keepalive: true
      }).catch(() => {}); // abaikan error jaringan
    } catch {
      // middleware Edge runtime — abaikan bila fetch gagal
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match semua path kecuali _next static & file statis
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
