import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import type { SurveyConfig, SurveyResponse, SurveyStats } from './surveys/types';
import { normalizeAgeGroup } from './unified-utils';
import { normalizePhone } from './phone-format';

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

export async function updateSurveyResponse(
  config: SurveyConfig,
  rowIndex: number,
  basicInfo: Record<string, string>,
  answers: Record<string, string>,
  editorName: string,
): Promise<void> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);

  await sheet.loadHeaderRow();
  if (!sheet.headerValues.includes('비고')) {
    await sheet.setHeaderRow([...sheet.headerValues, '비고']);
  }

  const rows = await sheet.getRows();
  const row = rows[rowIndex];
  if (!row) throw new Error('해당 행 없음: ' + rowIndex);

  const diffs: string[] = [];

  for (const field of config.basicInfoFields) {
    const oldVal = String(row.get(field.sheetColumn) || '');
    const newVal = basicInfo[field.key] ?? oldVal;
    if (newVal !== oldVal) {
      diffs.push(`${field.label}: ${oldVal}→${newVal}`);
      row.set(field.sheetColumn, newVal);
    }
  }

  for (const q of config.questions) {
    const oldVal = String(row.get(q.label) || '');
    const newVal = answers[q.id] ?? oldVal;
    if (newVal !== oldVal) {
      diffs.push(`${q.id}: ${oldVal}→${newVal}`);
      row.set(q.label, newVal);
    }
  }

  if (diffs.length === 0) return;

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10);
  const newEntry = `[${dateStr} ${editorName}] ${diffs.join(', ')}`;
  const existing = String(row.get('비고') || '');
  row.set('비고', existing ? `${existing} | ${newEntry}` : newEntry);

  await row.save();
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

export interface SurveyContact {
  name: string;
  phone: string;
}

// 설문 응답에서 동-호별 (응답자명, 연락처) 목록 반환: Map<"901-101", [{name, phone}]>
// v2 동별 시트(신속통합동의서)를 안 낸 세대는 연락처가 아예 없으므로 이 맵이 유일한 소스가 된다.
// 연락처는 시트가 숫자로 저장해 선행 0이 날아가 있어 normalizePhone으로 복원한다.
// getSurveyKeyset과 동일 키 규칙("901동" → "901"). 뒤(최신) 응답부터 수집하고 같은 번호는 중복 제거.
export async function getSurveyPhoneMap(
  config: SurveyConfig,
): Promise<Map<string, SurveyContact[]>> {
  const nameCol = config.basicInfoFields.find((f) => f.key === 'name')?.sheetColumn;
  const phoneCol = config.basicInfoFields.find((f) => f.key === 'phone')?.sheetColumn;
  if (!nameCol || !phoneCol) return new Map();

  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  const map = new Map<string, SurveyContact[]>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const dongNum = String(row.get('동') || '').trim().replace('동', '');
    const ho = String(row.get('호') || '').trim();
    const phone = normalizePhone(String(row.get(phoneCol) || '').trim());
    const name = String(row.get(nameCol) || '').trim();
    if (!dongNum || !ho || !phone) continue;
    const key = `${dongNum}-${ho}`;
    const list = map.get(key);
    if (!list) map.set(key, [{ name, phone }]);
    else if (!list.some((x) => x.phone === phone)) list.push({ name, phone });
  }
  return map;
}

// 여러 설문의 연락처 맵 병합 — 먼저 등록된 설문이 앞에 오고, 같은 번호는 중복 제거.
export async function getMergedSurveyPhoneMap(
  configs: SurveyConfig[],
): Promise<Map<string, SurveyContact[]>> {
  const maps = await Promise.all(configs.map((c) => getSurveyPhoneMap(c)));
  const merged = new Map<string, SurveyContact[]>();
  for (const map of maps) {
    for (const [key, contacts] of map) {
      const list = merged.get(key);
      if (!list) merged.set(key, [...contacts]);
      else for (const c of contacts) if (!list.some((x) => x.phone === c.phone)) list.push(c);
    }
  }
  return merged;
}

// 연령대 순위 — 다중응답 세대는 최고 연령대를 대표값으로 채택
const AGE_RANK: Record<string, number> = {
  '20대': 2, '30대': 3, '40대': 4, '50대': 5,
  '60대': 6, '60대 이상': 6, '70대': 7, '80대': 8, '90대 이상': 9,
};

// 설문 응답에서 동-호별 연령대 맵 반환: Map<"901-101", "60대">
// 같은 세대에 여러 응답이면 rank 최고값 선택. getSurveyKeyset과 동일 키 규칙("901동" → "901").
// 시드 '60대 이상'은 normalizeAgeGroup으로 '60대'에 매핑.
export async function getSurveyAgeMap(config: SurveyConfig): Promise<Map<string, string>> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  const map = new Map<string, string>();
  for (const row of rows) {
    const dongRaw = String(row.get('동') || '').trim();
    const dongNum = dongRaw.replace('동', '');
    const ho = String(row.get('호') || '').trim();
    const age = normalizeAgeGroup(String(row.get('연령대') || '').trim());
    if (!dongNum || !ho || !age) continue;
    const key = `${dongNum}-${ho}`;
    const existing = map.get(key);
    if (!existing || (AGE_RANK[age] ?? 0) > (AGE_RANK[existing] ?? 0)) {
      map.set(key, age);
    }
  }
  return map;
}

// 연령대 필드를 가진 설문 config들의 연령대 맵을 rank 최고 기준으로 병합
export async function getMergedSurveyAgeMap(configs: SurveyConfig[]): Promise<Map<string, string>> {
  const ageConfigs = configs.filter((c) =>
    c.basicInfoFields?.some((f) => f.sheetColumn === '연령대'),
  );
  const maps = await Promise.all(ageConfigs.map((c) => getSurveyAgeMap(c)));
  const merged = new Map<string, string>();
  for (const map of maps) {
    for (const [key, age] of map) {
      const existing = merged.get(key);
      if (!existing || (AGE_RANK[age] ?? 0) > (AGE_RANK[existing] ?? 0)) {
        merged.set(key, age);
      }
    }
  }
  return merged;
}
