// Bus event iklan terpusat: PAGE_VIEW, VIDEO_OPEN, VIDEO_PLAY, VIDEO_PAUSE,
// VIDEO_RESUME, VIDEO_PROGRESS, VIDEO_COMPLETE, FOLDER_OPEN, SCROLL_DEPTH,
// NAVIGATION, RELATED_VIDEO_CLICK, USER_INTERACTION.
// Murni sinyal (tanpa klik paksa): konsumen hanya me-reveal placement valid,
// lazy-load, atau mengandalkan behavior resmi script Adsterra.

const listeners = new Map();

export const AD_EVENT = {
  PAGE_VIEW: 'PAGE_VIEW',
  VIDEO_OPEN: 'VIDEO_OPEN',
  VIDEO_PLAY: 'VIDEO_PLAY',
  VIDEO_PAUSE: 'VIDEO_PAUSE',
  VIDEO_RESUME: 'VIDEO_RESUME',
  VIDEO_PROGRESS: 'VIDEO_PROGRESS',
  VIDEO_COMPLETE: 'VIDEO_COMPLETE',
  FOLDER_OPEN: 'FOLDER_OPEN',
  SCROLL_DEPTH: 'SCROLL_DEPTH',
  NAVIGATION: 'NAVIGATION',
  RELATED_VIDEO_CLICK: 'RELATED_VIDEO_CLICK',
  USER_INTERACTION: 'USER_INTERACTION',
  VIDEO_START: 'VIDEO_START',
  VIDEO_VISIBLE: 'VIDEO_VISIBLE',
  PAGE_FOCUS: 'PAGE_FOCUS',
  PAGE_RETURN: 'PAGE_RETURN',
  SESSION_RETURN: 'SESSION_RETURN',
  AD_EXPOSED: 'AD_EXPOSED',
  AD_VISIBLE: 'AD_VISIBLE',
  PAGE_READY: 'PAGE_READY',
  PAGE_HIDDEN: 'PAGE_HIDDEN',
  PAGE_BLUR: 'PAGE_BLUR',
  PAGE_EXIT: 'PAGE_EXIT',
  ROUTE_CHANGE: 'ROUTE_CHANGE',
  ROUTE_COMPLETE: 'ROUTE_COMPLETE',
  VIDEO_READY: 'VIDEO_READY',
  CONTENT_CLICK: 'CONTENT_CLICK',
  PAGINATION: 'PAGINATION',
  VIDEO_TIME: 'VIDEO_TIME',
  PRE_PLAY_OPPORTUNITY: 'PRE_PLAY_OPPORTUNITY'
};

export function onAdEvent(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => {
    const s = listeners.get(name);
    if (s) s.delete(fn);
  };
}

export function emitAdEvent(name, data) {
  if (typeof window === 'undefined') return;
  const s = listeners.get(name);
  if (!s) return;
  s.forEach((fn) => {
    try {
      fn(data);
    } catch {
      // satu listener gagal tidak boleh merusak lainnya
    }
  });
}
