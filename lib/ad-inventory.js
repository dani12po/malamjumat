// Registry inventaris Adsterra (§2): dibangun otomatis dari unit tersimpan.
// Tak ada ID yang dikarang — semua dari kode resmi (key/atOptions/path).
// Status runtime (init/loaded/visible/exposed/failed) digabung dari telemetry.

function extractId(meta, html) {
  const s = String(html || '');
  const atKey = s.match(/atOptions\s*=\s*\{[^}]*?['"]?key['"]?\s*:\s*['"]([^'"]+)/i);
  if (atKey) return atKey[1].slice(0, 24);
  const qKey = s.match(/[?&]key=([0-9a-f]{8,})/i);
  if (qKey) return qKey[1].slice(0, 24);
  const path = s.match(/cheflobesofficer\.com\/([a-z0-9/\-.]+?)(?:\.js|\?|$)/i);
  if (path) return path[1].replace(/\//g, ':').slice(0, 24);
  return `unit-${(meta && meta.idx !== undefined ? meta.idx : Math.abs(hash(html) % 997))}`;
}

function hash(s) {
  const str = String(s || '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h;
}

function suitability(meta) {
  const w = Number(meta.width) || 0;
  if (w >= 700) return { desktop: true, tablet: true, mobile: false };
  if (w > 0 && w <= 360) return { desktop: true, tablet: true, mobile: true };
  return { desktop: true, tablet: true, mobile: true };
}

export function buildInventory(units) {
  return (units || []).map((u, i) => {
    const type = u.type || 'script-otomatis';
    const routes = type === 'banner' || type === 'native'
      ? ['/', '/f/*', '/d/*']
      : ['global'];
    return {
      id: extractId(u, u.html),
      idx: i,
      type,
      format: u.width && u.height ? `${u.width}x${u.height}` : 'auto',
      width: u.width || 0,
      height: u.height || 0,
      containerId: u.containerId || '',
      ...suitability(u),
      supportedRoutes: routes,
      supportedContexts: type === 'banner' || type === 'native' ? ['inline'] : ['auto-behavior']
    };
  });
}

// Gabung registry statis + telemetry runtime per unit.
export function inventoryHealth(inventory, slotStats) {
  const byUnit = {};
  for (const [slot, s] of Object.entries(slotStats || {})) {
    const idx = s.unit;
    if (idx === undefined || idx === null) continue;
    if (!byUnit[idx]) byUnit[idx] = { exposures: 0, visibles: 0, errors: 0, slots: [] };
    byUnit[idx].exposures += s.exposures || 0;
    byUnit[idx].visibles += s.visibles || 0;
    byUnit[idx].errors += s.errors || 0;
    if (!byUnit[idx].slots.includes(slot)) byUnit[idx].slots.push(slot);
  }
  return (inventory || []).map((u, i) => ({
    ...u,
    initializationState: 'single',
    loadedState: (byUnit[i]?.exposures || 0) > 0 ? 'loaded' : 'pending',
    visibleState: (byUnit[i]?.visibles || 0) > 0 ? 'visible' : 'pending',
    exposedState: byUnit[i]?.exposures || 0,
    failureState: (byUnit[i]?.errors || 0) > 0 ? 'failed' : 'ok',
    activeSlots: byUnit[i]?.slots || []
  }));
}
