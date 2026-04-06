import { NextRequest, NextResponse } from 'next/server';
import { toggleCollected } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const { building, unit } = await req.json();
    const collected = await toggleCollected(building, unit);
    return NextResponse.json({ success: true, collected });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
