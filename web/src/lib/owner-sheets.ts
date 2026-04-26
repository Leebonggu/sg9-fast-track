// web/src/lib/owner-sheets.ts
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import type { OwnerRow, UnifiedRow } from './unified-types';

let ownerDocCache: GoogleSpreadsheet | null = null;

async function getOwnerDoc(): Promise<GoogleSpreadsheet> {
  if (ownerDocCache) return ownerDocCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  ownerDocCache = doc;
  return doc;
}

// 소유자 원본 시트("원본")에서 2,830행 읽기
export async function getOwners(): Promise<OwnerRow[]> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['원본'];
  if (!sheet) throw new Error('원본 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  return rows
    .map((row) => ({
      dong: String(row.get('동') || '').trim(),
      ho: String(row.get('호수') || '').trim(),
      ownerName: String(row.get('소유자1 (성명)') || '').trim(),
      residency: String(row.get('실거주여부') || '').trim(),
    }))
    .filter((r) => r.dong && r.ho);
}

// 마스터 시트("통합현황")에서 현재 메모 맵 읽기 (sync 전 보존용)
export async function getMemoMap(): Promise<Map<string, string>> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return new Map();
  try {
    const rows = await sheet.getRows();
    const map = new Map<string, string>();
    for (const row of rows) {
      const key = `${row.get('동')}-${row.get('호수')}`;
      const memo = String(row.get('메모') || '');
      if (memo) map.set(key, memo);
    }
    return map;
  } catch {
    // 빈 시트(헤더 없음)인 경우 — 첫 sync 전 정상 상태
    return new Map();
  }
}

// 마스터 시트("통합현황") 전체 overwrite
export async function writeMasterRows(
  rows: UnifiedRow[],
  surveyIds: string[],
): Promise<void> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) throw new Error('통합현황 시트를 찾을 수 없습니다.');

  const headers = [
    '동', '호수', '소유자명', '실거주여부',
    '사전동의_완료',
    ...surveyIds.map((id) => `${id}_완료`),
    '메모', '마지막_동기화',
  ];

  // 헤더 설정
  await sheet.setHeaderRow(headers);

  // 기존 데이터 행 전체 삭제
  const existingRows = await sheet.getRows();
  for (let i = existingRows.length - 1; i >= 0; i--) {
    await existingRows[i].delete();
  }

  // 새 데이터 500행씩 배치 추가
  const data = rows.map((r) => ({
    동: r.dong,
    호수: r.ho,
    소유자명: r.ownerName,
    실거주여부: r.residency,
    사전동의_완료: r.consent ? 'TRUE' : 'FALSE',
    ...Object.fromEntries(
      surveyIds.map((id) => [`${id}_완료`, r.surveys[id] ? 'TRUE' : 'FALSE']),
    ),
    메모: r.memo,
    마지막_동기화: r.lastSynced,
  }));

  for (let i = 0; i < data.length; i += 500) {
    await sheet.addRows(data.slice(i, i + 500));
  }
}

// 특정 세대 메모만 업데이트
export async function updateMemo(dong: string, ho: string, memo: string): Promise<void> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) throw new Error('통합현황 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) => String(r.get('동')) === dong && String(r.get('호수')) === ho,
  );
  if (!row) throw new Error(`${dong}동 ${ho}호를 찾을 수 없습니다.`);
  row.set('메모', memo);
  await row.save();
}

// 마스터 시트 전체 읽기 (API에서 사용)
export async function getMasterRows(): Promise<{ rows: UnifiedRow[]; surveyIds: string[] }> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return { rows: [], surveyIds: [] };

  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const surveyIds = headers
    .filter((h) => h.endsWith('_완료') && h.startsWith('survey-'))
    .map((h) => h.replace('_완료', ''));

  const sheetRows = await sheet.getRows();
  const rows: UnifiedRow[] = sheetRows.map((row) => ({
    dong: String(row.get('동') || ''),
    ho: String(row.get('호수') || ''),
    ownerName: String(row.get('소유자명') || ''),
    residency: String(row.get('실거주여부') || ''),
    consent: row.get('사전동의_완료') === 'TRUE',
    surveys: Object.fromEntries(
      surveyIds.map((id) => [id, row.get(`${id}_완료`) === 'TRUE']),
    ),
    memo: String(row.get('메모') || ''),
    lastSynced: String(row.get('마지막_동기화') || ''),
  }));

  return { rows, surveyIds };
}
