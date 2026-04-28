import type { UnifiedRow, FilterType } from './unified-types';

export function downloadAsCsv(rows: UnifiedRow[], surveyIds: string[], filename: string) {
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
  const csv = [headers, ...dataRows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const isRental = (r: UnifiedRow) => r.residency === '임대';

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
  if (filter === 'rental-no-consent')
    return rows.filter((r) => isRental(r) && !r.consent);

  const matchedSurveyId = surveyIds.find((id) => filter === `no-${id}`);
  if (matchedSurveyId) return rows.filter((r) => !r.surveys[matchedSurveyId]);

  const rentalSurveyId = surveyIds.find((id) => filter === `rental-no-${id}`);
  if (rentalSurveyId)
    return rows.filter((r) => isRental(r) && !r.surveys[rentalSurveyId]);

  return rows;
}
