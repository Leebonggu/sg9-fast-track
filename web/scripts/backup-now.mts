/**
 * 통합현황 스프레드시트 즉시 백업 (sync 같은 덮어쓰기 작업 직전에 수동 실행)
 *
 * 실행: npm run backup-now
 *      (= npx tsx --env-file=.env.local scripts/backup-now.mts)
 *
 * 매일 도는 Vercel cron 백업과 같은 경로(Apps Script backupCopy)를 쓴다.
 */
import { backupOwnerSpreadsheet } from '../src/lib/backup';

const r = await backupOwnerSpreadsheet();
console.log(`백업 완료: ${r.name} (fileId=${r.fileId})`);
