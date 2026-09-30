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
