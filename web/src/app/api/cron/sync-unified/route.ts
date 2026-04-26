import { NextRequest, NextResponse } from 'next/server';
import { syncMasterSheet } from '@/lib/unified-sync';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await syncMasterSheet();
  console.log(`[cron] 통합현황 동기화 완료: ${result.updatedRows}건`, result);
  return NextResponse.json({ success: true, result });
}
