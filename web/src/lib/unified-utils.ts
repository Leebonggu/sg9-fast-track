import * as XLSX from 'xlsx';
import type { UnifiedRow, FilterType } from './unified-types';

export function downloadAsXlsx(rows: UnifiedRow[], surveyIds: string[], filename: string) {
  const headers = ['동', '호수', '소유자명', '우편번호', '대표주소', '실거주여부', '신속통합동의서_제출', ...surveyIds, '메모'];
  const dataRows = rows.map((r) => [
    r.dong,
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
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '통합현황');
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
