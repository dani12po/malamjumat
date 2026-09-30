import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { readDB, writeDB, uid, isCloudDb } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { isBanned, noteFail, listBans, unbanIp } from '@/lib/ipban';

import { verifyKey } from '@/lib/password';

async function checkAuth(req) {
  const auth = req.headers.get('x-admin-pass') || '';
  if (!auth) return false;
  try {
    const settings = ((await readDB()).settings) || {};
    // HANYA hash verifier. Tanpa verifier = tolak semua (generate via scripts/setup-admin.cjs).
    if (!settings.adminKeyVerifier) return false;
    return verifyKey(auth, settings.adminKeyVerifier);
  } catch {
    return false;
  }
}

export async function GET(req) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await isBanned(clientIp(req))) return NextResponse.json({ error: 'IP diblokir sementara' }, { status: 403 });
  try {
    const db = await readDB();
    return NextResponse.json({
      folders: db.folders || [],
      videos: db.videos || [],
      settings: db.settings || {},
      storage: isCloudDb() ? 'neon' : 'file'
    });
  } catch {
    return NextResponse.json({ error: 'database tidak bisa dibaca' }, { status: 500 });
  }
}

export async function POST(req) {
  const rl = rateLimit(`admin:${clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'terlalu banyak request, pelankan' }, { status: 429 });
  if (!(await checkAuth(req))) {
    await noteFail(clientIp(req), 'tebak-kunci');
    return NextResponse.json({ error: 'unauthorized: password admin salah' }, { status: 401 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'request tidak valid (bukan JSON)' }, { status: 400 });
  }
  const db = await readDB();
  try {
  if (body.action === 'list-bans') {
    return NextResponse.json({ ok: true, bans: await listBans() });
  }
  if (body.action === 'unban') {
    if (!body.ip) return NextResponse.json({ error: 'ip kosong' }, { status: 400 });
    await unbanIp(String(body.ip));
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'settings') {
    const s = body.settings || {};
    // Validasi field iklan: angka di-clamp, boolean dipaksa, refresh <30 dtk ditolak.
    const num = (v, d, min, max) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return d;
      return Math.min(max, Math.max(min, Math.round(n)));
    };
    if (s.maxAdsPerPage !== undefined) s.maxAdsPerPage = num(s.maxAdsPerPage, 10, 1, 50);
    if (s.feedEvery !== undefined) s.feedEvery = num(s.feedEvery, 6, 2, 20);
    if (s.stickyFooter !== undefined) s.stickyFooter = s.stickyFooter === true || s.stickyFooter === 1;
    if (s.isolateBanners !== undefined) s.isolateBanners = s.isolateBanners === true || s.isolateBanners === 1;
    if (s.refreshSeconds !== undefined) {
      const r = num(s.refreshSeconds, 0, 0, 300);
      s.refreshSeconds = r > 0 && r < 30 ? 0 : r; // <30 dtk = off (kebijakan network)
    }
    db.settings = { ...db.settings, ...s };
    await writeDB(db);
    try {
      revalidateTag('ad-settings');
    } catch {
      // abaikan (non-fatal)
    }
    return NextResponse.json({ ok: true, settings: db.settings });
  }
  if (body.action === 'reset') {
    return NextResponse.json({ error: 'gunakan import JSON manual' }, { status: 400 });
  }
  // CRUD folder
  if (body.action === 'create-folder') {
    const f = { id: body.id?.trim() || uid('f'), title: body.title?.trim() || 'Untitled', parentId: body.parentId || null };
    db.folders.push(f);
    await writeDB(db);
    return NextResponse.json({ ok: true, folder: f });
  }
  if (body.action === 'update-folder') {
    const f = db.folders.find((x) => x.id === body.id);
    if (!f) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (body.title !== undefined) f.title = body.title;
    if (body.parentId !== undefined) f.parentId = body.parentId || null;
    await writeDB(db);
    return NextResponse.json({ ok: true, folder: f });
  }
  if (body.action === 'delete-folder') {
    db.folders = db.folders.filter((x) => x.id !== body.id);
    // videos tetap, tapi folderId dikosongkan
    db.videos = db.videos.map((v) => (v.folderId === body.id ? { ...v, folderId: null } : v));
    await writeDB(db);
    return NextResponse.json({ ok: true });
  }
  // CRUD video
  if (body.action === 'create-video') {
    const v = {
      id: body.id?.trim() || uid('v'),
      folderId: body.folderId || null,
      title: body.title?.trim() || 'Untitled.mp4',
      thumb: body.thumb?.trim() || 'https://picsum.photos/seed/new/360/640',
      embed: body.embed?.trim() || '',
      file: body.file?.trim() || '',
      label: body.label?.trim() || 'vidoycdn'
    };
    db.videos.push(v);
    await writeDB(db);
    return NextResponse.json({ ok: true, video: v });
  }
  if (body.action === 'update-video') {
    const v = db.videos.find((x) => x.id === body.id);
    if (!v) return NextResponse.json({ error: 'not found' }, { status: 404 });
    for (const k of ['title', 'thumb', 'embed', 'file', 'label', 'folderId']) {
      if (body[k] !== undefined) v[k] = body[k];
    }
    await writeDB(db);
    return NextResponse.json({ ok: true, video: v });
  }
  if (body.action === 'delete-video') {
    db.videos = db.videos.filter((x) => x.id !== body.id);
    await writeDB(db);
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'import') {
    if (!body.db) return NextResponse.json({ error: 'db kosong' }, { status: 400 });
    await writeDB(body.db);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'gagal menyimpan database (storage mungkin read-only)' }, { status: 500 });
  }
}
