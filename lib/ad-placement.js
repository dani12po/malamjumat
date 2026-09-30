// PlacementResolver + Opportunity Engine + density (§5, §7, §20, §22).
// - Prioritas slot per route+device; tiap unit dipakai MAKS 1x per halaman.
// - Cascade natural: unit pertama mengisi slot prioritas tertinggi.
// - Claim registry: 1 slot = 1 unit per pageview (anti duplikat init).

export function detectDevice(ua) {
  const s = String(ua || '');
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(s)) return 'mobile';
  if (/tablet|ipad/i.test(s)) return 'tablet';
  return 'desktop';
}

// Urutan = prioritas. Slot awal diisi dulu; sisanya kosong (null, bukan palsu).
const PLANS = {
  video: {
    desktop: ['pre1', 'pre2', 'post', 'desc', 'related', 'sidebar', 'footer', 'left', 'mobile'],
    tablet: ['pre1', 'pre2', 'post', 'desc', 'related', 'footer', 'mobile', 'sidebar', 'left'],
    mobile: ['pre1', 'post', 'mobile', 'desc', 'related', 'footer', 'pre2', 'sidebar', 'left']
  },
  folder: {
    desktop: ['top', 'native1', 'native2', 'bottom', 'footer', 'mobile'],
    tablet: ['top', 'native1', 'bottom', 'footer', 'mobile', 'native2'],
    mobile: ['top', 'native1', 'bottom', 'mobile', 'footer', 'native2']
  }
};

export function allocateUnits(units, route, device) {
  const list = Array.isArray(units) ? units.filter(Boolean) : [];
  const table = PLANS[route] || PLANS.video;
  const plan = table[device] || table.desktop;
  const out = {};
  let i = 0;
  for (const slot of plan) {
    out[slot] = i < list.length ? list[i++] : '';
  }
  return out;
}

// Checklist opportunity terpusat: unit ada, klaim bebas, device/viewport cocok.
export function evaluateOpportunity({ slot, unit, claimed, device, viewportW }) {
  if (!unit) return { valid: false, reason: 'no-unit' };
  if (claimed === false) return { valid: false, reason: 'duplicate' };
  if ((slot === 'sidebar' || slot === 'left') && device !== 'desktop') {
    return { valid: false, reason: 'device' };
  }
  if (slot === 'left' && (viewportW || 0) < 1440) return { valid: false, reason: 'viewport' };
  return { valid: true, reason: 'ok' };
}

function hashUnit(s) {
  const str = String(s || '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'u' + (h >>> 0).toString(36);
}

// Registry klaim per pageview: key = pathname + slot, nilai = { hash, token }.
// Klaim hanya dilepas oleh instance pemilik token yang sama.
const claims = new Map();

function newToken() {
  try {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return [...b].map((x) => x.toString(36)).join('') + Date.now().toString(36);
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export function claimSlot(pageKey, slot, unit) {
  const key = `${pageKey || '?'}::${slot || 'slot'}`;
  const h = hashUnit(unit);
  if (!claims.has(key)) {
    const token = newToken();
    claims.set(key, { h, token });
    return token;
  }
  const cur = claims.get(key);
  return cur.h === h ? cur.token : false;
}

export function releaseSlot(pageKey, slot, token) {
  const key = `${pageKey || '?'}::${slot || 'slot'}`;
  const cur = claims.get(key);
  if (cur && cur.token === token) claims.delete(key);
}
