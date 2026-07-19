// web/src/lib/unified-sync.ts
import { getOwners, getMemoMap, getOppositionMap, getKakaoGroupMap, getPlanTrackingMaps, getAgeMap, writeMasterRows } from './owner-sheets';
import { getConsentKeyset, getPhoneMap } from './sheets';

function normalizeNameSet(raw: string): Set<string> {
  return new Set(raw.split(/[,ㆍ·/、]\s*/).map((s) => s.trim()).filter(Boolean));
}

function checkNameMismatch(ownerName: string, consentName: string): boolean {
  if (!consentName) return false;
  const ownerSet = normalizeNameSet(ownerName);
  const consentSet = normalizeNameSet(consentName);
  for (const n of consentSet) if (ownerSet.has(n)) return false;
  return true;
}
import { getSurveyKeyset, getMergedSurveyAgeMap } from './survey-sheets';
import { getAllSurveyConfigs } from './surveys/registry';
import { notifiers } from './notifier';
import type { UnifiedRow, SyncResult } from './unified-types';

export async function syncMasterSheet(): Promise<SyncResult> {
  const startedAt = Date.now();
  const syncedAt = new Date().toISOString();

  // 1. 소스 시트들 병렬 읽기 — 메모는 sync 시 보존, 4필드는 원본에 직접 갱신되므로 보존 불필요
  const surveyConfigs = getAllSurveyConfigs();
  const [owners, memoMap, oppositionMap, kakaoGroupMap, planMaps, ageMap, surveyAgeMap, consentResult, phoneMap, ...surveyKeysets] =
    await Promise.all([
      getOwners(),
      getMemoMap(),
      getOppositionMap(),
      getKakaoGroupMap(),
      getPlanTrackingMaps(),
      getAgeMap(),
      getMergedSurveyAgeMap(surveyConfigs),
      getConsentKeyset(),
      getPhoneMap(),
      ...surveyConfigs.map((c) => getSurveyKeyset(c)),
    ]);
  const consentKeys = consentResult.keys;
  const consentNameMap = consentResult.nameMap;
  const duplicates = consentResult.duplicates;

  // displayId가 있으면 마스터 시트 컬럼명으로 사용, 없으면 id 사용
  const surveyDisplayIds = surveyConfigs.map((c) => c.displayId || c.id);

  // 2. Join
  const rows: UnifiedRow[] = owners.map((owner) => {
    const key = `${owner.dong}-${owner.ho}`;
    const surveys: Record<string, boolean> = {};
    surveyDisplayIds.forEach((displayId, i) => {
      surveys[displayId] = surveyKeysets[i].has(key);
    });
    const consentName = consentNameMap.get(key) || '';
    const consent = consentKeys.has(key);
    return {
      ...owner,
      consent,
      surveys,
      opposition: oppositionMap.get(key) ?? false,
      kakaoGroup: kakaoGroupMap.get(key) ?? false,
      planConsent: planMaps.consent.get(key) ?? false,
      privacyConsent: planMaps.privacyConsent.get(key) ?? false,
      idReceived: planMaps.idReceived.get(key) ?? false,
      ageGroup: ageMap.get(key) || surveyAgeMap.get(key) || '',
      memo: memoMap.get(key) || '',
      phone: phoneMap.get(key) || '',
      lastSynced: syncedAt,
      consentName: consent ? consentName : '',
      nameMismatch: consent ? checkNameMismatch(owner.ownerName, consentName) : false,
    };
  });

  // 3. 마스터 시트 overwrite
  await writeMasterRows(rows, surveyDisplayIds);

  const result: SyncResult = {
    syncedAt,
    totalRows: rows.length,
    updatedRows: rows.length,
    durationMs: Date.now() - startedAt,
    duplicates,
  };

  // 4. 알림
  await Promise.all(notifiers.map((n) => n.notify(result)));

  return result;
}
