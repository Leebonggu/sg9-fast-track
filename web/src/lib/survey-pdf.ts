import type { SurveyConfig, SurveyResponse } from './surveys/types';

function getWebappUrl(): string {
  const url = process.env.SURVEY_WEBAPP_URL;
  if (!url) throw new Error('환경변수 SURVEY_WEBAPP_URL이 설정되지 않았습니다.');
  return url;
}

/**
 * 응답 기반 체크된 설문지 PDF 생성 (범용 Apps Script 웹앱 호출)
 */
export async function generateSurveyPdf(
  config: SurveyConfig,
  response: SurveyResponse,
): Promise<string> {
  const templateDocId = process.env[config.envKeys.templateDocId];
  const pdfFolderId = process.env[config.envKeys.pdfFolderId];
  if (!templateDocId) throw new Error(`환경변수 ${config.envKeys.templateDocId}가 설정되지 않았습니다.`);
  if (!pdfFolderId) throw new Error(`환경변수 ${config.envKeys.pdfFolderId}가 설정되지 않았습니다.`);

  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'single',
      templateDocId,
      pdfFolderId,
      basicInfoFields: config.basicInfoFields,
      basicInfo: response.basicInfo,
      questions: config.questions,
      answers: response.answers,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.link;
}

/**
 * 빈 설문지 PDF 생성 (범용 Apps Script 웹앱 호출)
 */
export async function generateBlankSurveyPdf(config: SurveyConfig): Promise<string> {
  const templateDocId = process.env[config.envKeys.templateDocId];
  const pdfFolderId = process.env[config.envKeys.pdfFolderId];
  if (!templateDocId) throw new Error(`환경변수 ${config.envKeys.templateDocId}가 설정되지 않았습니다.`);
  if (!pdfFolderId) throw new Error(`환경변수 ${config.envKeys.pdfFolderId}가 설정되지 않았습니다.`);

  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'blank',
      templateDocId,
      pdfFolderId,
      basicInfoFields: config.basicInfoFields,
      questions: config.questions,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.link;
}
