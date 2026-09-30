// Rate limit sederhana per IP (in-memory, per instance).
// Cukup menahan brute-force & spam tulis; DDoS jaringan tetap urusan Vercel/CDN.

const buckets = new Map();

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  // Bersihkan bucket basi sesekali agar memori tidak bocor.
  if (buckets.size > 5000 && Math.random() < 0.02) {
    for (const [k, v] of buckets) {
      if (now - v.start > windowMs) buckets.delete(k);
    }
  }
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}

export function clientIp(req) {
  // Pakai entri PALING KANAN (ditambahkan proxy/infra terdekat, tidak bisa dipalsukan
  // penyerang seperti entri kiri). Lokal/dev: satu nilai, sama saja.
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') || 'unknown';
}
