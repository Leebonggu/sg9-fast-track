import type { UnifiedRow, FilterType } from './unified-types';

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
  const matchedSurveyId = surveyIds.find((id) => filter === `no-${id}`);
  if (matchedSurveyId) return rows.filter((r) => !r.surveys[matchedSurveyId]);
  return rows;
}
