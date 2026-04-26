import { NextResponse } from 'next/server';
import { syncMasterSheet } from '@/lib/unified-sync';

export async function POST() {
  try {
    const result = await syncMasterSheet();
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[sync] 오류:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
