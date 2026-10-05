'use client';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

// Intercept klik kartu video: 2x buka iklan dulu, klik ke-3 baru navigate.
// Flow:
//   Klik 1 → buka iklan tab baru, state = 'ad1'
//   Klik 2 → buka iklan tab baru lagi, state = 'ad2'
//   Klik 3 → navigate ke video
// Counter per video per session (sessionStorage). Setelah 2x intercept
// terpenuhi, klik berikutnya di session ini langsung navigate.
// Bila tidak ada backlink → navigate langsung.

const MAX_CARD_INTERCEPTS = 2;

function getCardCount(videoId) {
  try {
    return Number(sessionStorage.getItem(`card-ad-${videoId}`) || '0') || 0;
  } catch { return 0; }
}

function incCardCount(videoId) {
  try {
    const n = getCardCount(videoId) + 1;
    sessionStorage.setItem(`card-ad-${videoId}`, String(n));
    return n;
  } catch { return 1; }
}

function pickBacklink(backlinks) {
  const list = Array.isArray(backlinks) ? backlinks.filter(Boolean) : [];
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// children = konten kartu (thumbnail, label, play badge, dll)
// href     = URL tujuan video (/d/[id])
// videoId  = ID video untuk tracking per-video
// backlinks = array URL iklan dari settings
// className = class wrapper
export default function VideoCardLink({
  href,
  videoId,
  backlinks = [],
  className = '',
  ariaLabel = '',
  children
}) {
  const router = useRouter();
  // state disimpan di DOM attr agar tidak re-render keseluruhan komponen
  const clicksRef = useRef(0);

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const count = getCardCount(videoId);
    const backlink = pickBacklink(backlinks);

    // Sudah pernah intercept 2x di session ini → langsung navigate
    if (!backlink || count >= MAX_CARD_INTERCEPTS) {
      router.push(href);
      return;
    }

    // Buka iklan di tab baru (dipicu dari user gesture → tidak di-block browser)
    try {
      window.open(backlink, '_blank', 'noopener');
    } catch {
      // popup di-block → tetap hitung dan lanjut
    }

    const newCount = incCardCount(videoId);

    // Kalau sudah 2x intercept, klik ini (ke-3 dari user) = navigate setelah buka iklan
    // Tidak — kita beri 1 klik extra: iklan ke-2 dulu, lalu klik ke-3 navigate.
    // Jadi: klik 1 = iklan, klik 2 = iklan, klik 3 = navigate.
    // newCount sudah incremented, kalau >= MAX maka klik berikutnya navigate.
    // Klik ini sendiri masih buka iklan, belum navigate.
  }

  return (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
