import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
