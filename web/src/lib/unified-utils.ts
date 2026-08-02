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

// 행 배열 → 워크시트. includeDong=false면 '동' 컬럼 제외(동별 시트에서는 시트명이 동 역할).
function buildSheet(rows: UnifiedRow[], surveyIds: string[], includeDong: boolean) {
  const headers = [
    ...(includeDong ? ['동'] : []),
    '호수', '소유자명', '우편번호', '대표주소', '실거주여부', '신속통합동의서_제출', ...surveyIds, '메모',
  ];
  const dataRows = rows.map((r) => [
    ...(includeDong ? [sanitizeCell(r.dong)] : []),
    sanitizeCell(r.ho),
    sanitizeCell(r.ownerName),
    sanitizeCell(r.postalCode),
    sanitizeCell(r.address),
    sanitizeCell(r.residency),
    r.consent ? 'O' : 'X',
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
  // 전체 세대 중 후원금 미납부 (사전동의 여부와 무관 — 후원금은 전체 세대 대상)
  if (filter === 'no-donation')
    return rows.filter((r) => (r.donationTotal ?? 0) === 0);
  // 전체 세대 중 후원금 납부 완료
  if (filter === 'donation')
    return rows.filter((r) => (r.donationTotal ?? 0) > 0);
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
