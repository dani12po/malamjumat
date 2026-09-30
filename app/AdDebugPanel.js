'use client';
import { useEffect, useState } from 'react';
import { getSessionSnapshot } from '@/lib/ad-session';

// Panel debug monetisasi: DEV ONLY (tidak dirender di production).
// - Heatmap slot: hijau=visible/exposed, kuning=loading/loaded, merah=failed,
//   biru=skipped, abu=created.
// - Timeline event + health per slot (observability internal, bukan metric Adsterra).
const STATE_COLORS = {
  visible: '#22c55e',
  exposed: '#22c55e',
  loaded: '#eab308',
  loading: '#eab308',
  failed: '#ef4444',
  skipped: '#60a5fa',
  created: '#9ca3af'
};

export default function AdDebugPanel() {
  const [snap, setSnap] = useState(null);
  const [domStates, setDomStates] = useState({});

  useEffect(() => {
    function refresh() {
      try {
        setSnap(getSessionSnapshot());
        const counts = {};
        document.querySelectorAll('[data-adstate]').forEach((el) => {
          const st = el.getAttribute('data-adstate') || '?';
          counts[st] = (counts[st] || 0) + 1;
        });
        setDomStates(counts);
      } catch {
        // abaikan
      }
    }
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  if (!snap) return null;
  const events = Object.entries(snap.counts || {}).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const slots = snap.slots || {};
  const timeline = (snap.timeline || []).slice(-10).reverse();
  return (
    <div className="ad-debug">
      <div className="ad-debug-title">AD DEBUG (dev)</div>
      <div>Route: {String(snap.context?.page || '-')} | Device: {String(snap.context?.device || '-')}</div>
      <div>Exposures: {snap.exposures} | DOM: {Object.entries(domStates).map(([k, v]) => `${k}:${v}`).join(' ') || '-'}</div>
      <div className="ad-debug-heat">
        {Object.keys(slots).length === 0 ? <span>-</span> : Object.entries(slots).map(([name, s]) => {
          const color = s.errors > 0 ? STATE_COLORS.failed : s.visibles > 0 ? STATE_COLORS.visible : s.exposures > 0 ? STATE_COLORS.exposed : s.opportunities > 0 ? STATE_COLORS.loading : STATE_COLORS.created;
          return (
            <span key={name} className="ad-debug-chip" style={{ borderColor: color, color }}>
              {name} o{s.opportunities}/e{s.exposures}/v{s.visibles}{s.errors > 0 ? `/x${s.errors}` : ''}
            </span>
          );
        })}
      </div>
      <div>Events: {events.map(([k, v]) => `${k}×${v}`).join(' ') || '-'}</div>
      <div className="ad-debug-timeline">
        {(snap.timeline || []).slice(-8).map((e, i) => (
          <span key={`${e.t}-${i}`}>{new Date(e.t).toLocaleTimeString('id-ID', { hour12: false })} {e.name} </span>
        ))}
        {timeline.length === 0 ? <span>-</span> : null}
      </div>
    </div>
  );
}
