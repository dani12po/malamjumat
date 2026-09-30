'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackSession, setSessionContext } from '@/lib/ad-session';

const DEPTHS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DWELL_MS = [30000, 60000, 120000, 180000];

function deviceType() {
  if (typeof window === 'undefined') return 'unknown';
  const w = window.innerWidth || 0;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function AdSessionManager() {
  const pathname = usePathname();
  const depths = useRef(new Set());
  const hiddenAt = useRef(0);

  // Lifecycle tiap ganti halaman (navigasi SPA = lifecycle iklan baru).
  useEffect(() => {
    depths.current = new Set();
    const p = pathname || '/';
    trackSession('ROUTE_COMPLETE', { to: p });
    if (p.startsWith('/d/')) {
      setSessionContext({ page: 'video', video: p.split('/')[2] || '', device: deviceType() });
      trackSession('NAVIGATION', { to: 'video' });
    } else if (p.startsWith('/f/')) {
      setSessionContext({ page: 'folder', folder: p.split('/')[2] || '', device: deviceType() });
      trackSession('NAVIGATION', { to: 'folder' });
      trackSession('FOLDER_OPEN', {});
    } else {
      setSessionContext({ page: p, device: deviceType() });
      trackSession('NAVIGATION', { to: p });
      trackSession('PAGE_VIEW', {});
    }
    trackSession('PAGE_READY', {});
  }, [pathname]);

  // Scroll-depth engine.
  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const d of DEPTHS) {
        if (pct >= d && !depths.current.has(d)) {
          depths.current.add(d);
          trackSession('SCROLL_' + d, { depth: d });
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // Dwell-time checkpoints per halaman.
  useEffect(() => {
    const timers = DWELL_MS.map((ms) =>
      setTimeout(() => trackSession('SESSION_TIME_' + ms / 1000, { dwellMs: ms }), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [pathname]);

  // Focus/blur/exit/return + viewport.
  useEffect(() => {
    function onVis() {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        trackSession('PAGE_HIDDEN', {});
        return;
      }
      const away = Date.now() - (hiddenAt.current || Date.now());
      trackSession(away > 30000 ? 'PAGE_RETURN' : 'PAGE_FOCUS', { awayMs: away });
    }
    function onBlur() {
      trackSession('PAGE_BLUR', {});
    }
    function onExit() {
      trackSession('PAGE_EXIT', {});
    }
    let rzT = null;
    function onResize() {
      if (rzT) clearTimeout(rzT);
      rzT = setTimeout(() => {
        setSessionContext({ device: deviceType(), viewportW: window.innerWidth || 0 });
        trackSession('VIEWPORT_CHANGE', { w: window.innerWidth || 0 });
      }, 400);
    }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onExit);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onExit);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (rzT) clearTimeout(rzT);
    };
  }, []);

  // Intent navigasi: klik link internal (tanpa intercept, tanpa preventDefault).
  useEffect(() => {
    function onClick(e) {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="/"]') : null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      trackSession('ROUTE_CHANGE', { to: href });
      if (href.startsWith('/d/')) trackSession('RELATED_VIDEO_CLICK', { to: href });
      else if (href.startsWith('/f/')) {
        if (href.includes('?p=')) trackSession('PAGINATION', { to: href });
        else trackSession('CONTENT_CLICK', { to: href });
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
