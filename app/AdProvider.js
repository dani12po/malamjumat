'use client';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { configurePool } from '@/lib/ad-pool';

// Menghubungkan daftar unit server ke pool client.
// Konfigurasi jalan saat render (sebelum effect slot anak) agar pool siap
// dipakai acquire pertama; idempotent sehingga aman double-render.
export default function AdProvider({ units, flags, children }) {
  const pathname = usePathname();
  const sig = useMemo(() => {
    try {
      return `${pathname}::${(units || []).length}::${JSON.stringify(flags || {})}`;
    } catch {
      return `${pathname}::${(units || []).length}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useMemo(() => {
    configurePool(units, flags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return <>{children}</>;
}
