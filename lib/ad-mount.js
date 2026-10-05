// Mount banner aman: antrean global (mutex) agar satu unit banner atOptions
// dipasang pada satu waktu; lanjut setelah onload/onerror atau timeout 8 detik.
// Native/social/popunder TIDAK diantre (tidak perlu).
// Penting: script Adsterra (atOptions + invoke.js) harus dieksekusi dalam
// urutan yang benar — atOptions dulu (inline), baru invoke.js (external src).

let queue = Promise.resolve();

function mountScripts(container, html, { onFail, onDone } = {}) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const allScripts = [...tmp.querySelectorAll('script')];
  allScripts.forEach((n) => n.remove());
  container.innerHTML = tmp.innerHTML;

  if (allScripts.length === 0) {
    if (onDone) onDone();
    return;
  }

  // Pisahkan inline (atOptions config) dan src scripts (invoke.js)
  // Inline harus dieksekusi DULU sebelum src script
  const inlineScripts = allScripts.filter(s => !s.getAttribute('src'));
  const srcScripts = allScripts.filter(s => s.getAttribute('src'));
  const ordered = [...inlineScripts, ...srcScripts];

  let done = false;
  // Timeout lebih panjang: Adsterra kadang load lambat
  const timer = setTimeout(() => finish(true), 8000); // timeout = anggap ok
  function finish(ok) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (!ok && onFail) onFail();
    if (onDone) onDone();
  }

  // Mount script satu per satu secara berurutan agar atOptions terbaca sebelum invoke.js
  let idx = 0;
  function mountNext() {
    if (idx >= ordered.length) { finish(true); return; }
    const old = ordered[idx++];
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    if (!s.hasAttribute('data-cfasync')) s.setAttribute('data-cfasync', 'false');
    s.textContent = old.textContent || '';
    const srcAttr = s.getAttribute('src');
    if (!srcAttr) {
      // Inline script: eksekusi sinkron, langsung ke script berikutnya
      container.appendChild(s);
      mountNext();
      return;
    }
    // External script: tunggu load sebelum lanjut
    s.onload = () => mountNext();
    s.onerror = () => {
      // External gagal load — coba lanjut ke script berikutnya
      mountNext();
    };
    container.appendChild(s);
  }
  mountNext();
}

// Pasang HTML unit ke container. Banner lewat antrean; lainnya langsung.
export function mountAdUnit(container, meta, onFail) {
  if (!container) return null;
  const html = meta && meta.html ? meta.html : '';
  if (!html) return null;
  if (meta && meta.type === 'banner') {
    let cancelled = false;
    queue = queue.then(
      () =>
        new Promise((resolve) => {
          if (cancelled) return resolve();
          mountScripts(container, html, {
            onFail: () => {
              if (!cancelled && onFail) onFail();
            },
            onDone: resolve
          });
        })
    );
    return () => { cancelled = true; };
  }
  // Non-banner (native, script-otomatis): inject langsung tanpa antrean
  container.innerHTML = '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const scripts = [...tmp.querySelectorAll('script')];
  scripts.forEach((n) => n.remove());
  container.innerHTML = tmp.innerHTML;
  scripts.forEach((old) => {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    if (!s.hasAttribute('data-cfasync')) s.setAttribute('data-cfasync', 'false');
    s.textContent = old.textContent || '';
    s.onerror = onFail || null;
    container.appendChild(s);
  });
  return null;
}

// Isolasi banner di iframe srcDoc (opsional via settings.isolateBanners).
// Hanya aktif bila isolateBanners=true di settings (default false).
export function isolateHtml(meta) {
  if (!meta || meta.type !== 'banner' || !meta.width || !meta.height) return null;
  return { width: meta.width, height: meta.height, srcDoc: meta.html };
}
