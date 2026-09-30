'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Overlay iklan transparan: fixed position, NOL geser layout, NOL space kosong.
// - Sticky bottom: unit banner pertama, ada tombol tutup per pageview.
// - Interstitial: unit kedua (bila ada), 1x per sesi, tutup aktif setelah 5 detik.
// HTML network dirender mentah (SSR) agar script document.write/container jalan.

export default function AdOverlays({ units }) {
  const pathname = usePathname();
  const [barClosed, setBarClosed] = useState(false);
  const [showPop, setShowPop] = useState(false);
  const [popCount, setPopCount] = useState(5);

  const sticky = units && units.length > 0 ? units[0] : '';
  const inter = units && units.length > 1 ? units[1] : '';

  // Tampilkan lagi tiap pindah page; interstitial 1x per sesi.
  useEffect(() => {
    setBarClosed(false);
    try {
      if (inter && !sessionStorage.getItem('adpop-seen')) {
        const t = setTimeout(() => setShowPop(true), 2500);
        return () => clearTimeout(t);
      }
    } catch { /* storage mati -> skip interstitial */ }
    setShowPop(false);
  }, [pathname, inter]);

  // Countdown tombol tutup interstitial.
  useEffect(() => {
    if (!showPop) return;
    if (popCount <= 0) return;
    const t = setTimeout(() => setPopCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showPop, popCount]);

  function closePop() {
    try { sessionStorage.setItem('adpop-seen', '1'); } catch { /* abaikan */ }
    setShowPop(false);
  }

  return (
    <>
      {sticky && !barClosed ? (
        <div className="ad-float-bottom" role="complementary" aria-label="Iklan">
          <button className="ad-float-close" aria-label="Tutup iklan" onClick={() => setBarClosed(true)}>✕</button>
          <div className="ad-float-body" dangerouslySetInnerHTML={{ __html: sticky }} />
        </div>
      ) : null}
      {inter && showPop ? (
        <div className="ad-inter" role="dialog" aria-label="Iklan">
          <div className="ad-inter-box">
            {popCount > 0 ? (
              <span className="ad-inter-wait">Tutup dalam {popCount}…</span>
            ) : (
              <button className="ad-float-close ad-inter-close" aria-label="Tutup iklan" onClick={closePop}>✕ Tutup</button>
            )}
            <div className="ad-inter-body" dangerouslySetInnerHTML={{ __html: inter }} />
          </div>
        </div>
      ) : null}
    </>
  );
}
