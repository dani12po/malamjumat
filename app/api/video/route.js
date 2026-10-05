import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Proxy video: stream MP4/video dari URL manapun ke browser.
// Tujuan: bypass CORS dan Referer-block (Twitter, CDN ketat, dll).
// Mendukung Range request agar seek/skip video bisa jalan.
// Limit: 500MB per file, timeout 15 detik koneksi awal.

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

function isVideoContentType(ct) {
  return /^video\/|^application\/(x-mpegurl|vnd\.apple\.mpegurl|octet-stream)/i.test(ct || '');
}

export async function GET(req) {
  const rl = rateLimit(`vid:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return new NextResponse('rate limited', { status: 429 });

  let targetUrl;
  try {
    const u = new URL(req.url).searchParams.get('u') || '';
    targetUrl = new URL(u);
  } catch {
    return new NextResponse('url tidak valid', { status: 400 });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return new NextResponse('protocol tidak diizinkan', { status: 400 });
  }

  // Forward Range header agar seek video bisa jalan
  const rangeHeader = req.headers.get('range');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': targetUrl.origin + '/',
        'Origin': targetUrl.origin,
        ...(rangeHeader ? { 'Range': rangeHeader } : {}),
        'Accept': 'video/mp4,video/*,*/*'
      },
      signal: ctrl.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse(`upstream error ${upstream.status}`, { status: upstream.status });
    }

    const ct = upstream.headers.get('content-type') || 'video/mp4';
    const cl = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges');

    if (cl && Number(cl) > MAX_BYTES) {
      return new NextResponse('file terlalu besar', { status: 413 });
    }

    const resHeaders = {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      // Penting untuk seek video di browser
      'Accept-Ranges': acceptRanges || 'bytes',
    };
    if (cl) resHeaders['Content-Length'] = cl;
    if (cr) resHeaders['Content-Range'] = cr;

    return new NextResponse(upstream.body, {
      status: upstream.status, // 200 atau 206 (partial)
      headers: resHeaders
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e?.name === 'AbortError') {
      return new NextResponse('upstream timeout', { status: 504 });
    }
    return new NextResponse('proxy error: ' + (e?.message || ''), { status: 502 });
  }
}
