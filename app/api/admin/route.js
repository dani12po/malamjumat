import { NextResponse } from 'next/server';
import { readDB, writeDB, uid, isCloudDb } from '@/lib/db';

function checkAuth(req) {
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  const auth = req.headers.get('x-admin-pass') || '';
  return auth === pass;
}

export async function GET() {
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
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized: password admin salah' }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'request tidak valid (bukan JSON)' }, { status: 400 });
  }
  const db = await readDB();
  try {
  if (body.action === 'settings') {
    db.settings = { ...db.settings, ...body.settings };
    await writeDB(db);
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
