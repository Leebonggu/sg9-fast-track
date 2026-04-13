import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import { SURVEY_CONFIG } from './survey-config';

export type SurveyResponse = {
  rowIndex: number;
  timestamp: string;
  dong: string;
  ho: string;
  name: string;
  phone: string;
  answers: Record<string, string>; // Q2~Q8 id → 선택값
  pdfGenerated: boolean;
  pdfLink: string;
};

export type SurveyStats = {
  total: number;
  generated: number;
  pending: number;
};

let surveyDocCache: GoogleSpreadsheet | null = null;

async function getSurveyDoc(): Promise<GoogleSpreadsheet> {
  if (surveyDocCache) return surveyDocCache;

  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.SURVEY_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  surveyDocCache = doc;
  return doc;
}

function getResponseSheet(doc: GoogleSpreadsheet) {
  // 폼 연결 시 자동 생성되는 첫 번째 시트 사용
  return doc.sheetsByIndex[0];
}

export async function getSurveyStats(): Promise<SurveyStats> {
  const doc = await getSurveyDoc();
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

export async function getSurveyResponses(): Promise<SurveyResponse[]> {
  const doc = await getSurveyDoc();
  const sheet = getResponseSheet(doc);
  const rows = await sheet.getRows();

  return rows.map((row, index) => {
    const answers: Record<string, string> = {};
    for (const q of SURVEY_CONFIG.questions) {
      answers[q.id] = String(row.get(q.label) || '');
    }

    return {
      rowIndex: index,
      timestamp: String(row.get('타임스탬프') || ''),
      dong: String(row.get('동') || ''),
      ho: String(row.get('호') || ''),
      name: String(row.get('성명') || ''),
      phone: String(row.get('연락처') || ''),
      answers,
      pdfGenerated: String(row.get('PDF생성여부') || '') === 'TRUE',
      pdfLink: String(row.get('PDF링크') || ''),
    };
  });
}

export async function getResponseByIndex(rowIndex: number): Promise<SurveyResponse | null> {
  const responses = await getSurveyResponses();
  return responses[rowIndex] || null;
}

export async function markAsGenerated(rowIndex: number, driveLink: string): Promise<void> {
  const doc = await getSurveyDoc();
  const sheet = getResponseSheet(doc);
  const rows = await sheet.getRows();
  const row = rows[rowIndex];
  if (!row) throw new Error('해당 행 없음: ' + rowIndex);

  row.set('PDF생성여부', 'TRUE');
  row.set('PDF링크', driveLink);
  await row.save();
}

export async function markDuplicate(rowIndex: number): Promise<void> {
  const doc = await getSurveyDoc();
  const sheet = getResponseSheet(doc);
  const rows = await sheet.getRows();
  const row = rows[rowIndex];
  if (!row) return;

  // 같은 동/호의 이전 응답 찾기
  const dong = String(row.get('동') || '');
  const ho = String(row.get('호') || '');

  let count = 0;
  for (let i = 0; i <= rowIndex; i++) {
    if (String(rows[i].get('동') || '') === dong && String(rows[i].get('호') || '') === ho) {
      count++;
    }
  }

  // 2건 이상이면 중복 표시 (시트에 별도 컬럼 없이 PDF링크 옆에 참고 표시)
  if (count > 1) {
    // 중복이어도 PDF는 전부 생성 (플랜대로)
    // 로깅용으로만 활용
  }
}
