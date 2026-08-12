import * as XLSX from 'xlsx';
import type { UnifiedRow, FilterType } from './unified-types';
import { sanitizeCell } from './xlsx-safe';

// 연령대 선택지 (빈값 = 미지정). route·table·modal 공용.
export const AGE_GROUP_OPTIONS: readonly string[] = [
  '', '20대', '30대', '40대', '50대', '60대', '70대', '80대', '90대 이상',
];

// 시드/기존값 정규화 — survey-001 시드의 '60대 이상'은 '60대'로 매핑.
export function normalizeAgeGroup(raw: string): string {
  return raw === '60대 이상' ? '60대' : raw;
}

// ─── 종이 경로와 전자동의 합산 ──────────────────────────────────────────────
//
// 시트에는 두 경로를 끝까지 따로 저장하고, 합치는 건 여기 읽는 시점에만 한다.
// 그래서 위원이 손으로 체크한 기록이 임포트로 손상되지 않고, 아래 판단이 바뀌어도
// 이 파일만 고치면 된다.

export type ConsentSource = '' | '종이' | '전자' | '종이·전자';

// 전자동의는 '완전'만 동의로 센다. '일부'는 공유자 일부만 서명한 상태라 아직 미완결이고,
// 대표를 세우거나 나머지를 독려하면 완결되는 세대로 따로 관리한다.
function electronicDone(state: string | undefined): boolean {
  return state === '완전';
}

export function consentSource(paper: boolean, electronic: string | undefined): ConsentSource {
  const e = electronicDone(electronic);
  if (paper && e) return '종이·전자';
  if (paper) return '종이';
  if (e) return '전자';
  return '';
}

/** 신속통합 동의 — 종이(v2 수거) OR 전자동의 */
export function hasSintoConsent(r: UnifiedRow): boolean {
  return r.consent || electronicDone(r.econsentSinto);
}

/** 정비계획입안 동의 — 오프라인 수령 OR 전자동의 */
export function hasPlanConsent(r: UnifiedRow): boolean {
  return Boolean(r.planConsent) || electronicDone(r.econsentPlan);
}

/**
 * 신분증 인정 — 오프라인 수령 OR 온라인 업로드 OR 전자동의 제출.
 *
 * 전자동의 명부의 `신분증` 컬럼은 3,184행 전원 '미제출'이다. 전자동의 시스템이 그 서류를
 * 수집하지 않았다. 전자서명이 본인인증 기반이라 사본이 불필요하다는 위원회의 운영 판단이지
 * 원본 데이터에 있는 사실이 아니다. 판단이 바뀌면 이 함수만 고치면 된다.
 */
export function hasIdVerified(r: UnifiedRow): boolean {
  return (
    Boolean(r.idReceived) ||
    (r.idUploaded ?? 0) > 0 ||
    electronicDone(r.econsentSinto) ||
    electronicDone(r.econsentPlan)
  );
}

/** 개인정보 수집·제공 동의 — 오프라인 체크 OR 전자동의 제출 (근거는 hasIdVerified와 동일) */
export function hasPrivacyConsent(r: UnifiedRow): boolean {
  return (
    Boolean(r.privacyConsent) ||
    electronicDone(r.econsentSinto) ||
    electronicDone(r.econsentPlan)
  );
}

/**
 * 표시용 연령대 — 위원 입력/설문 시드가 있으면 그걸 쓰고, 없을 때만 명부 파생값으로 채운다.
 *
 * 명부(공식 등기 생년월일)가 더 정확하지만 `연령대` 칸에는 위원이 손으로 고친 값이 섞여 있고
 * 시드와 구분할 방법이 없다. 명부를 우선하면 위원 입력이 조용히 사라진다.
 * 두 값이 충돌하는 세대는 리포트로 뽑아 사람이 판단한다.
 */
export function displayAgeGroup(r: UnifiedRow): string {
  return normalizeAgeGroup(r.ageGroup || '') || r.ageGroupRoster || '';
}

/** 공유자 일부만 서명해 대표만 세우면 완결되는 세대 — 독려 1순위 */
export function isPartialConsent(r: UnifiedRow): boolean {
  return r.econsentSinto === '일부' || r.econsentPlan === '일부';
}

/** 공유 세대인데 대표가 없는 경우 */
export function needsRepresentative(r: UnifiedRow): boolean {
  return (r.coOwnerCount ?? 0) > 1 && !r.representative;
}

// 행 배열 → 워크시트. includeDong=false면 '동' 컬럼 제외(동별 시트에서는 시트명이 동 역할).
function buildSheet(rows: UnifiedRow[], surveyIds: string[], includeDong: boolean) {
  // 연령대·연락처는 오프라인 방문·전화 독려용으로 넣는다(인쇄 명단과 같은 목적).
  // 신속통합동의서_제출은 종이·전자 합산 — 종이만 보면 전자로 이미 동의한 세대를 X로 찍어
  // 방문 대상에 올리게 된다. 어느 경로였는지는 옆의 전자동의 컬럼으로 구분한다.
  const headers = [
    ...(includeDong ? ['동'] : []),
    '호수', '소유자명', '연령대', '연락처', '우편번호', '대표주소', '실거주여부',
    '신속통합동의서_제출', '신속통합_전자동의', '정비계획입안_전자동의', '공유_대표자',
    ...surveyIds, '메모',
  ];
  const dataRows = rows.map((r) => [
    ...(includeDong ? [sanitizeCell(r.dong)] : []),
    sanitizeCell(r.ho),
    sanitizeCell(r.ownerName),
    sanitizeCell(displayAgeGroup(r)),
    sanitizeCell(r.phoneOverride || r.phone || ''),
    sanitizeCell(r.postalCode),
    sanitizeCell(r.address),
    sanitizeCell(r.residency),
    hasSintoConsent(r) ? 'O' : 'X',
    sanitizeCell(r.econsentSinto ?? ''),
    sanitizeCell(r.econsentPlan ?? ''),
    sanitizeCell(r.representative ?? ''),
    ...surveyIds.map((id) => (r.surveys[id] ? 'O' : 'X')),
    sanitizeCell(r.memo),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  forceTextCells(ws);
  return ws;
}

// 모든 데이터 셀을 명시적 텍스트 타입으로 지정 → 우편번호/전화번호 등 leading-zero·서식 유지
function forceTextCells(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && cell.v != null) {
        cell.t = 's';
        cell.v = String(cell.v);
      }
    }
  }
}

// "홍길동,홍길순" → ['홍길동', '홍길순']
function splitOwners(name: string): string[] {
  return name.split(',').map((s) => s.trim()).filter(Boolean);
}

// "홍길동 010-1111 / 홍길순 010-2222" → [{name:'홍길동', num:'010-1111'}, ...]
// 이름(선행 비숫자) + 번호(첫 숫자부터)로 분리. 번호가 없으면 전체를 번호로 취급.
function parsePhones(phone: string): { name: string; num: string }[] {
  return phone
    .split('/')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^(\D*?)\s*(\d.*)$/);
      return m ? { name: m[1].trim(), num: m[2].trim() } : { name: '', num: t };
    });
}

// 업체 전달용 소유주 단위 명부 — 공동명의를 각자 1행으로 풀고, 동별 시트로 분리.
// 컬럼: 번호 | 동 | 호수 | 소유주 | 전화번호 | 주소  (번호는 동별로 1부터)
export function downloadOwnerRegistryByDongAsXlsx(rows: UnifiedRow[], filename: string) {
  if (rows.length === 0) {
    alert('다운로드할 세대가 없습니다.');
    return;
  }
  const byDong = new Map<string, UnifiedRow[]>();
  for (const r of rows) {
    const list = byDong.get(r.dong);
    if (list) list.push(r);
    else byDong.set(r.dong, [r]);
  }
  const dongs = Array.from(byDong.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const headers = ['번호', '동', '호수', '소유주', '전화번호', '주소'];
  const wb = XLSX.utils.book_new();
  for (const dong of dongs) {
    const dongRows = byDong
      .get(dong)!
      .slice()
      .sort((a, b) => a.ho.localeCompare(b.ho, undefined, { numeric: true }));
    const dataRows: string[][] = [];
    let seq = 1;
    for (const r of dongRows) {
      const owners = splitOwners(r.ownerName);
      const entries = parsePhones(r.phone ?? '');
      const allNums = entries.map((e) => e.num).join(' / ');
      const list = owners.length ? owners : [''];
      for (const owner of list) {
        // 이름 정확히 일치하면 본인 번호, 아니면 세대 대표번호(전체)
        const matched = owner ? entries.find((e) => e.name && e.name === owner) : undefined;
        const phone = matched ? matched.num : allNums;
        dataRows.push([
          String(seq++),
          sanitizeCell(r.dong),
          sanitizeCell(r.ho),
          sanitizeCell(owner),
          sanitizeCell(phone),
          sanitizeCell(r.address),
        ]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    forceTextCells(ws);
    XLSX.utils.book_append_sheet(wb, ws, `${dong}동`);
  }
  XLSX.writeFile(wb, filename);
}

export function downloadAsXlsx(rows: UnifiedRow[], surveyIds: string[], filename: string) {
  const ws = buildSheet(rows, surveyIds, true);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '통합현황');
  XLSX.writeFile(wb, filename);
}

// 동마다 별도 시트로 분리된 엑셀 1개 (901동, 902동…). 현재 필터 결과를 그대로 받는다.
export function downloadByDongAsXlsx(rows: UnifiedRow[], surveyIds: string[], filename: string) {
  if (rows.length === 0) {
    alert('다운로드할 세대가 없습니다.');
    return;
  }
  const byDong = new Map<string, UnifiedRow[]>();
  for (const r of rows) {
    const list = byDong.get(r.dong);
    if (list) list.push(r);
    else byDong.set(r.dong, [r]);
  }
  const dongs = Array.from(byDong.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const wb = XLSX.utils.book_new();
  for (const dong of dongs) {
    const ws = buildSheet(byDong.get(dong)!, surveyIds, false);
    XLSX.utils.book_append_sheet(wb, ws, `${dong}동`);
  }
  XLSX.writeFile(wb, filename);
}

// 신분증 제출 인정 기준 — 온라인 업로드 1장 이상 또는 종이(오프라인) 수령 체크.
// 요약 카드와 필터가 서로 다른 기준을 쓰면 숫자가 어긋나므로 여기서만 정의한다.
export const hasIdSubmitted = (r: UnifiedRow) =>
  (r.idUploaded ?? 0) > 0 || !!r.idReceived;

const isRental = (r: UnifiedRow) => r.residency === '임대';
const isResident = (r: UnifiedRow) => r.residency === '실거주';
const isJoint = (r: UnifiedRow) => r.ownerName.includes(',');

export function applyFilter(
  rows: UnifiedRow[],
  filter: FilterType,
  surveyIds: string[],
): UnifiedRow[] {
  if (filter === 'all') return rows;
  if (filter === 'incomplete')
    return rows.filter(
      (r) => !r.consent || surveyIds.some((id) => !r.surveys[id]),
    );
  if (filter === 'no-consent') return rows.filter((r) => !r.consent);
  if (filter === 'consent') return rows.filter((r) => r.consent);
  // 사전동의 완료 세대 중 신분증 미제출 (온라인 업로드 없고 오프라인 수동체크도 없음)
  if (filter === 'no-id')
    return rows.filter((r) => r.consent && !hasIdSubmitted(r));
  // 사전동의 완료 세대 중 신분증 제출 완료 (no-id의 여집합 → 둘의 합 = 동의세대 수)
  if (filter === 'id') return rows.filter((r) => r.consent && hasIdSubmitted(r));
  // 종이로는 받았는데 아직 업로드 안 한 세대 = 스캔 작업 큐
  if (filter === 'id-scan-pending')
    return rows.filter((r) => r.idReceived && (r.idUploaded ?? 0) === 0);
  // 전체 세대 중 후원금 미납부 (사전동의 여부와 무관 — 후원금은 전체 세대 대상)
  if (filter === 'no-donation')
    return rows.filter((r) => (r.donationTotal ?? 0) === 0);
  // 전체 세대 중 후원금 납부 완료
  if (filter === 'donation')
    return rows.filter((r) => (r.donationTotal ?? 0) > 0);
  // 공유자 일부만 전자서명 — 대표만 세우면 완결되는 세대라 독려 1순위
  if (filter === 'econsent-partial') return rows.filter(isPartialConsent);
  // 공유 세대인데 대표 미선임 — 전자동의를 시작조차 못 하는 상태
  if (filter === 'no-representative') return rows.filter(needsRepresentative);
  // 종이·전자 통틀어 신속통합 동의가 없는 세대
  if (filter === 'no-sinto-any') return rows.filter((r) => !hasSintoConsent(r));
  // 종이·전자 통틀어 정비계획입안 동의가 없는 세대
  if (filter === 'no-plan-any') return rows.filter((r) => !hasPlanConsent(r));
  // 소유권 이전 의심 — 원본 소유자명과 전자동의 명부 이름이 실질 불일치. 원본은 자동으로 안 고친다.
  if (filter === 'roster-name-mismatch') return rows.filter((r) => r.rosterNameMismatch);
  if (filter === 'plan-promotion') return rows.filter((r) => r.planChoice === '추진위원회 구성');
  if (filter === 'plan-direct') return rows.filter((r) => r.planChoice === '직접조합설립');
  if (filter === 'opposition') return rows.filter((r) => r.opposition);
  if (filter === 'kakao-group') return rows.filter((r) => r.kakaoGroup);
  if (filter === 'no-kakao-group') return rows.filter((r) => !r.kakaoGroup);

  // 정비계획입안 2종 — 전 세대 대상 오프라인 수령 체크 (사전동의 여부와 무관)
  if (filter === 'no-plan-consent') return rows.filter((r) => !r.planConsent);
  if (filter === 'plan-consent') return rows.filter((r) => r.planConsent);
  if (filter === 'no-privacy') return rows.filter((r) => !r.privacyConsent);
  if (filter === 'privacy') return rows.filter((r) => r.privacyConsent);

  if (filter === 'joint') return rows.filter(isJoint);
  if (filter === 'joint-incomplete')
    return rows.filter((r) => isJoint(r) && (!r.consent || surveyIds.some((id) => !r.surveys[id])));
  if (filter === 'joint-no-consent')
    return rows.filter((r) => isJoint(r) && !r.consent);

  if (filter === 'rental') return rows.filter(isRental);
  if (filter === 'rental-incomplete')
    return rows.filter((r) => isRental(r) && (!r.consent || surveyIds.some((id) => !r.surveys[id])));
  if (filter === 'rental-no-consent')
    return rows.filter((r) => isRental(r) && !r.consent);

  if (filter === 'resident') return rows.filter(isResident);
  if (filter === 'resident-incomplete')
    return rows.filter((r) => isResident(r) && (!r.consent || surveyIds.some((id) => !r.surveys[id])));
  if (filter === 'resident-no-consent')
    return rows.filter((r) => isResident(r) && !r.consent);

  const matchedSurveyId = surveyIds.find((id) => filter === `no-${id}`);
  if (matchedSurveyId) return rows.filter((r) => !r.surveys[matchedSurveyId]);

  const rentalSurveyId = surveyIds.find((id) => filter === `rental-no-${id}`);
  if (rentalSurveyId)
    return rows.filter((r) => isRental(r) && !r.surveys[rentalSurveyId]);

  const residentSurveyId = surveyIds.find((id) => filter === `resident-no-${id}`);
  if (residentSurveyId)
    return rows.filter((r) => isResident(r) && !r.surveys[residentSurveyId]);

  return rows;
}
