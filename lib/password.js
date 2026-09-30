import { createHash, timingSafeEqual } from 'crypto';

// Login pakai kunci acak 256-bit; yang disimpan hanya sha256-nya (verifier).
// DB bocor pun kunci asli tidak ketahuan.

export function hashKey(key) {
  return createHash('sha256').update(String(key || '')).digest('hex');
}

export function verifyKey(provided, verifier) {
  try {
    const a = Buffer.from(hashKey(provided), 'hex');
    const b = Buffer.from(String(verifier || ''), 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
