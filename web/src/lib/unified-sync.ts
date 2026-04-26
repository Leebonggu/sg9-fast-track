// web/src/lib/unified-sync.ts
import { getOwners, getMemoMap, writeMasterRows } from './owner-sheets';
import { getConsentKeyset } from './sheets';
import { getSurveyKeyset } from './survey-sheets';
import { getAllSurveyConfigs } from './surveys/registry';
import { notifiers } from './notifier';
import type { UnifiedRow, SyncResult } from './unified-types';

export async function syncMasterSheet(): Promise<SyncResult> {
  const startedAt = Date.now();
  const syncedAt = new Date().toISOString();

  // 1. 소스 시트들 병렬 읽기
  const surveyConfigs = getAllSurveyConfigs();
  const [owners, memoMap, consentKeys, ...surveyKeysets] =
    await Promise.all([
      getOwners(),
      getMemoMap(),
      getConsentKeyset(),
      ...surveyConfigs.map((c) => getSurveyKeyset(c)),
    ]);

  const surveyIds = surveyConfigs.map((c) => c.id);

  // 2. Join
  const rows: UnifiedRow[] = owners.map((owner) => {
    const key = `${owner.dong}-${owner.ho}`;
    const surveys: Record<string, boolean> = {};
    surveyIds.forEach((id, i) => {
      surveys[id] = surveyKeysets[i].has(key);
    });
    return {
      ...owner,
      consent: consentKeys.has(key),
      surveys,
      memo: memoMap.get(key) || '',
      lastSynced: syncedAt,
    };
  });

  // 3. 마스터 시트 overwrite
  await writeMasterRows(rows, surveyIds);

  const result: SyncResult = {
    syncedAt,
    totalRows: rows.length,
    updatedRows: rows.length,
    durationMs: Date.now() - startedAt,
  };

  // 4. 알림
  await Promise.all(notifiers.map((n) => n.notify(result)));

  return result;
}
