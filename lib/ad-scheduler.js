// Scheduler deklaratif: aturan trigger per slot.
// trigger: 'load' | 'scroll:<pct>' | 'dwell:<detik>' | 'video:play' |
//          'video:progress:<pct>' | 'video:complete' | 'return'
// maxPerSession: batas tampil per slot per sesi (frequency control jujur).
// Aturan hanya MEMPERCEPAT reveal; slot tanpa unit tetap null (tanpa palsu).

export const DEFAULT_RULES = {
  sidebar: { trigger: 'scroll:10' },
  'side-right': { trigger: 'scroll:10' },
  'side-left': { trigger: 'scroll:10' },
  'mid-content': { trigger: 'scroll:10' },
  native: { trigger: 'scroll:10' },
  'sticky-footer': { trigger: 'dwell:8' },
  'related-bottom': { trigger: 'video:progress:25' },
  'bottom-2': { trigger: 'scroll:15' }
};

export function ruleFor(slot) {
  return DEFAULT_RULES[slot] || { trigger: 'load' };
}

export function parseTrigger(trigger) {
  const t = String(trigger || 'load');
  const m = t.match(/^(scroll|dwell|video:progress):(\d+)$/);
  if (m) return { kind: m[1], value: Number(m[2]) };
  if (t === 'video:play' || t === 'video:complete' || t === 'return' || t === 'load') {
    return { kind: t, value: 0 };
  }
  return { kind: 'load', value: 0 };
}
