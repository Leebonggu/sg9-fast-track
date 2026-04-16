import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import type { SurveyConfig, SurveyResponse, SurveyStats } from './surveys/types';

const docCacheMap = new Map<string, GoogleSpreadsheet>();

async function getSurveyDoc(config: SurveyConfig): Promise<GoogleSpreadsheet> {
  const cached = docCacheMap.get(config.id);
  if (cached) return cached;

  const spreadsheetId = process.env[config.envKeys.spreadsheetId];
  if (!spreadsheetId) {
    throw new Error(`환경변수 ${config.envKeys.spreadsheetId}가 설정되지 않았습니다.`);
  }

  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  await doc.loadInfo();
  docCacheMap.set(config.id, doc);
  return doc;
}

function getResponseSheet(doc: GoogleSpreadsheet) {
  return doc.sheetsByIndex[0];
}

export async function getSurveyStats(config: SurveyConfig): Promise<SurveyStats> {
  const doc = await getSurveyDoc(config);
  const sheet = getResponseSheet(doc);
  const rows = await sheet.getRows();

  let generated = 0;
  for (const row of rows) {
    if (String(row.get('PDF생성여부') || '') === 'TRUE') {
      generated++;
    }
  }

  return {
    total: rows.length,
    generated,
    pending: rows.length - generated,
  };
}

export async function getSurveyResponses(config: SurveyConfig): Promise<SurveyResponse[]> {
  const doc = await getSurveyDoc(config);
  const sheet = getResponseSheet(doc);
  const rows = await sheet.getRows();

  return rows.map((row, index) => {
    const basicInfo: Record<string, string> = {};
    for (const field of config.basicInfoFields) {
      basicInfo[field.key] = String(row.get(field.sheetColumn) || '');
    }

    const answers: Record<string, string> = {};
    for (const q of config.questions) {
      answers[q.id] = String(row.get(q.label) || '');
    }

    return {
      rowIndex: index,
      timestamp: String(row.get('타임스탬프') || ''),
      basicInfo,
      answers,
      pdfGenerated: String(row.get('PDF생성여부') || '') === 'TRUE',
      pdfLink: String(row.get('PDF링크') || ''),
    };
  });
}

export async function getResponseByIndex(
  config: SurveyConfig,
  rowIndex: number,
): Promise<SurveyResponse | null> {
  const responses = await getSurveyResponses(config);
  return responses[rowIndex] || null;
}

export async function markAsGenerated(
  config: SurveyConfig,
  rowIndex: number,
  driveLink: string,
): Promise<void> {
  const doc = await getSurveyDoc(config);
  const sheet = getResponseSheet(doc);
  const rows = await sheet.getRows();
  const row = rows[rowIndex];
  if (!row) throw new Error('해당 행 없음: ' + rowIndex);

  row.set('PDF생성여부', 'TRUE');
  row.set('PDF링크', driveLink);
  await row.save();
}

/**
 * 웹 폼에서 설문 응답을 시트에 직접 추가
 */
export async function addSurveyResponse(
  config: SurveyConfig,
  basicInfo: Record<string, string>,
  answers: Record<string, string>,
): Promise<void> {
  const doc = await getSurveyDoc(config);
  const sheet = getResponseSheet(doc);

  const rowData: Record<string, string> = {
    타임스탬프: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  };

  for (const field of config.basicInfoFields) {
    rowData[field.sheetColumn] = basicInfo[field.key] || '';
  }

  for (const q of config.questions) {
    rowData[q.label] = answers[q.id] || '';
  }

  await sheet.addRow(rowData);
}
