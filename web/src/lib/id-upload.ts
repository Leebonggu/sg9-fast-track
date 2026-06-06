// web/src/lib/id-upload.ts
// 신분증 사본 업로드 — Apps Script 웹앱(SURVEY_WEBAPP_URL) 경유 Drive 저장 +
// OWNER_SPREADSHEET_ID의 "신분증업로드" 시트에 기록.
// (서비스 계정은 Drive 파일 소유 불가 → PDF와 동일하게 웹앱을 다리로 사용)
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';

const SHEET_TITLE = '신분증업로드';
const HEADERS = [
  '시각', '동', '호수', '소유자명', '소유자순번', '파일명', '파일ID', 'Drive링크', 'IP', '상태',
];

let docCache: GoogleSpreadsheet | null = null;

async function getDoc(): Promise<GoogleSpreadsheet> {
  if (docCache) return docCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
}

async function ensureSheet(doc: GoogleSpreadsheet) {
  let sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: HEADERS });
  }
  return sheet;
}

export interface IdUploadRecord {
  timestamp: string;
  dong: string;
  ho: string;
  ownerName: string;
  ownerIndex: number;
  fileName: string;
  fileId: string;
  link: string;
  ip: string;
  status: string;
}

function mapRow(r: import('google-spreadsheet').GoogleSpreadsheetRow): IdUploadRecord {
  return {
    timestamp: String(r.get('시각') || ''),
    dong: String(r.get('동') || '').trim(),
    ho: String(r.get('호수') || '').trim(),
    ownerName: String(r.get('소유자명') || ''),
    ownerIndex: parseInt(String(r.get('소유자순번') || '0'), 10) || 0,
    fileName: String(r.get('파일명') || ''),
    fileId: String(r.get('파일ID') || ''),
    link: String(r.get('Drive링크') || ''),
    ip: String(r.get('IP') || ''),
    status: String(r.get('상태') || ''),
  };
}

// ── 시트 조회/기록 ──────────────────────────────────────────

// 특정 세대의 (파기되지 않은) 업로드 기록
export async function getIdUploads(dong: string, ho: string): Promise<IdUploadRecord[]> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows
    .map(mapRow)
    .filter((r) => r.dong === dong && r.ho === ho && r.status !== '파기');
}

// 전체 업로드 기록 (관리자 인쇄/현황)
export async function getAllIdUploads(): Promise<IdUploadRecord[]> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows.map(mapRow).filter((r) => r.status !== '파기');
}

// (동,호,소유자순번) 기준 upsert — 재업로드 시 기존 행 갱신.
// 교체로 인해 더 이상 참조되지 않는 이전 파일ID를 반환 (호출측에서 Drive 삭제 → 고아 파일 방지).
export async function recordIdUpload(rec: {
  dong: string;
  ho: string;
  ownerName: string;
  ownerIndex: number;
  fileName: string;
  fileId: string;
  link: string;
  ip: string;
}): Promise<string | null> {
  const doc = await getDoc();
  const sheet = await ensureSheet(doc);
  const rows = await sheet.getRows();
  const now = new Date().toISOString();
  const existing = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === rec.dong &&
      String(r.get('호수') || '').trim() === rec.ho &&
      (parseInt(String(r.get('소유자순번') || '0'), 10) || 0) === rec.ownerIndex &&
      String(r.get('상태') || '') !== '파기',
  );
  if (existing) {
    const prevFileId = String(existing.get('파일ID') || '').trim();
    existing.set('시각', now);
    existing.set('소유자명', rec.ownerName);
    existing.set('파일명', rec.fileName);
    existing.set('파일ID', rec.fileId);
    existing.set('Drive링크', rec.link);
    existing.set('IP', rec.ip);
    existing.set('상태', '제출');
    await existing.save();
    return prevFileId && prevFileId !== rec.fileId ? prevFileId : null;
  }
  await sheet.addRow({
    시각: now,
    동: rec.dong,
    호수: rec.ho,
    소유자명: rec.ownerName,
    소유자순번: String(rec.ownerIndex),
    파일명: rec.fileName,
    파일ID: rec.fileId,
    Drive링크: rec.link,
    IP: rec.ip,
    상태: '제출',
  });
  return null;
}

// 수동 폐기: 상태='파기' 표기 후 fileId 반환 (호출측에서 Drive 삭제)
export async function markIdPurged(
  dong: string,
  ho: string,
  ownerIndex: number,
): Promise<string | null> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return null;
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === dong &&
      String(r.get('호수') || '').trim() === ho &&
      (parseInt(String(r.get('소유자순번') || '0'), 10) || 0) === ownerIndex &&
      String(r.get('상태') || '') !== '파기',
  );
  if (!row) return null;
  const fileId = String(row.get('파일ID') || '');
  row.set('상태', '파기');
  await row.save();
  return fileId || null;
}

// ── Apps Script 웹앱 호출 ────────────────────────────────────

function getWebappUrl(): string {
  const url = process.env.SURVEY_WEBAPP_URL;
  if (!url) throw new Error('환경변수 SURVEY_WEBAPP_URL이 설정되지 않았습니다.');
  return url;
}

function getSecret(): string {
  const s = process.env.ID_UPLOAD_SECRET;
  if (!s) throw new Error('환경변수 ID_UPLOAD_SECRET이 설정되지 않았습니다.');
  return s;
}

export async function uploadIdImage(
  fileName: string,
  mimeType: string,
  base64: string,
): Promise<{ link: string; fileId: string }> {
  const folderId = process.env.ID_UPLOAD_FOLDER_ID;
  if (!folderId) throw new Error('환경변수 ID_UPLOAD_FOLDER_ID이 설정되지 않았습니다.');

  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'idUpload',
      secret: getSecret(),
      folderId,
      fileName,
      mimeType,
      base64,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { link: data.link, fileId: data.fileId };
}

export async function fetchIdImage(
  fileId: string,
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'idFetch', secret: getSecret(), fileId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { base64: data.base64, mimeType: data.mimeType || 'image/jpeg' };
}

export async function deleteIdImage(fileId: string): Promise<void> {
  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'idDelete', secret: getSecret(), fileId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}
