'use client';
import { useEffect } from 'react';

// Menginjeksikan script Adsterra "auto-behavior" (popunder, social bar,
// in-page push, native ads) ke dalam <body> satu kali per mount.
// Script jenis ini tidak butuh container HTML — cukup di-load dan mereka
// otomatis membuat overlay/popup/sticky sesuai konfigurasi di dashboard Adsterra.
// TIDAK boleh pakai <Script strategy="beforeInteractive"> karena:
//   1. Next.js hanya izinkan beforeInteractive di <head>, bukan <body>
//   2. Script ini tidak perlu blocking — non-blocking sudah cukup
// Deduplikasi per src supaya SPA navigation tidak double-inject.

const injected = new Set();

function injectScript(src) {
  if (!src || typeof document === 'undefined') return;
  // Normalisasi: protocol-relative → https
  const normalized = src.startsWith('//') ? 'https:' + src : src;
  if (injected.has(normalized)) return;
  // Cek apakah sudah ada di DOM (misalnya dari render sebelumnya)
  if (document.querySelector(`script[src="${CSS.escape ? CSS.escape(normalized) : normalized}"]`)) {
    injected.add(normalized);
    return;
  }
  injected.add(normalized);
  const s = document.createElement('script');
  s.src = normalized;
  s.async = true;
  s.setAttribute('data-cfasync', 'false');
  s.onerror = () => {
    // Hapus dari set bila gagal agar bisa dicoba ulang di navigasi berikutnya
    injected.delete(normalized);
  };
  document.body.appendChild(s);
}

function injectInlineScript(code) {
  if (!code || typeof document === 'undefined') return;
  const key = code.trim().slice(0, 80);
  if (injected.has('inline:' + key)) return;
  injected.add('inline:' + key);
  const s = document.createElement('script');
  s.setAttribute('data-cfasync', 'false');
  s.textContent = code;
  document.body.appendChild(s);
}

// srcs: string[] — URL src script (popunder, social bar, in-page push)
// inlines: string[] — kode inline yang perlu dieksekusi tanpa container
export default function AdAutoScripts({ srcs = [], inlines = [] }) {
  useEffect(() => {
    // Inject src scripts
    for (const src of srcs) {
      injectScript(src);
    }
    // Inject inline scripts (misalnya kode konfigurasi sebelum script utama)
    for (const code of inlines) {
      injectInlineScript(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
