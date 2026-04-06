import { NextRequest, NextResponse } from 'next/server';
import { getBuildingData } from '@/lib/sheets';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const building = decodeURIComponent(name);
    const data = await getBuildingData(building);
    if (!data) {
      return NextResponse.json({ error: '동 정보 없음' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
