'use client';
import { useEffect, useRef, useState } from 'react';
import { trackSession } from '@/lib/ad-session';
import { onAdEvent } from '@/lib/ad-events';
import { acquire, releaseUnit, poolFlags } from '@/lib/ad-pool';
import { mountAdUnit, isolateHtml } from '@/lib/ad-mount';
import { parseTrigger } from '@/lib/ad-scheduler';

// Slot unit Adsterra resmi via pool (HTML ditempel apa adanya, tanpa modifikasi).
// prop slot WAJIB unik per penempatan (pre-1, side-right, native-feed-3, ...).
// State machine: created -> reserved/loading -> loaded -> visible -> exposed;
// gagal -> failed (retry SEKALI 2s, lalu unit kembali ke pool); dilewati -> skipped.
// data-adreason selalu terisi untuk debugging.
// Refresh default MATI; bila settings.refreshSeconds >= 30: hanya saat terlihat +
// tab fokus, maks 3x per slot. (Cek kebijakan network sebelum mengaktifkan.)
// - Kosong/tak-valid = tidak render unit (tanpa palsu, tanpa CLS).
// - Satu init per slot per pageview + cleanup saat unmount (anti duplikat).

function bodyHasContent(el) {
  if (!el) return false;
  if (el.querySelector('iframe,img,ins,video,canvas,object,embed')) return true;
  return [...el.children].some(
    (c) => c.clientWidth > 0 && c.clientHeight > 0 && (c.textContent || '').trim() !== ''
  );
}

function clientDevice() {
  if (typeof window === 'undefined') return 'unknown';
  const w = window.innerWidth || 0;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function AdBox({
  slot,
  sizeClass = 'med',
  minH = 100,
  className = '',
  trigger = 'load'
}) {
  const slotName = slot || 'slot';
  const boxRef = useRef(null);
  const bodyRef = useRef(null);
  const [fired, setFired] = useState(trigger === 'load');
  const [unit, setUnit] = useState(null);
  const [reason, setReason] = useState(trigger === 'load' ? 'created' : 'reserved');
  const [adState, setAdState] = useState('created');
  const [refreshN, setRefreshN] = useState(0);
  const [showLabel, setShowLabel] = useState(false);
  const visibleSent = useRef(false);
  const oppSent = useRef(false);
  const triedRetry = useRef(false);
  const claimToken = useRef(null);
  const pathnameRef = useRef('');

  if (!slot && typeof window !== 'undefined') {
    console.warn('[ads] AdBox tanpa prop slot — pakai nama unik per penempatan.');
  }

  const rule = parseTrigger(trigger);

  // 1) Trigger engine: reserve (null) sampai pemicu terpenuhi. Reset per pageview.
  useEffect(() => {
    const p = window.location ? window.location.pathname : '';
    pathnameRef.current = p;
    if (rule.kind !== 'load') {
      setFired(false);
      setUnit(null);
      setReason('reserved');
      setAdState('created');
      setRefreshN(0);
      visibleSent.current = false;
      oppSent.current = false;
      triedRetry.current = false;
    }
    if (rule.kind === 'load') {
      setFired(true);
      return;
    }
    let off = null;
    let timer = null;
    let onScroll = null;
    if (rule.kind === 'scroll') {
      onScroll = () => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) return;
        if (Math.round((window.scrollY / max) * 100) >= rule.value) {
          setFired(true);
          window.removeEventListener('scroll', onScroll);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    } else if (rule.kind === 'dwell') {
      timer = setTimeout(() => setFired(true), Math.max(0, rule.value) * 1000);
    } else if (rule.kind === 'video:play' || rule.kind === 'video:complete' || rule.kind === 'return') {
      const ev = rule.kind === 'video:play' ? 'VIDEO_PLAY' : rule.kind === 'video:complete' ? 'VIDEO_COMPLETE' : 'PAGE_RETURN';
      off = onAdEvent(ev, () => {
        setFired(true);
        if (off) off();
      });
    } else if (rule.kind === 'video:progress') {
      off = onAdEvent('VIDEO_PROGRESS', (d) => {
        if (d && Number(d.percent) >= rule.value) {
          setFired(true);
          if (off) off();
        }
      });
    }
    return () => {
      if (onScroll) window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
      if (off) off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // 2) Acquire dari pool setelah device/viewport lolos (skipped tidak klaim).
  useEffect(() => {
    if (!fired) return;
    setAdState('loading');
    const device = clientDevice();
    const vw = window.innerWidth || 0;
    if ((slotName === 'sidebar' || slotName === 'side-right' || slotName === 'side-left') && device !== 'desktop') {
      return skip('device');
    }
    if (slotName === 'side-left' && vw < 1440) {
      return skip('viewport');
    }
    const got = acquire(slotName, { sizeClass });
    if (!got) {
      return skip('no-unit');
    }
    claimToken.current = got.token || null;
    setUnit(got);
    setReason('ok');
    if (!oppSent.current) {
      oppSent.current = true;
      trackSession('AD_OPPORTUNITY', { slot: slotName, unit: got.idx });
    }
    function skip(r) {
      setReason(r);
      setAdState('skipped');
      trackSession('AD_SKIPPED', { slot: slotName, reason: r });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fired]);

  // 3) Mount (antrean banner) / isolate iframe; retry SEKALI lalu lepas unit.
  useEffect(() => {
    if (!unit) return;
    const el = bodyRef.current;
    const flags = poolFlags();
    if (flags.isolateBanners) {
      const iso = isolateHtml(unit.meta);
      if (iso) {
        setAdState('loaded');
        trackSession('AD_EXPOSED', { slot: slotName, unit: unit.idx, reason: 'isolated' });
        return () => {
          releaseUnit(slotName, claimToken.current);
        };
      }
    }
    let cancelled = false;
    const doMount = (isRetry) => {
      mountAdUnit(
        el,
        unit.meta,
        () => {
          if (cancelled) return;
          if (!isRetry) {
            triedRetry.current = true;
            setTimeout(() => {
              if (!cancelled) doMount(true);
            }, 2000);
            return;
          }
          setReason('failed');
          setAdState('failed');
          trackSession('AD_ERROR', { slot: slotName, unit: unit.idx });
          releaseUnit(slotName, claimToken.current); // kembalikan ke pool: maks 1x pindah
        }
      );
    };
    doMount(false);
    setAdState('loaded');
    trackSession('AD_EXPOSED', { slot: slotName, unit: unit.idx, reason: 'ok' });
    // Label + ruang hanya bila konten benar-benar ter-render (maks 2.5 dtk).
    const labelTimer = setTimeout(() => {
      if (!cancelled && bodyHasContent(el)) setShowLabel(true);
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(labelTimer);
      releaseUnit(slotName, claimToken.current);
      if (el) el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // 4) Terlihat (sekali) + refresh terkendali (default mati).
  useEffect(() => {
    if (!unit || visibleSent.current) return;
    const el = boxRef.current;
    const mark = () => {
      if (visibleSent.current) return;
      visibleSent.current = true;
      setAdState('visible');
      trackSession('AD_VISIBLE', { slot: slotName, unit: unit.idx });
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
  }, [unit, slotName]);

  useEffect(() => {
    const flags = poolFlags();
    const sec = Number(flags.refreshSeconds || 0);
    if (!unit || !(sec >= 30)) return; // default MATI
    let n = 0;
    const t = setInterval(() => {
      if (n >= 3 || document.hidden) return; // maks 3x + hanya tab fokus
      const el = bodyRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < (window.innerHeight || 0);
      if (!inView) return;
      n += 1;
      setRefreshN(n);
      mountAdUnit(el, unit.meta, null);
      trackSession('AD_REFRESH', { slot: slotName, unit: unit.idx, n });
    }, sec * 1000);
    return () => clearInterval(t);
  }, [unit, slotName]);

  // Skipped/failed = tidak render sama sekali (tanpa display:none,
  // tanpa ruang mati; status tetap terlacak di debug panel).
  if (!unit || adState === 'skipped' || adState === 'failed') return null;
  const iso = poolFlags().isolateBanners ? isolateHtml(unit.meta) : null;
  const showMinH = showLabel && minH ? { minHeight: minH } : undefined;
  return (
    <div ref={boxRef} className={`adbox ${className}`} data-adstate={adState} data-adslot={slotName} data-adreason={reason}>
      {showLabel || iso ? <span className="adbox-label">Advertisement</span> : null}
      {iso ? (
        <iframe title={`ad-${slotName}`} srcDoc={iso.srcDoc} width={iso.width} height={iso.height} sandbox="allow-scripts allow-popups" loading="lazy" style={{ border: 0, maxWidth: '100%' }} />
      ) : (
        <div ref={bodyRef} className="adbox-body" style={showMinH} />
      )}
    </div>
  );
}
