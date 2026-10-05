import { NextResponse } from 'next/server';
import { getStats, getRealtimeOnly } from '@/lib/analytics';
import { rateLimit, clientIp } from '@/lib/ratelimit';

function checkAuth(req) {
  const auth = req.headers.get('x-admin-pass') || '';
  const expected = process.env.PANTAU_PASSWORD || 'pantau123';
  return auth === expected;
}

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') || 'full';

  // Realtime boleh lebih sering (limit 120/menit), full lebih ketat (30/menit)
  const limit = mode === 'realtime' ? 120 : 30;
  const rl = rateLimit(`pantau-${mode}:${clientIp(req)}`, { limit, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'too many requests' }, { status: 429 });

  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Mode realtime: hanya ambil data online sekarang (query ringan)
  if (mode === 'realtime') {
    try {
      const rt = await getRealtimeOnly();
      return NextResponse.json(rt, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      console.error('[pantau] realtime error:', e?.message);
      return NextResponse.json({ error: 'gagal ambil realtime' }, { status: 500 });
    }
  }

  const range = url.searchParams.get('range') || '30d';
  const validRanges = ['today', '7d', '30d'];
  const isMonthRange = /^month:\d{4}-\d{2}$/.test(range);
  if (!validRanges.includes(range) && !isMonthRange) {
    return NextResponse.json({ error: 'range tidak valid' }, { status: 400 });
  }

  try {
    const stats = await getStats(range);
    return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[pantau] getStats error:', e?.message);
    return NextResponse.json({ error: 'gagal ambil data' }, { status: 500 });
  }
}
