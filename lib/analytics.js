// Analytics engine: catat pageview, ambil statistik.
// Pakai Neon bila DATABASE_URL ada; fallback in-memory (dev/lokal).
// Tabel: analytics_hits — satu baris per kunjungan halaman.
// Tabel: analytics_realtime — satu baris per IP aktif (TTL 5 menit).

import { neon } from '@neondatabase/serverless';

function useDb() {
  return Boolean(process.env.DATABASE_URL);
}
function sql() {
  return neon(process.env.DATABASE_URL);
}

// ─── DDL ──────────────────────────────────────────────────────────────────────
let tableReady = false;
async function ensureTables(client) {
  if (tableReady) return;
  await client`
    CREATE TABLE IF NOT EXISTS analytics_hits (
      id          BIGSERIAL PRIMARY KEY,
      ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      path        TEXT NOT NULL,
      referrer    TEXT,
      country     TEXT,
      city        TEXT,
      device      TEXT,
      ip_hash     TEXT,
      session_id  TEXT
    )`;
  await client`CREATE INDEX IF NOT EXISTS idx_ah_ts      ON analytics_hits (ts DESC)`;
  await client`CREATE INDEX IF NOT EXISTS idx_ah_path    ON analytics_hits (path)`;
  await client`CREATE INDEX IF NOT EXISTS idx_ah_ip_hash ON analytics_hits (ip_hash)`;
  await client`
    CREATE TABLE IF NOT EXISTS analytics_realtime (
      session_id TEXT PRIMARY KEY,
      ip_hash    TEXT,
      path       TEXT,
      country    TEXT,
      device     TEXT,
      last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  tableReady = true;
}

// ─── In-memory fallback ────────────────────────────────────────────────────────
const memHits = [];
const memRealtime = new Map();

// ─── Tulis hit ─────────────────────────────────────────────────────────────────
export async function recordHit({ path, referrer, country, city, device, ipHash, sessionId }) {
  if (useDb()) {
    try {
      const client = sql();
      await ensureTables(client);
      await client`
        INSERT INTO analytics_hits (ts, path, referrer, country, city, device, ip_hash, session_id)
        VALUES (NOW(), ${path}, ${referrer || null}, ${country || null}, ${city || null},
                ${device || null}, ${ipHash || null}, ${sessionId || null})`;
      if (sessionId) {
        await client`
          INSERT INTO analytics_realtime (session_id, ip_hash, path, country, device, last_seen)
          VALUES (${sessionId}, ${ipHash || null}, ${path}, ${country || null}, ${device || null}, NOW())
          ON CONFLICT (session_id) DO UPDATE SET
            path = EXCLUDED.path,
            last_seen = NOW(),
            device = EXCLUDED.device`;
      }
    } catch (e) {
      console.error('[analytics] recordHit error:', e?.message);
    }
    return;
  }
  memHits.push({ ts: new Date(), path, referrer, country, city, device, ipHash, sessionId });
  if (memHits.length > 10000) memHits.shift();
  if (sessionId) {
    memRealtime.set(sessionId, { path, country, device, lastSeen: Date.now() });
  }
}

// ─── Bersihkan realtime lama ────────────────────────────────────────────────────
async function purgeRealtime(client) {
  if (useDb() && client) {
    await client`DELETE FROM analytics_realtime WHERE last_seen < NOW() - INTERVAL '5 minutes'`;
  } else {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, v] of memRealtime) {
      if (v.lastSeen < cutoff) memRealtime.delete(k);
    }
  }
}

// ─── Helper: jalankan query dinamis via sql.query() ──────────────────────────
// @neondatabase/serverless v0.10+: tagged template ATAU sql.query(str, params)
async function rawQuery(client, queryStr) {
  // client adalah instance dari neon() — gunakan .query() untuk string dinamis
  return client.query(queryStr);
}

// ─── Ambil data dashboard ──────────────────────────────────────────────────────
export async function getStats(range = '30d') {
  if (useDb()) {
    const client = sql();
    await ensureTables(client);
    await purgeRealtime(client);

    // Tentukan interval & format grouping berdasar range
    // Semua query pakai neon() function call (bukan tagged template) untuk
    // mendukung SQL dinamis tanpa client.unsafe() yang tidak ada di Neon SDK.
    let whereClause;
    let groupFormat;
    if (range === 'today') {
      whereClause = `ts >= NOW() - INTERVAL '24 hours'`;
      groupFormat = `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'HH24:00')`;
    } else if (range === '7d') {
      whereClause = `ts >= NOW() - INTERVAL '7 days'`;
      groupFormat = `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'DD Mon')`;
    } else if (range.startsWith('month:')) {
      const ym = range.slice(6).replace(/[^0-9-]/g, ''); // sanitize
      whereClause = `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') = '${ym}'`;
      groupFormat = `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'DD')`;
    } else {
      whereClause = `ts >= NOW() - INTERVAL '30 days'`;
      groupFormat = `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'DD Mon')`;
    }

    const toArr = (r) => (Array.isArray(r) ? r : []);

    // Chart
    const chartRows = toArr(await rawQuery(client, `
      SELECT ${groupFormat} AS period,
             COUNT(*) AS pageviews,
             COUNT(DISTINCT ip_hash) AS visitors
      FROM analytics_hits
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY MIN(ts) ASC
    `));

    // Summary
    const summaryRows = toArr(await rawQuery(client, `
      SELECT COUNT(*) AS pageviews,
             COUNT(DISTINCT ip_hash) AS visitors,
             COUNT(DISTINCT session_id) AS sessions
      FROM analytics_hits
      WHERE ${whereClause}
    `));
    const summary = summaryRows[0] || { pageviews: 0, visitors: 0, sessions: 0 };

    // Peak hour
    const peakRows = toArr(await rawQuery(client, `
      SELECT to_char(ts AT TIME ZONE 'Asia/Jakarta', 'HH24') AS hour,
             COUNT(*) AS cnt
      FROM analytics_hits WHERE ${whereClause}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    `));

    // Top pages
    const topPages = toArr(await rawQuery(client, `
      SELECT path, COUNT(*) AS cnt
      FROM analytics_hits WHERE ${whereClause}
      GROUP BY path ORDER BY 2 DESC LIMIT 10
    `));

    // Top countries
    const topCountries = toArr(await rawQuery(client, `
      SELECT COALESCE(country, '—') AS country, COUNT(*) AS cnt
      FROM analytics_hits WHERE ${whereClause}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    `));

    // Device split
    const devices = toArr(await rawQuery(client, `
      SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS cnt
      FROM analytics_hits WHERE ${whereClause}
      GROUP BY 1 ORDER BY 2 DESC
    `));

    // Hourly heatmap
    const hourly = toArr(await rawQuery(client, `
      SELECT to_char(ts AT TIME ZONE 'Asia/Jakarta', 'HH24') AS hour,
             COUNT(*) AS cnt
      FROM analytics_hits WHERE ${whereClause}
      GROUP BY 1 ORDER BY 1 ASC
    `));

    // Realtime aktif (tagged template ok — query statis)
    const realtimeRows = toArr(await client`
      SELECT path, country, device, COUNT(*) AS cnt
      FROM analytics_realtime
      GROUP BY path, country, device
      ORDER BY cnt DESC
    `);
    const realtimeTotal = toArr(await client`SELECT COUNT(*) AS cnt FROM analytics_realtime`);

    // Daftar bulan tersedia
    const months = toArr(await client`
      SELECT DISTINCT to_char(ts AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS ym
      FROM analytics_hits
      ORDER BY 1 DESC
      LIMIT 24
    `);

    return {
      chart: chartRows.map((r) => ({
        period: r.period,
        pageviews: Number(r.pageviews),
        visitors: Number(r.visitors)
      })),
      summary: {
        pageviews: Number(summary.pageviews),
        visitors: Number(summary.visitors),
        sessions: Number(summary.sessions),
        pvPerVisit: Number(summary.visitors) > 0
          ? (Number(summary.pageviews) / Number(summary.visitors)).toFixed(2)
          : '0',
        peakHour: peakRows[0] ? `${peakRows[0].hour}:00 WIB` : '—'
      },
      topPages: topPages.map((r) => ({ path: r.path, cnt: Number(r.cnt) })),
      topCountries: topCountries.map((r) => ({ country: r.country, cnt: Number(r.cnt) })),
      devices: devices.map((r) => ({ device: r.device, cnt: Number(r.cnt) })),
      hourly: hourly.map((r) => ({ hour: r.hour, cnt: Number(r.cnt) })),
      realtime: {
        active: Number(realtimeTotal[0]?.cnt || 0),
        pages: realtimeRows.map((r) => ({
          path: r.path,
          country: r.country || '—',
          device: r.device || '—',
          cnt: Number(r.cnt)
        }))
      },
      availableMonths: months.map((r) => r.ym)
    };
  }

  // ── Fallback memori ──
  await purgeRealtime(null);
  const now = Date.now();
  const cutoffMap = {
    today: now - 24 * 60 * 60 * 1000,
    '7d': now - 7 * 24 * 60 * 60 * 1000,
    '30d': now - 30 * 24 * 60 * 60 * 1000
  };
  const cutoff = cutoffMap[range] || cutoffMap['30d'];
  const hits = memHits.filter((h) => h.ts.getTime() >= cutoff);
  const pvMap = {};
  hits.forEach((h) => {
    const k = h.ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    if (!pvMap[k]) pvMap[k] = { pageviews: 0, visitors: new Set() };
    pvMap[k].pageviews++;
    if (h.ipHash) pvMap[k].visitors.add(h.ipHash);
  });
  const chart = Object.entries(pvMap).map(([period, v]) => ({
    period, pageviews: v.pageviews, visitors: v.visitors.size
  }));
  const uniqIPs = new Set(hits.map((h) => h.ipHash).filter(Boolean));
  return {
    chart,
    summary: {
      pageviews: hits.length,
      visitors: uniqIPs.size,
      sessions: new Set(hits.map((h) => h.sessionId).filter(Boolean)).size,
      pvPerVisit: uniqIPs.size > 0 ? (hits.length / uniqIPs.size).toFixed(2) : '0',
      peakHour: '—'
    },
    topPages: [],
    topCountries: [],
    devices: [],
    hourly: [],
    realtime: { active: memRealtime.size, pages: [] },
    availableMonths: []
  };
}
