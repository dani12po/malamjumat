import { NextResponse } from 'next/server';
import { recordHit } from '@/lib/analytics';
import { clientIp } from '@/lib/ratelimit';

// Endpoint tracking: dipanggil fire-and-forget dari client (beacon/fetch).
// Tidak butuh auth — data minimal, IP di-hash (tidak disimpan mentah).
// Rate limit ringan: 60 hit/menit per IP untuk cegah spam.

const rl = new Map(); // ip -> { start, count }

function allowed(ip) {
  const now = Date.now();
  let b = rl.get(ip);
  if (!b || now - b.start > 60_000) { b = { start: now, count: 0 }; rl.set(ip, b); }
  b.count++;
  if (rl.size > 3000 && Math.random() < 0.05) {
    for (const [k, v] of rl) { if (now - v.start > 60_000) rl.delete(k); }
  }
  return b.count <= 60;
}

// Hash IP sederhana (non-reversible, untuk dedup unique visitor).
async function hashIp(ip) {
  try {
    const enc = new TextEncoder().encode(ip + (process.env.TRACK_SALT || 'mj-salt-2024'));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return ip.split('.').slice(0, 2).join('.') + '.x.x';
  }
}

function detectDevice(ua = '') {
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) {
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

function parseCountry(req) {
  // Vercel / Cloudflare inject header negara
  return req.headers.get('x-vercel-ip-country')
    || req.headers.get('cf-ipcountry')
    || req.headers.get('x-country-code')
    || null;
}

function parseCity(req) {
  return req.headers.get('x-vercel-ip-city')
    || req.headers.get('cf-ipcity')
    || null;
}

export async function POST(req) {
  const ip = clientIp(req);
  if (!allowed(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  let body = {};
  try { body = await req.json(); } catch { /* body opsional */ }

  const path = (body.path || '/').slice(0, 200);
  const referrer = (body.referrer || '').slice(0, 500) || null;
  const sessionId = (body.sid || '').slice(0, 64) || null;
  const ua = req.headers.get('user-agent') || '';
  const device = detectDevice(ua);
  const country = parseCountry(req);
  const city = parseCity(req);
  const ipHash = await hashIp(ip);

  // Fire and forget — jangan await agar response cepat
  recordHit({ path, referrer, country, city, device, ipHash, sessionId }).catch(() => {});

  return NextResponse.json({ ok: true }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, ping: Date.now() });
}
