/**
 * 통합현황 마스터 시트 동기화 1회 실행 (코드 변경 후 반영용)
 *
 * 실행: npm run sync-now
 *      (= npx tsx --env-file=.env.local scripts/sync-now.mts)
 *
 * 주의: 통합현황을 clear() 후 전체 재작성한다. 실행 전 `npm run backup-now` 권장.
 */
import { syncMasterSheet } from '../src/lib/unified-sync';

const r = await syncMasterSheet();
console.log(`동기화 완료: ${r.totalRows}행 / ${r.durationMs}ms / ${r.syncedAt}`);
if (r.duplicates.length > 0) {
  console.log(`중복 세대 ${r.duplicates.length}건:`);
  for (const d of r.duplicates.slice(0, 20)) console.log(`  ${d.dong}-${d.ho} (${d.count}건)`);
}
