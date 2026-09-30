// Util iklan (aman dipakai di server & client).
// Sesuai docs Adsterra: Popunder dimuat sebelum </head> agar tayang cepat,
// Social Bar sebelum </body>. Script src-only bisa dimuat paling awal
// (beforeInteractive); sisanya (inline/kompleks) disuntik via client.

export function splitAdScripts(settings) {
  const raws = Array.isArray(settings?.adScripts) && settings.adScripts.length > 0
    ? settings.adScripts.filter(Boolean)
    : [settings?.popunderScript, settings?.customHeadScript].filter(Boolean);

  const headSrcs = [];
  const bodyHtml = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

  for (const raw of raws) {
    const srcs = [];
    let count = 0;
    let ok = true;
    let stripped = String(raw);
    scriptRe.lastIndex = 0;
    let m;
    while ((m = scriptRe.exec(String(raw))) !== null) {
      count++;
      const attrs = m[1] || '';
      const inner = (m[2] || '').trim();
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (!srcMatch || inner !== '') { ok = false; break; }
      srcs.push(srcMatch[1]);
      stripped = stripped.replace(m[0], '');
    }
    if (ok && count > 0 && stripped.trim() === '') headSrcs.push(...srcs);
    else bodyHtml.push(raw);
  }

  return { headSrcs: [...new Set(headSrcs)], bodyHtml };
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
