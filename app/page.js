import { redirect } from 'next/navigation';
import { readDB } from '@/lib/db';

export default function Home() {
  const db = readDB();
  const first = db.folders?.[0];
  if (first) redirect(`/f/${first.id}`);
  redirect('/admin');
}
