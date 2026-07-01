import { NextRequest, NextResponse } from 'next/server';
import { backupOwnerSpreadsheet, cleanupOldBackups } from '@/lib/backup';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backup = await backupOwnerSpreadsheet();
  const cleanup = await cleanupOldBackups(30).catch((e) => {
    console.error('[cron] 백업 정리 실패(백업 자체는 성공):', e);
    return { deletedCount: 0 };
  });

  console.log(`[cron] 통합현황 백업 완료: ${backup.name}, 정리: ${cleanup.deletedCount}건 삭제`);
  return NextResponse.json({ success: true, backup, cleanup });
}
