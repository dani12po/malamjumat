import fs from 'fs';
import path from 'path';
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

async function ensureTable(client) {
  await client`CREATE TABLE IF NOT EXISTS drive_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`;
}

async function readNeonDB() {
  const client = sql();
  await ensureTable(client);
  const rows = await client`SELECT data FROM drive_state WHERE id = 'main'`;
  if (!rows || rows.length === 0) return null; // belum ada → fallback file (seed awal)
  const data = rows[0].data;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function writeNeonDB(db) {
  const client = sql();
  await ensureTable(client);
  await client`INSERT INTO drive_state (id, data, updated_at) VALUES ('main', ${JSON.stringify(db)}, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
}

export async function readDB() {
  if (isCloudDb()) {
    try {
      const db = await readNeonDB();
      if (db) return db;
    } catch {
      // Neon gagal → jatuh ke file lokal agar page tetap tampil
    }
    return readFileDB();
  }
  return readFileDB();
}

export async function writeDB(db) {
  if (isCloudDb()) {
    await writeNeonDB(db);
    return;
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

export function uid(prefix = 'id') {
  return prefix + Math.random().toString(36).slice(2, 10);
}
