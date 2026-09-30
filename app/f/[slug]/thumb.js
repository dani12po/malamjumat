'use client';
import { useState } from 'react';

// Thumbnail 3 lapis agar selalu terlihat:
// 1) URL asli tanpa referrer (lolos hotlink-block), 2) via proxy /api/img,
// 3) blank.svg. Plus background agar tak ada flash kosong saat loading.
export default function VideoThumb({ src, alt, className }) {
  const [stage, setStage] = useState(0);
  const s = stage === 0
    ? src
    : stage === 1
      ? `/api/img?u=${encodeURIComponent(src || '')}`
      : '/blank.svg';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setStage((x) => (x < 2 ? x + 1 : x))}
    />
  );
}
