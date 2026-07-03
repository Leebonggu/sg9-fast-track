// web/src/lib/donation.ts
// 후원금 납부 기록 — OWNER_SPREADSHEET_ID의 "후원금" 시트에 세대(동/호수)별 다건 기록.
// 신분증업로드(id-upload.ts)와 동일한 "별도 시트 + 동/호수 키 관계형 매핑" 패턴.
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import { buildDedupKey } from './donation-import';
import { sanitizeCell } from './xlsx-safe';

const SHEET_TITLE = '후원금';
const HEADERS = ['ID', '시각', '동', '호수', '납부일', '금액', '등록자', '비고', '상태'];

const LOG_SHEET_TITLE = '후원금변경로그';
const LOG_HEADERS = ['시각', '동', '호수', '필드', '이전값', '새값', '수정자'];

interface DonationChangeLogEntry {
  field: string;
  oldValue: string;
  newValue: string;
}

async function logDonationChanges(
  doc: GoogleSpreadsheet,
  dong: string,
  ho: string,
  changes: DonationChangeLogEntry[],
  operator: string,
): Promise<void> {
  if (changes.length === 0) return;
  let sheet = doc.sheetsByTitle[LOG_SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: LOG_SHEET_TITLE, headerValues: LOG_HEADERS });
  }
  const now = new Date().toISOString();
  await sheet.addRows(
    changes.map((c) => ({
      시각: now,
      동: dong,
      호수: ho,
      필드: c.field,
      이전값: c.oldValue,
      새값: c.newValue,
      수정자: operator,
    })),
  );
}

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

export interface DonationRecord {
  id: string;
  timestamp: string;
  dong: string;
  ho: string;
  paidDate: string;
  amount: number;
  registrant: string;
  note: string;
  status: string;
}

function mapRow(r: import('google-spreadsheet').GoogleSpreadsheetRow): DonationRecord {
  return {
    id: String(r.get('ID') || ''),
    timestamp: String(r.get('시각') || ''),
    dong: String(r.get('동') || '').trim(),
    ho: String(r.get('호수') || '').trim(),
    paidDate: String(r.get('납부일') || ''),
    amount: Number(r.get('금액')) || 0,
    registrant: String(r.get('등록자') || ''),
    note: String(r.get('비고') || ''),
    status: String(r.get('상태') || ''),
  };
}

// 특정 세대의 (취소되지 않은) 납부 기록 — 납부일 내림차순
export async function getDonations(dong: string, ho: string): Promise<DonationRecord[]> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows
    .map(mapRow)
    .filter((r) => r.dong === dong && r.ho === ho && r.status !== '취소')
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate));
}

// 전체 세대별 합계/횟수 (취소 제외) — /api/unified 병합용
export async function getAllDonationSummary(): Promise<
  Map<string, { total: number; count: number }>
> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  const map = new Map<string, { total: number; count: number }>();
  if (!sheet) return map;
  const rows = await sheet.getRows();
  for (const row of rows.map(mapRow)) {
    if (row.status === '취소') continue;
    const key = `${row.dong}-${row.ho}`;
    const cur = map.get(key) || { total: 0, count: 0 };
    cur.total += row.amount;
    cur.count += 1;
    map.set(key, cur);
  }
  return map;
}

export async function addDonation(rec: {
  dong: string;
  ho: string;
  paidDate: string;
  amount: number;
  registrant: string;
  note?: string;
}): Promise<void> {
  const doc = await getDoc();
  const sheet = await ensureSheet(doc);
  await sheet.addRow({
    ID: crypto.randomUUID(),
    시각: new Date().toISOString(),
    동: sanitizeCell(rec.dong),
    호수: sanitizeCell(rec.ho),
    납부일: rec.paidDate,
    금액: String(rec.amount),
    등록자: sanitizeCell(rec.registrant),
    비고: sanitizeCell(rec.note || ''),
    상태: '정상',
  });
}

// 수정/취소 이력은 후원금 시트의 비고(관리자 자유 메모 전용)가 아니라
// 전용 "후원금변경로그" 시트에 기록한다.
export async function updateDonation(
  id: string,
  updates: { paidDate?: string; amount?: number; note?: string },
  operator: string,
): Promise<void> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) throw new Error('후원금 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find((r) => String(r.get('ID') || '') === id);
  if (!row) throw new Error('해당 후원금 기록을 찾을 수 없습니다.');

  const dong = String(row.get('동') || '').trim();
  const ho = String(row.get('호수') || '').trim();
  const changes: DonationChangeLogEntry[] = [];

  if (updates.paidDate !== undefined && updates.paidDate !== String(row.get('납부일') || '')) {
    changes.push({ field: '납부일', oldValue: String(row.get('납부일') || ''), newValue: updates.paidDate });
    row.set('납부일', updates.paidDate);
  }
  if (updates.amount !== undefined && updates.amount !== (Number(row.get('금액')) || 0)) {
    changes.push({ field: '금액', oldValue: String(row.get('금액') || 0), newValue: String(updates.amount) });
    row.set('금액', String(updates.amount));
  }
  if (updates.note !== undefined && updates.note !== String(row.get('비고') || '')) {
    row.set('비고', sanitizeCell(updates.note));
  }

  await row.save();
  await logDonationChanges(doc, dong, ho, changes, operator);
}

export async function cancelDonation(id: string, operator: string): Promise<void> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) throw new Error('후원금 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find((r) => String(r.get('ID') || '') === id);
  if (!row) throw new Error('해당 후원금 기록을 찾을 수 없습니다.');

  const dong = String(row.get('동') || '').trim();
  const ho = String(row.get('호수') || '').trim();
  const prevStatus = String(row.get('상태') || '');
  row.set('상태', '취소');
  await row.save();
  await logDonationChanges(
    doc,
    dong,
    ho,
    [{ field: '상태', oldValue: prevStatus, newValue: '취소' }],
    operator,
  );
}

// 업로드 미리보기용 — 후원금 시트 전체를 시각+금액 키로 로드 (중복판단)
export async function getExistingDonationsByKey(): Promise<Map<string, { dong: string; ho: string }>> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  const map = new Map<string, { dong: string; ho: string }>();
  if (!sheet) return map;
  const rows = await sheet.getRows();
  for (const row of rows) {
    const key = buildDedupKey(String(row.get('시각') || ''), Number(row.get('금액')) || 0);
    map.set(key, { dong: String(row.get('동') || '').trim(), ho: String(row.get('호수') || '').trim() });
  }
  return map;
}

export interface BulkDonationInput {
  iso: string;
  dateOnly: string;
  amount: number;
  dong: string;
  ho: string;
}

// xlsx 일괄업로드 확정 등록 — addDonation()과 달리 시각을 "지금"이 아니라
// 원본 송금시각(iso, 파라미터로 전달받음) 그대로 저장한다.
export async function bulkAddDonations(records: BulkDonationInput[], registrant: string): Promise<void> {
  if (records.length === 0) return;
  const doc = await getDoc();
  const sheet = await ensureSheet(doc);
  await sheet.addRows(
    records.map((r) => ({
      ID: crypto.randomUUID(),
      시각: r.iso,
      동: sanitizeCell(r.dong),
      호수: sanitizeCell(r.ho),
      납부일: r.dateOnly,
      금액: String(r.amount),
      등록자: sanitizeCell(registrant),
      비고: '',
      상태: '정상',
    })),
  );
}

// 전체 후원금 거래 목록 (취소 포함) — /unified/donations 목록 페이지용
export async function getAllDonations(): Promise<DonationRecord[]> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows
    .map(mapRow)
    .sort((a, b) => {
      const dateCompare = b.paidDate.localeCompare(a.paidDate);
      if (dateCompare !== 0) return dateCompare;
      return (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0);
    });
}
