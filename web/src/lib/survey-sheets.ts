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

function getUnifiedSheet(doc: GoogleSpreadsheet) {
  const sheet = doc.sheetsByTitle['통합응답'];
  if (!sheet) {
    throw new Error(
      '통합응답 시트가 없습니다. Apps Script에서 setupUnifiedSheet()를 실행해 주세요.',
    );
  }
  return sheet;
}

export async function getSurveyStats(config: SurveyConfig): Promise<SurveyStats> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();

  let generated = 0;
  for (const row of rows) {
    const pdfStatus = String(row.get('PDF생성여부') || '');
    if (pdfStatus === 'TRUE' || pdfStatus === '해당없음') {
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
  const sheet = getUnifiedSheet(doc);
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

    const pdfStatus = String(row.get('PDF생성여부') || '');
    return {
      rowIndex: index,
      timestamp: String(row.get('타임스탬프') || ''),
      basicInfo,
      answers,
      entryPath: String(row.get('입력경로') || ''),
      operatorName: String(row.get('입력자') || ''),
      pdfGenerated: pdfStatus === 'TRUE' || pdfStatus === '해당없음',
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
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  const row = rows[rowIndex];
  if (!row) throw new Error('해당 행 없음: ' + rowIndex);

  row.set('PDF생성여부', 'TRUE');
  row.set('PDF링크', driveLink);
  await row.save();
}

export async function deleteSurveyResponse(
  config: SurveyConfig,
  rowIndex: number,
): Promise<void> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  const row = rows[rowIndex];
  if (!row) throw new Error('해당 행 없음: ' + rowIndex);
  await row.delete();
}

export async function checkDuplicateResponse(
  config: SurveyConfig,
  dong: string,
  ho: string,
): Promise<boolean> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  return rows.some(
    (row) =>
      String(row.get('동') || '') === dong &&
      String(row.get('호') || '') === ho,
  );
}

/**
 * 웹 폼에서 설문 응답을 시트에 직접 추가
 */
export async function addSurveyResponse(
  config: SurveyConfig,
  basicInfo: Record<string, string>,
  answers: Record<string, string>,
  entryPath: string = '온라인(웹)',
  operatorName: string = '',
  isManual: boolean = false,
): Promise<void> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);

  const rowData: Record<string, string> = {
    타임스탬프: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  };

  for (const field of config.basicInfoFields) {
    rowData[field.sheetColumn] = basicInfo[field.key] || '';
  }

  for (const q of config.questions) {
    rowData[q.label] = answers[q.id] || '';
  }

  rowData['입력경로'] = entryPath;
  rowData['입력자'] = operatorName;
  rowData['PDF생성여부'] = isManual ? '해당없음' : 'FALSE';
  rowData['PDF링크'] = '';

  await sheet.addRow(rowData);
}

// 특정 설문 완료 세대 키셋 반환: Set<"901-101">
// 통합응답 시트: 동 컬럼 "동" (값: "901동"), 호 컬럼 "호"
export async function getSurveyKeyset(config: SurveyConfig): Promise<Set<string>> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  const result = new Set<string>();
  for (const row of rows) {
    const dongRaw = String(row.get('동') || '').trim();
    const dongNum = dongRaw.replace('동', ''); // "901동" → "901", "901" → "901"
    const ho = String(row.get('호') || '').trim();
    if (dongNum && ho) result.add(`${dongNum}-${ho}`);
  }
  return result;
}
