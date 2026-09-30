import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { isBanned, noteFail, noteOk } from '@/lib/ipban';
import { verifyKey } from '@/lib/password';

// Login admin berlapis:
// 1) IP yang kena auto-ban -> 403 langsung
// 2) Rate limit 10x/menit per IP
// 3) Kunci acak (verifier sha256 di DB) atau ADMIN_PASSWORD legacy bila verifier belum diset.
// Password/kunci tidak pernah dikirim balik ke client.

export async function POST(req) {
  const ip = clientIp(req);

  const ban = await isBanned(ip);
  if (ban) return NextResponse.json({ error: 'IP diblokir sementara' }, { status: 403 });

  const rl = rateLimit(`auth:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'terlalu banyak percobaan, coba lagi semenit' }, { status: 429 });
  }

  const { password } = await req.json().catch(() => ({}));
  let ok = false;
  try {
    const settings = ((await readDB()).settings) || {};
    // HANYA hash: tanpa verifier di DB, tidak ada yang bisa login.
    if (settings.adminKeyVerifier) {
      ok = verifyKey(password || '', settings.adminKeyVerifier);
    }
  } catch {
    ok = false;
  }

  if (!ok) {
    await noteFail(ip, 'login-gagal');
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await noteOk(ip);
  return NextResponse.json({ ok: true });
}
