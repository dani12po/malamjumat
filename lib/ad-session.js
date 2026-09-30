import { emitAdEvent } from './ad-events';

// AdSessionManager: satu pintu tracking session.
// track() mencatat (counter, exposure, timeline, slot-stats) LALU meneruskan
// ke bus agar placement bisa bereaksi. Tanpa klik paksa, tanpa auto-klik.
// Metric murni internal debugging — tidak dikirim ke Adsterra.
const state = {
  sessionId: '',
  counts: {},
  exposures: 0,
  lastEvent: '',
  context: {},
  timeline: [],
  slots: {}
};

function ensureSid() {
  if (state.sessionId) return state.sessionId;
  try {
    let s = sessionStorage.getItem('ad-sess');
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('ad-sess', s);
    }
    state.sessionId = s;
  } catch {
    state.sessionId = 'srv';
  }
  return state.sessionId;
}

function bumpSlot(slot, field, extra) {
  if (!slot) return;
  if (!state.slots[slot]) state.slots[slot] = { opportunities: 0, exposures: 0, visibles: 0, errors: 0, unit: null, reason: '' };
  state.slots[slot][field] += 1;
  if (extra && extra.unit !== undefined) state.slots[slot].unit = extra.unit;
  if (extra && extra.reason) state.slots[slot].reason = extra.reason;
}

export function trackSession(name, data) {
  state.counts[name] = (state.counts[name] || 0) + 1;
  state.lastEvent = name;
  if (name === 'AD_EXPOSED') state.exposures += 1;
  const slot = data && data.slot;
  const extra = { unit: data && data.unit !== undefined ? data.unit : undefined, reason: (data && data.reason) || '' };
  if (name === 'AD_OPPORTUNITY') bumpSlot(slot, 'opportunities', extra);
  if (name === 'AD_EXPOSED') bumpSlot(slot, 'exposures', extra);
  if (name === 'AD_VISIBLE') bumpSlot(slot, 'visibles', extra);
  if (name === 'AD_ERROR') bumpSlot(slot, 'errors', extra);
  try {
    state.timeline.push({ t: Date.now(), name });
    if (state.timeline.length > 40) state.timeline.splice(0, state.timeline.length - 40);
  } catch {
    // abaikan
  }
  if (typeof window !== 'undefined') ensureSid();
  emitAdEvent(name, { ...(data || {}), session: state.sessionId });
  return getSessionSnapshot();
}

export function setSessionContext(ctx) {
  state.context = { ...state.context, ...(ctx || {}) };
}

export function getSessionSnapshot() {
  const slots = {};
  for (const k of Object.keys(state.slots)) slots[k] = { ...state.slots[k] };
  return {
    sessionId: state.sessionId,
    counts: { ...state.counts },
    exposures: state.exposures,
    lastEvent: state.lastEvent,
    context: { ...state.context },
    timeline: state.timeline.slice(-20),
    slots
  };
}
