import { NextResponse } from 'next/server';
import { syncMasterSheet } from '@/lib/unified-sync';

export async function POST() {
  const result = await syncMasterSheet();
  return NextResponse.json({ success: true, result });
}
