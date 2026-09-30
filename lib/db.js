import fs from 'fs';
import path from 'path';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { neon } from '@neondatabase/serverless';

// Database ganda: Neon Postgres (diutamakan bila DATABASE_URL ada) atau file lokal.
// Satu baris state (id='main') di tabel drive_state. Dibuat otomatis saat akses pertama.

const dbPath = path.join(process.cwd(), 'data', 'db.json');

export function isCloudDb() {
  return Boolean(process.env.DATABASE_URL);
}

function emptyDB() {
  return { folders: [], videos: [], settings: {} };
}

function readFileDB() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return emptyDB();
  }
}

function sql() {
  // Skill Neon: pakai pooled DATABASE_URL untuk traffic aplikasi.
  return neon(process.env.DATABASE_URL);
}

// ensureTable sekali per proses (bukan tiap read) — cukup untuk DDL idempoten.
let tableEnsured = false;
async function ensureTableOnce(client) {
  if (tableEnsured) return;
  await client`CREATE TABLE IF NOT EXISTS drive_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`;
  tableEnsured = true;
}

// Settings terakhir yang berhasil dibaca — penopang bila Neon down,
// agar halaman tidak 404 dan iklan tidak kosong mendadak.
let lastGoodDb = null;

async function readNeonDB() {
  const client = sql();
  await ensureTableOnce(client);
  const rows = await client`SELECT data FROM drive_state WHERE id = 'main'`;
  if (!rows || rows.length === 0) return null; // belum ada → fallback file (seed awal)
  const data = rows[0].data;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function readDB() {
  if (isCloudDb()) {
    // Retry 1x; gagal total -> last-known-good -> file. Error selalu di-log,
    // jangan ditelan diam-diam.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const db = await readNeonDB();
        if (db) {
          lastGoodDb = db;
          return db;
        }
        break; // null = DB kosong, lanjut ke seed file
      } catch (e) {
        console.error(`[db] Neon read gagal (percobaan ${attempt + 1}/2):`, e?.message || e);
      }
    }
    if (lastGoodDb) return lastGoodDb;
    return readFileDB();
  }
  return readFileDB();
}

// Satu bacaan settings per request (React cache) + cache lintas request
// 30 detik (tag 'ad-settings'; di-revalidate tiap action 'settings').
const getCachedSettings = unstable_cache(
  async () => {
    try {
      return ((await readDB()).settings) || {};
    } catch (e) {
      console.error('[db] getSettings gagal:', e?.message || e);
      return {};
    }
  },
  ['ad-settings'],
  { revalidate: 30, tags: ['ad-settings'] }
);

export const getSettings = cache(() => getCachedSettings());

export async function writeDB(db) {
  if (isCloudDb()) {
    await writeNeonDB(db);
    return;
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

async function writeNeonDB(db) {
  const client = sql();
  await ensureTableOnce(client);
  await client`INSERT INTO drive_state (id, data, updated_at) VALUES ('main', ${JSON.stringify(db)}, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
}

export function uid(prefix = 'id') {
  return prefix + Math.random().toString(36).slice(2, 10);
}
