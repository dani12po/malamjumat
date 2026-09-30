import { redirect } from 'next/navigation';
import { readDB } from '@/lib/db';

export default async function Home() {
  const db = await readDB();
  const first = db.folders?.[0];
  if (first) redirect(`/f/${first.id}`);
  redirect('/admin');
}
