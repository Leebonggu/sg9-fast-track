// web/src/lib/unified-sync.ts
import { getOwners, getMasterPreservation, writeMasterRows } from './owner-sheets';
import { getConsentKeyset, getPhoneMap } from './sheets';
import { getSurveyKeyset, getMergedSurveyAgeMap, getMergedSurveyPhoneMap } from './survey-sheets';
import { withSurveyPhoneNote } from './survey-phone-note';
import { getAllSurveyConfigs } from './surveys/registry';
import { notifiers } from './notifier';
import type { UnifiedRow, SyncResult } from './unified-types';

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

// 설문 응답자가 소유자 명단에 있는지 — checkNameMismatch와 같은 이름 분리 규칙.
// 설문 응답자는 배우자·가족·세입자일 수 있어, 이름이 일치할 때만 소유주 연락처로 인정한다.
export function isOwnerName(ownerName: string, candidate: string): boolean {
  if (!candidate.trim()) return false;
  const ownerSet = normalizeNameSet(ownerName);
  for (const n of normalizeNameSet(candidate)) if (ownerSet.has(n)) return true;
  return false;
}

export async function syncMasterSheet(): Promise<SyncResult> {
  const startedAt = Date.now();
  const syncedAt = new Date().toISOString();

  // 1. 소스 시트들 병렬 읽기 — 메모는 sync 시 보존, 4필드는 원본에 직접 갱신되므로 보존 불필요
  const surveyConfigs = getAllSurveyConfigs();
  const [owners, preserved, surveyAgeMap, surveyPhoneMap, consentResult, phoneMap, ...surveyKeysets] =
    await Promise.all([
      getOwners(),
      getMasterPreservation(),
      getMergedSurveyAgeMap(surveyConfigs),
      getMergedSurveyPhoneMap(surveyConfigs),
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
    const po = preserved.phoneOverride.get(key) || '';
    const surveyContacts = surveyPhoneMap.get(key) ?? [];
    // 연락처 우선순위: 위원 수정 > v2 동의서 > 설문 응답(소유자 본인 이름일 때만).
    // 설문만 내고 동의서는 안 낸 세대는 v2에 행이 없어 여기서만 연락처가 생긴다.
    const surveyPhone = surveyContacts
      .filter((c) => isOwnerName(owner.ownerName, c.name))
      .map((c) => `${c.name} ${c.phone}`)
      .join(' / ');
    const phone = po || phoneMap.get(key) || surveyPhone || '';
    // 연락처가 끝내 빈 세대에 한해, 소유자명과 다른 설문 응답자 번호를 메모로 남긴다.
    const unmatched = phone
      ? []
      : surveyContacts.filter((c) => !isOwnerName(owner.ownerName, c.name));
    return {
      ...owner,
      consent,
      surveys,
      opposition: preserved.opposition.get(key) ?? false,
      kakaoGroup: preserved.kakaoGroup.get(key) ?? false,
      planConsent: preserved.planConsent.get(key) ?? false,
      privacyConsent: preserved.privacyConsent.get(key) ?? false,
      idReceived: preserved.idReceived.get(key) ?? false,
      ageGroup: preserved.age.get(key) || surveyAgeMap.get(key) || '',
      memo: withSurveyPhoneNote(preserved.memo.get(key) || '', unmatched),
      phone,
      phoneOverride: po,
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
