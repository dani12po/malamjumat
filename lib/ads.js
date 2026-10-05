// Util iklan (aman dipakai di server & client).
// Adsterra punya dua kategori script:
//   1. "Auto-behavior": popunder, social bar, in-page push, native ads —
//      script src-only, cukup di-load ke <body> dan Adsterra otomatis
//      menampilkan overlay/popup/sticky bar. TIDAK butuh container HTML.
//   2. "Banner": punya atOptions + invoke.js atau container div — butuh
//      container di DOM, di-mount via pool client (AdBox).
// splitAdScripts memisahkan keduanya dengan benar.

export function splitAdScripts(settings) {
  const raws = Array.isArray(settings?.adScripts) && settings.adScripts.length > 0
    ? settings.adScripts.filter(Boolean)
    : [settings?.popunderScript, settings?.customHeadScript].filter(Boolean);

  // autoSrcs: URL script yang cukup di-load ke body (popunder/social bar/in-page push)
  // bodyHtml: kode HTML penuh yang butuh container (banner atOptions, native dengan div)
  const autoSrcs = [];
  const autoInlines = [];
  const bodyHtml = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

  for (const raw of raws) {
    const srcs = [];
    const inlines = [];
    let count = 0;
    let stripped = String(raw);
    scriptRe.lastIndex = 0;
    let m;
    while ((m = scriptRe.exec(String(raw))) !== null) {
      count++;
      const attrs = m[1] || '';
      const inner = (m[2] || '').trim();
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (srcMatch) srcs.push(srcMatch[1]);
      if (inner) inlines.push(inner);
      stripped = stripped.replace(m[0], '');
    }

    // Tidak ada tag script sama sekali → skip
    if (count === 0) continue;

    // Cek apakah ini banner (butuh container HTML):
    // - Punya atOptions (banner konfigurasi Adsterra)
    // - Punya div container-id (banner dengan placeholder div)
    // - Punya invoke.js (banner call Adsterra)
    const rawStr = String(raw);
    const hasBannerSignal =
      /atOptions\s*=/i.test(rawStr) ||
      /id=(["'])container-/i.test(rawStr) ||
      /invoke\.js/i.test(rawStr) ||
      /<div\b/i.test(rawStr);

    if (hasBannerSignal) {
      // Banner: masuk bodyHtml untuk dipool dan di-mount via AdBox
      bodyHtml.push(raw);
    } else if (srcs.length > 0 && inlines.length === 0 && stripped.trim() === '') {
      // Murni src-only tanpa inline code dan tanpa HTML lain
      // → auto-behavior script (popunder, social bar, in-page push)
      autoSrcs.push(...srcs);
    } else if (inlines.length > 0 && srcs.length === 0) {
      // Murni inline script tanpa src → bisa auto-inline (konfigurasi global)
      autoInlines.push(...inlines);
    } else {
      // Campuran src + inline tapi bukan banner → inject auto (src dulu, inline menyusul)
      autoSrcs.push(...srcs);
      autoInlines.push(...inlines);
    }
  }

  // headSrcs tetap dipertahankan untuk backward compatibility (alias autoSrcs)
  return {
    headSrcs: [...new Set(autoSrcs)],   // alias lama, tetap ada
    autoSrcs: [...new Set(autoSrcs)],   // URL script auto-behavior
    autoInlines: [...new Set(autoInlines)], // inline script global
    bodyHtml                             // HTML banner yang butuh container
  };
}

// Klasifikasi kasar berdasar pola kode (dashboard network tetap acuan utama).
export function detectUnitType(html) {
  const s = String(html || '');
  if (/<div\b[^>]*id=("|')container-/i.test(s) || /invoke\.js/i.test(s)) return 'banner';
  if (/native/i.test(s)) return 'native';
  if (/social/i.test(s)) return 'social';
  if (/popunder|pop-under/i.test(s)) return 'popunder';
  return 'script-otomatis';
}

// Parse metadata unit untuk pool: tipe, ukuran atOptions, id container.
// needsParser: unit document.write (atOptions) yang HANYA jalan bila
// di-parse browser (SSR/srcDoc) — tidak bisa di-inject pasca-load.
export function parseAdUnit(html) {
  const s = String(html || '');
  const type = detectUnitType(s);
  let width = 0;
  let height = 0;
  const at = s.match(/atOptions\s*=\s*\{([^}]*)\}/);
  const scope = at ? at[1] : s;
  const w = scope.match(/["']?width["']?\s*:\s*["']?(\d+)/i);
  const h = scope.match(/["']?height["']?\s*:\s*["']?(\d+)/i);
  if (w) width = Number(w[1]);
  if (h) height = Number(h[1]);
  let containerId = '';
  const c = s.match(/id=(["'])(container-[^"']+)\1/i);
  if (c) containerId = c[2];
  const needsParser = Boolean(at) && !containerId;
  return { type, width, height, containerId, needsParser };
}
