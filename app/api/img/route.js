import { NextResponse } from 'next/server';
import { lookup } from 'dns/promises';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Proxy gambar agar thumbnail selalu terlihat (anti hotlink-block & origin lambat).
// Alur di client: asli -> proxy ini -> blank.svg. Cache publik lama di edge.
// Keamanan: redirect manual + validasi tiap hop, blokir IP privat/loopback/
// link-local/CGNAT/semua-bentuk literal (desimal/oktal/hex/IPv6), resolve DNS
// lalu cek IP hasilnya, cap respons 5 MB, timeout 10 dtk.
// CATATAN: rate limit in-memory tidak efektif di serverless multi-instance
// (best-effort per instance); proteksi DDoS mengandalkan Vercel/CDN.

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HOPS = 3;

function ipv4Blocked(parts) {
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // privat
  if (a === 172 && b >= 16 && b <= 31) return true; // privat
  if (a === 192 && b === 168) return true; // privat
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 0) return true; // 0.0.0.0
  return false;
}

function parseIPv4Literal(host) {
  // Terima desimal per-oktet, heksa (0x..), oktal (0..), dan integer penuh.
  const h = String(host || '').toLowerCase();
  if (/^\d+$/.test(h)) {
    const n = Number(h);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  const parts = h.split('.');
  if (parts.length !== 4) return null;
  const out = [];
  for (const p of parts) {
    let v;
    if (/^0x[0-9a-f]+$/.test(p)) v = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p) && p.length > 1) v = parseInt(p, 8);
    else if (/^\d+$/.test(p)) v = parseInt(p, 10);
    else return null;
    if (!Number.isSafeInteger(v) || v < 0 || v > 255) return null;
    out.push(v);
  }
  return out;
}

function ipv6Blocked(host) {
  let h = String(host || '').toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fe80:')) return true; // link-local
  if (/^(fc|fd)/.test(h.split(':')[0] || '')) return true; // unique-local fc00::/7
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    const p = mapped[1].split('.').map(Number);
    if (p.length === 4 && p.every((n) => n >= 0 && n <= 255)) return ipv4Blocked(p);
    return true;
  }
  return false;
}

function hostBlocked(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost') return true;
  if (h.includes(':')) return ipv6Blocked(h); // literal IPv6
  const lit = parseIPv4Literal(h);
  if (lit) return ipv4Blocked(lit);
  if (/^[0-9a-f:.]+$/i.test(h) && h.includes(':')) return ipv6Blocked(h);
  return false;
}

async function resolvedBlocked(hostname) {
  try {
    const addrs = await lookup(hostname, { all: true });
    for (const a of addrs || []) {
      if (a.family === 4) {
        const p = String(a.address).split('.').map(Number);
        if (p.length === 4 && p.every((n) => n >= 0 && n <= 255) && ipv4Blocked(p)) return true;
      } else if (a.family === 6) {
        if (ipv6Blocked(a.address)) return true;
      }
    }
    return false;
  } catch {
    return true; // DNS gagal = tolak (fail-closed untuk SSRF)
  }
}

export async function GET(req) {
  const rl = rateLimit(`img:${clientIp(req)}`, { limit: 300, windowMs: 60_000 });
  if (!rl.ok) return new NextResponse('rate limited', { status: 429 });
  const blank = new URL('/blank.svg', req.url);

  let current;
  try {
    current = new URL(req.nextUrl.searchParams.get('u') || '');
  } catch {
    return NextResponse.redirect(blank);
  }

  try {
    // Ikuti redirect manual: validasi tiap hop.
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (!['http:', 'https:'].includes(current.protocol)) return NextResponse.redirect(blank);
      if (hostBlocked(current.hostname)) return NextResponse.redirect(blank);
      if (await resolvedBlocked(current.hostname)) return NextResponse.redirect(blank);

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      let res;
      try {
        res = await fetch(current.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'image/*' },
          signal: ctrl.signal,
          redirect: 'manual'
        });
      } finally {
        clearTimeout(t);
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return NextResponse.redirect(blank);
        try {
          current = new URL(loc, current.toString());
        } catch {
          return NextResponse.redirect(blank);
        }
        continue;
      }

      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.startsWith('image/')) return NextResponse.redirect(blank);
      const len = Number(res.headers.get('content-length') || '0');
      if (len > MAX_BYTES) return NextResponse.redirect(blank);
      if (!res.body) return NextResponse.redirect(blank);

      // Cap 5 MB saat streaming.
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          try { await reader.cancel(); } catch { /* abaikan */ }
          return NextResponse.redirect(blank);
        }
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      return new NextResponse(buf, {
        headers: {
          'Content-Type': ct.split(';')[0],
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        }
      });
    }
    return NextResponse.redirect(blank);
  } catch {
    return NextResponse.redirect(blank);
  }
}
