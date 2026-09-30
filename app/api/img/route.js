import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Proxy gambar agar thumbnail selalu terlihat (anti hotlink-block & origin lambat).
// Alur di client: asli -> proxy ini -> blank.svg. Cache publik lama di edge.
function blockedHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '169.254.169.254') return true;
  if (/^(127\.|10\.|192\.168\.)/.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

export async function GET(req) {
  const rl = rateLimit(`img:${clientIp(req)}`, { limit: 300, windowMs: 60_000 });
  if (!rl.ok) return new NextResponse('rate limited', { status: 429 });
  const blank = new URL('/blank.svg', req.url);

  let target = null;
  try {
    target = new URL(req.nextUrl.searchParams.get('u') || '');
  } catch {
    return NextResponse.redirect(blank);
  }
  if (!['http:', 'https:'].includes(target.protocol) || blockedHost(target.hostname)) {
    return NextResponse.redirect(blank);
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    let res;
    try {
      res = await fetch(target.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'image/*' },
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(t);
    }
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.startsWith('image/')) throw new Error('bukan gambar');
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': ct.split(';')[0],
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
      }
    });
  } catch {
    return NextResponse.redirect(blank);
  }
}
