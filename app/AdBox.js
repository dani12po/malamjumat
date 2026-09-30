'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trackSession } from '@/lib/ad-session';
import { onAdEvent } from '@/lib/ad-events';
import { evaluateOpportunity, claimSlot, releaseSlot } from '@/lib/ad-placement';

// Slot unit Adsterra resmi (HTML ditempel apa adanya, tanpa modifikasi).
// State machine: created -> loading -> loaded -> visible -> exposed;
// gagal -> failed (sekali, TANPA retry). dilewati -> skipped.
// - Opportunity dievaluasi terpusat (unit, klaim, device, viewport).
// - Kosong/tak-valid = tidak render unit (tanpa palsu, tanpa CLS).
// - lazy = dekat viewport (IO); eagerOnPlay = reveal saat Play (sekali).
// - Klaim 1 slot = 1 unit per pageview + cleanup (anti duplikat).

function mountAdHtml(container, html, onFail) {
  if (!container) return null;
  container.innerHTML = '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const scripts = [...tmp.querySelectorAll('script')];
  scripts.forEach((n) => n.remove());
  container.innerHTML = tmp.innerHTML;
  if (scripts.length === 0) return null;
  let failed = false;
  const markFail = () => {
    if (failed) return;
    failed = true;
    if (onFail) onFail();
  };
  scripts.forEach((old) => {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    if (!s.hasAttribute('data-cfasync')) s.setAttribute('data-cfasync', 'false');
    s.textContent = old.textContent || '';
    s.onerror = markFail;
    container.appendChild(s);
  });
  let cancelled = false;
  const timer = setTimeout(() => {
    if (cancelled || failed || !container) return;
    if (container.textContent.trim() === '' && container.querySelectorAll('iframe,img,ins').length === 0) {
      markFail();
    }
  }, 8000);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

function clientDevice() {
  if (typeof window === 'undefined') return 'unknown';
  const w = window.innerWidth || 0;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function AdBox({ html, slot = 'slot', minH = 100, className = '', lazy = false, eagerOnPlay = false }) {
  const pathname = usePathname();
  const boxRef = useRef(null);
  const bodyRef = useRef(null);
  const [ready, setReady] = useState(!lazy);
  const [adState, setAdState] = useState('created');
  const [verdict, setVerdict] = useState(null);
  const visibleSent = useRef(false);
  const oppSent = useRef(false);

  // Opportunity tercatat sekali saat slot valid ada (bukan impression).
  useEffect(() => {
    if (!html || oppSent.current) return;
    oppSent.current = true;
    trackSession('AD_OPPORTUNITY', { slot });
  }, [html, slot]);

  // Evaluasi terpusat saat siap dipasang.
  useEffect(() => {
    if (!html || !ready || verdict) return;
    const v = evaluateOpportunity({
      slot,
      unit: html,
      claimed: claimSlot(pathname, slot, html),
      device: clientDevice(),
      viewportW: typeof window === 'undefined' ? 0 : window.innerWidth || 0
    });
    setVerdict(v);
    if (!v.valid) setAdState('skipped');
  }, [html, ready, verdict, slot, pathname]);

  // Lazy via scroll.
  useEffect(() => {
    if (!html || ready) return;
    setAdState('loading');
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: '500px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [html, ready]);

  // Event engagement: Play -> pasang lebih awal (sekali saja).
  useEffect(() => {
    if (!html || ready || !eagerOnPlay) return;
    const off = onAdEvent('VIDEO_PLAY', () => {
      setReady(true);
      off();
    });
    return off;
  }, [html, ready, eagerOnPlay]);

  // Init unit sekali; lepas klaim + bersihkan saat unmount.
  useEffect(() => {
    if (!html || !ready || !verdict || !verdict.valid) return;
    const el = bodyRef.current;
    const cancelEmpty = mountAdHtml(el, html, () => {
      setAdState('failed');
      trackSession('AD_ERROR', { slot });
    });
    setAdState('loaded');
    trackSession('AD_EXPOSED', { slot });
    return () => {
      if (cancelEmpty) cancelEmpty();
      releaseSlot(pathname, slot);
      if (el) el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, ready, verdict]);

  // Tandai terlihat (sekali).
  useEffect(() => {
    if (!html || !ready || !verdict || !verdict.valid || visibleSent.current) return;
    const el = boxRef.current;
    const mark = () => {
      if (visibleSent.current) return;
      visibleSent.current = true;
      setAdState('visible');
      trackSession('AD_VISIBLE', { slot });
    };
    if (!el || typeof IntersectionObserver === 'undefined') {
      mark();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mark();
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [html, ready, verdict, slot]);

  if (!html) return null;
  return (
    <div ref={boxRef} className={`adbox ${className}`} data-adstate={adState} data-adslot={slot}>
      <span className="adbox-label">Advertisement</span>
      <div ref={bodyRef} className="adbox-body" style={minH ? { minHeight: minH } : undefined} />
    </div>
  );
}
