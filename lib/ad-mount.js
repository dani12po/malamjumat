// Mount banner aman: antrean global (mutex) agar satu unit banner atOptions
// dipasang pada satu waktu; lanjut setelah onload/onerror atau timeout 3 detik.
// Native/social/popunder TIDAK diantre (tidak perlu).

let queue = Promise.resolve();

function mountScripts(container, html, { onFail, onDone } = {}) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const scripts = [...tmp.querySelectorAll('script')];
  scripts.forEach((n) => n.remove());
  container.innerHTML = tmp.innerHTML;
  if (scripts.length === 0) {
    if (onDone) onDone();
    return;
  }
  let remaining = scripts.length;
  let done = false;
  const timer = setTimeout(() => finish(false), 3000);
  function finish(ok) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (!ok && onFail) onFail();
    if (onDone) onDone();
  }
  scripts.forEach((old) => {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    if (!s.hasAttribute('data-cfasync')) s.setAttribute('data-cfasync', 'false');
    s.textContent = old.textContent || '';
    if (!s.getAttribute('src')) {
      // Inline: dieksekusi sinkron saat append.
      container.appendChild(s);
      remaining -= 1;
      if (remaining <= 0) finish(true);
      return;
    }
    s.onload = () => {
      remaining -= 1;
      if (remaining <= 0) finish(true);
    };
    s.onerror = () => finish(false);
    container.appendChild(s);
  });
}

// Pasang HTML unit ke container. Banner lewat antrean; lainnya langsung.
// Kembalikan fungsi cancel.
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
    return () => {
      cancelled = true;
    };
  }
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

// Isolasi banner di iframe srcDoc sendiri (opsional via settings.isolateBanners)
// agar atOptions global & id container tidak bertabrakan antar unit.
export function isolateHtml(meta) {
  if (!meta || meta.type !== 'banner' || !meta.width || !meta.height) return null;
  return { width: meta.width, height: meta.height, srcDoc: meta.html };
}
