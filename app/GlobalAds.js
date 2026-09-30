'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Hanya menyuntik script RESMI dari ad network (popunder / social bar / head script).
// Tidak ada panel buatan, tidak ada window.open direct-link sendiri.
// Popup/banner yang muncul 100% dari script network tersebut — seperti web beriklan pada umumnya.
function injectHtmlScripts(html) {
  if (!html || typeof document === 'undefined') return () => {};
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const added = [];
  holder.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    for (const attr of old.attributes) s.setAttribute(attr.name, attr.value);
    s.textContent = old.textContent || '';
    (document.head || document.body).appendChild(s);
    added.push(s);
  });
  return () => added.forEach((n) => n.remove());
}

export default function GlobalAds({ settings }) {
  const pathname = usePathname();
  const isAdmin = (pathname || '').startsWith('/admin');

  // Suntik sekali global di page user (/f/* dan /d/*).
  // PENGECUALIAN: /admin tidak disuntik script iklan apa pun.
  // TIDAK ada window.open paksa: link hanya terbuka saat iklan diklik user.
  useEffect(() => {
    if (isAdmin) return;
    const cleanups = [];
    // daftar kode script baru, fallback ke kolom lama bila belum migrasi
    const scripts = Array.isArray(settings?.adScripts) && settings.adScripts.length > 0
      ? settings.adScripts
      : [settings?.popunderScript, settings?.customHeadScript].filter(Boolean);
    scripts.forEach((html) => cleanups.push(injectHtmlScripts(html)));
    return () => cleanups.forEach((fn) => fn && fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Tidak render apa pun.
  return null;
}
