import * as XLSX from 'xlsx';
import type { UnifiedRow, FilterType } from './unified-types';

// 행 배열 → 워크시트. includeDong=false면 '동' 컬럼 제외(동별 시트에서는 시트명이 동 역할).
function buildSheet(rows: UnifiedRow[], surveyIds: string[], includeDong: boolean) {
  const headers = [
    ...(includeDong ? ['동'] : []),
    '호수', '소유자명', '우편번호', '대표주소', '실거주여부', '신속통합동의서_제출', ...surveyIds, '메모',
  ];
  const dataRows = rows.map((r) => [
    ...(includeDong ? [r.dong] : []),
    r.ho,
    r.ownerName,
    r.postalCode,
    r.address,
    r.residency,
    r.consent ? 'O' : 'X',
    ...surveyIds.map((id) => (r.surveys[id] ? 'O' : 'X')),
    r.memo,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  // 모든 데이터 셀을 명시적 텍스트 타입으로 지정 → 우편번호 등 leading-zero 유지
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
  return ws;
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

const isRental = (r: UnifiedRow) => r.residency === '임대';
const isResident = (r: UnifiedRow) => r.residency === '실거주';

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
  // 사전동의 완료 세대 중 신분증 미제출
  if (filter === 'no-id')
    return rows.filter((r) => r.consent && (r.idUploaded ?? 0) === 0);

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
