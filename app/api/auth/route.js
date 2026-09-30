import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export async function GET() {
  const db = readDB();
  return NextResponse.json(db);
}

export async function POST(req) {
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  const { password } = await req.json().catch(() => ({}));
  if (password === pass) return NextResponse.json({ ok: true, token: pass });
  return NextResponse.json({ ok: false }, { status: 401 });
}
