import { NextResponse } from 'next/server';
import { getStats } from '@/lib/analytics';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Password /pantau terpisah dari admin — set via env PANTAU_PASSWORD
// Default fallback: 'pantau123' (ganti di .env.local untuk produksi)
function checkAuth(req) {
  const auth = req.headers.get('x-admin-pass') || '';
  const expected = process.env.PANTAU_PASSWORD || 'pantau123';
  return auth === expected;
}

export async function GET(req) {
  const rl = rateLimit(`pantau:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'too many requests' }, { status: 429 });

  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const range = url.searchParams.get('range') || '30d';

  const validRanges = ['today', '7d', '30d'];
  const isMonthRange = /^month:\d{4}-\d{2}$/.test(range);
  if (!validRanges.includes(range) && !isMonthRange) {
    return NextResponse.json({ error: 'range tidak valid' }, { status: 400 });
  }

  try {
    const stats = await getStats(range);
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (e) {
    console.error('[pantau] getStats error:', e?.message);
    return NextResponse.json({ error: 'gagal ambil data' }, { status: 500 });
  }
}
