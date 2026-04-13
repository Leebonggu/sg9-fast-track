import type { SurveyResponse } from './survey-sheets';

const WEBAPP_URL = process.env.SURVEY_WEBAPP_URL!;

/**
 * 응답 기반 체크된 설문지 PDF 생성 (Apps Script 웹앱 호출)
 */
export async function generateSurveyPdf(response: SurveyResponse): Promise<string> {
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'single',
      dong: response.dong,
      ho: response.ho,
      name: response.name,
      phone: response.phone,
      answers: response.answers,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.link;
}

/**
 * 빈 설문지 PDF 생성 (Apps Script 웹앱 호출)
 */
export async function generateBlankSurveyPdf(): Promise<string> {
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'blank' }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.link;
}
