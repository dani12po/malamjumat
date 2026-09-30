import { neon } from '@neondatabase/serverless';

// Blokir IP otomatis (Neon; fallback memori bila tanpa DATABASE_URL).
// Aturan: >=5 login gagal dalam 10 menit -> blokir 1 jam.

const FAIL_LIMIT = 5;
const BAN_MS = 60 * 60 * 1000;

const mem = new Map(); // ip -> { fails, firstFail, bannedUntil, reason }

function useDb() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable(client) {
  await client`CREATE TABLE IF NOT EXISTS ip_bans (ip TEXT PRIMARY KEY, fails INT NOT NULL DEFAULT 0, first_fail TIMESTAMPTZ, banned_until TIMESTAMPTZ, reason TEXT)`;
}

export async function isBanned(ip) {
  if (!ip || ip === 'unknown') return null;
  if (useDb()) {
    try {
      const client = sql();
      await ensureTable(client);
      const rows = await client`SELECT banned_until, reason FROM ip_bans WHERE ip = ${ip}`;
      if (rows.length > 0 && rows[0].banned_until && new Date(rows[0].banned_until) > new Date()) {
        return { until: rows[0].banned_until, reason: rows[0].reason || '' };
      }
      return null;
    } catch {
      return null; // DB down -> fail-open (situs tetap jalan, rate-limit masih jaga)
    }
  }
  const b = mem.get(ip);
  if (b && b.bannedUntil && b.bannedUntil > Date.now()) {
    return { until: new Date(b.bannedUntil).toISOString(), reason: b.reason || '' };
  }
  return null;
}

export async function noteFail(ip, reason = 'login-gagal') {
  if (!ip || ip === 'unknown') return { banned: false };
  if (useDb()) {
    try {
      const client = sql();
      await ensureTable(client);
      const rows = await client`INSERT INTO ip_bans (ip, fails, first_fail, banned_until, reason)
        VALUES (${ip}, 1, NOW(), NULL, ${reason})
        ON CONFLICT (ip) DO UPDATE SET
          fails = CASE WHEN ip_bans.first_fail < NOW() - INTERVAL '10 minutes' THEN 1 ELSE ip_bans.fails + 1 END,
          first_fail = CASE WHEN ip_bans.first_fail < NOW() - INTERVAL '10 minutes' THEN NOW() ELSE ip_bans.first_fail END,
          reason = EXCLUDED.reason
        RETURNING fails`;
      const fails = rows[0]?.fails || 1;
      if (fails >= FAIL_LIMIT) {
        await client`UPDATE ip_bans SET banned_until = NOW() + INTERVAL '1 hour' WHERE ip = ${ip}`;
        return { banned: true };
      }
      return { banned: false };
    } catch {
      return { banned: false };
    }
  }
  const now = Date.now();
  let b = mem.get(ip);
  if (!b || now - b.firstFail > 10 * 60 * 1000) b = { fails: 0, firstFail: now, bannedUntil: 0, reason };
  b.fails += 1;
  b.reason = reason;
  if (b.fails >= FAIL_LIMIT) {
    b.bannedUntil = now + BAN_MS;
    mem.set(ip, b);
    return { banned: true };
  }
  mem.set(ip, b);
  return { banned: false };
}

export async function noteOk(ip) {
  if (!ip || ip === 'unknown') return;
  if (useDb()) {
    try {
      const client = sql();
      await ensureTable(client);
      await client`DELETE FROM ip_bans WHERE ip = ${ip}`;
    } catch { /* abaikan */ }
    return;
  }
  mem.delete(ip);
}

export async function unbanIp(ip) {
  if (useDb()) {
    const client = sql();
    await ensureTable(client);
    await client`DELETE FROM ip_bans WHERE ip = ${ip}`;
    return;
  }
  mem.delete(ip);
}

export async function listBans() {
  if (useDb()) {
    const client = sql();
    await ensureTable(client);
    const rows = await client`SELECT ip, fails, banned_until, reason FROM ip_bans
      WHERE banned_until IS NOT NULL AND banned_until > NOW()
      ORDER BY banned_until DESC LIMIT 100`;
    return rows.map((r) => ({ ip: r.ip, fails: r.fails, until: r.banned_until, reason: r.reason || '' }));
  }
  const now = Date.now();
  const out = [];
  for (const [ip, b] of mem) {
    if (b.bannedUntil && b.bannedUntil > now) {
      out.push({ ip, fails: b.fails, until: new Date(b.bannedUntil).toISOString(), reason: b.reason || '' });
    }
  }
  return out;
}
