// Pool unit client (§T2): server mengoper daftar unit + metadata;
// slot acquire HANYA setelah lolos device/viewport/visibility.
// - Size-match per sizeClass; fallback unit tak-berukuran lalu area terkecil.
// - Rotasi offset per sesi bila slot > unit (tanpa duplikat simultan).
// - Caps: maxAdsPerPage, maxAdsPerSession, cooldown per slot.

let poolUnits = []; // [{ html, type, width, height, containerId }]
let poolCfg = { maxAdsPerPage: 20, maxAdsPerSession: 0, stickyFooter: true, refreshSeconds: 0, isolateBanners: false };
let assigned = new Map(); // slot -> { idx, token }
let pageLoads = 0;
let sessionLoads = 0;
let dupPrevented = 0; // acquire ulang slot yang sama (telemetri §34)
let fallbackUsed = 0; // unit fallback terpakai karena size tak pas

const CAPS = {
  wide: [728, 130],
  med: [468, 300],
  side: [340, 640],
  mobile: [360, 300],
  native: [99999, 99999]
};

function sessGet() {
  try {
    return Number(sessionStorage.getItem('ad-loads') || '0') || 0;
  } catch {
    return sessionLoads;
  }
}

export function poolFlags() {
  return { ...poolCfg };
}

function newToken() {
  try {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return [...b].map((x) => x.toString(36)).join('') + Date.now().toString(36);
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function sessSet(n) {
  sessionLoads = n;
  try {
    sessionStorage.setItem('ad-loads', String(n));
  } catch {
    // abaikan
  }
}

export function configurePool(units, flags) {
  poolUnits = (Array.isArray(units) ? units : []).filter((u) => u && u.html);
  poolCfg = { maxAdsPerPage: 20, maxAdsPerSession: 0, ...(flags || {}) };
  // Offset rotasi stabil per sesi.
  let offset = 0;
  try {
    const k = sessionStorage.getItem('ad-sess') || String(Date.now());
    for (const ch of k) offset = (offset * 31 + ch.charCodeAt(0)) >>> 0;
  } catch {
    offset = 0;
  }
  if (poolUnits.length > 0) {
    offset = offset % poolUnits.length;
    poolUnits = poolUnits.slice(offset).concat(poolUnits.slice(0, offset));
  }
  assigned = new Map();
  pageLoads = 0;
  sessionLoads = sessGet();
}

function area(u) {
  return (Number(u.width) || 0) * (Number(u.height) || 0);
}

function fits(u, sizeClass) {
  const cap = CAPS[sizeClass] || CAPS.med;
  if (!u.width && !u.height) return 'unknown';
  if (u.width <= cap[0] && u.height <= cap[1]) return 'fit';
  return 'nofit';
}

function entry(slot) {
  const rec = assigned.get(slot);
  if (!rec) return null;
  const u = poolUnits[rec.idx];
  if (!u) return null;
  return { html: u.html, meta: u, idx: rec.idx, token: rec.token };
}

export function acquire(slot, { sizeClass = 'med', eager = true } = {}) {
  if (!slot || poolUnits.length === 0) return null;
  if (assigned.has(slot)) {
    dupPrevented += 1;
    return entry(slot); // idempotent per slot
  }
  const maxPage = Number(poolCfg.maxAdsPerPage || 10);
  const maxSess = Number(poolCfg.maxAdsPerSession || 0);
  if (pageLoads >= maxPage) return null;
  if (maxSess > 0 && sessGet() >= maxSess) return null;
  const used = new Set([...assigned.values()].map((r) => r.idx));
  const fresh = [];
  const all = [];
  poolUnits.forEach((u, i) => {
    all.push({ u, i });
    if (used.has(i)) return;
    // Unit document.write (needsParser) tetap boleh dipakai slot lazy:
    // AdBox me-render-nya via iframe srcDoc (forceIso), jadi tidak hangus.
    fresh.push({ u, i });
  });
  // Seperti situs referensi: tiap slot harus terisi. Unit segar diutamakan;
  // bila habis, unit dipakai ulang dengan rotasi (variasi, tidak monoton).
  const list = fresh.length > 0 ? fresh : all;
  if (list.length === 0) return null;
  const rot = pageLoads % list.length;
  const free = list.slice(rot).concat(list.slice(0, rot));
  const exact = free.find(({ u }) => fits(u, sizeClass) === 'fit');
  const unknown = free.find(({ u }) => fits(u, sizeClass) === 'unknown');
  const smallest = [...free].sort((a, b) => area(a.u) - area(b.u))[0];
  const pick = exact || unknown || smallest;
  if (!pick) return null;
  if (pick !== exact) fallbackUsed += 1;
  const token = newToken();
  assigned.set(slot, { idx: pick.i, token });
  pageLoads += 1;
  sessSet(sessGet() + 1);
  return { html: pick.u.html, meta: pick.u, idx: pick.i, token };
}

// Kembalikan unit ke pool (maks 1x pindah). Hanya pemilik token yang boleh melepas.
export function releaseUnit(slot, token) {
  const cur = assigned.get(slot);
  if (cur && cur.token === token) assigned.delete(slot);
}

export function poolStats() {
  return {
    units: poolUnits.length,
    assigned: [...assigned.entries()].map(([slot, rec]) => ({ slot, idx: rec.idx })),
    pageLoads,
    sessionLoads: sessGet(),
    dupPrevented,
    fallbackUsed
  };
}
