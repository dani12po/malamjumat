'use client';
import { useEffect, useRef, useState } from 'react';
import { trackSession } from '@/lib/ad-session';
import { acquire, releaseUnit, poolFlags } from '@/lib/ad-pool';
import { mountAdUnit } from '@/lib/ad-mount';

// Sticky footer (mobile 320x50 / lebar desktop): fixed, TOMBOL TUTUP ASLI,
// pilihan diingat per sesi. Muncul setelah dwell 20 dtk. Tanpa unit = null.
// Tidak dirender di /admin (layout yang mengatur). Bukan overlay player.
export default function StickyFooterAd() {
  const [unit, setUnit] = useState(null);
  const [closed, setClosed] = useState(false);
  const token = useRef(null);

  useEffect(() => {
    let closedSession = false;
    try {
      closedSession = sessionStorage.getItem('sticky-closed') === '1';
    } catch {
      // abaikan
    }
    if (closedSession) {
      setClosed(true);
      return;
    }
    const flags = poolFlags();
    if (!flags.stickyFooter) return;
    const t = setTimeout(() => {
      const wide = typeof window !== 'undefined' && (window.innerWidth || 0) >= 1024;
      const got = acquire('sticky-footer', { sizeClass: wide ? 'wide' : 'mobile' });
      if (!got) return;
      token.current = got.token || null;
      setUnit(got);
      trackSession('AD_EXPOSED', { slot: 'sticky-footer', unit: got.idx, reason: 'ok' });
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!unit) return;
    const el = document.getElementById('sticky-footer-body');
    const cancel = mountAdUnit(el, unit.meta, () => {
      trackSession('AD_ERROR', { slot: 'sticky-footer', unit: unit.idx });
      releaseUnit('sticky-footer', token.current);
      setUnit(null);
    });
    return () => {
      if (cancel) cancel();
      releaseUnit('sticky-footer', token.current);
      if (el) el.innerHTML = '';
    };
  }, [unit]);

  function close() {
    try {
      sessionStorage.setItem('sticky-closed', '1');
    } catch {
      // abaikan
    }
    releaseUnit('sticky-footer', token.current);
    setUnit(null);
    setClosed(true);
  }

  if (closed || !unit) return null;
  return (
    <div className="sticky-footer" role="complementary" aria-label="Iklan">
      <button className="sticky-close" aria-label="Tutup iklan" onClick={close}>✕</button>
      <span className="adbox-label">Advertisement</span>
      <div id="sticky-footer-body" className="sticky-body" />
    </div>
  );
}
