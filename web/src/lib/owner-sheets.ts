// web/src/lib/owner-sheets.ts
import {
  GoogleSpreadsheet,
  type GoogleSpreadsheetRow,
} from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import type { OwnerRow, UnifiedRow, UnifiedRowOverrides } from './unified-types';

// 한국 우편번호는 5자리 — 시트가 숫자 포맷이면 leading-zero가 사라지므로 보정
function normalizePostalCode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length < 5 ? digits.padStart(5, '0') : digits;
}

let ownerDocCache: GoogleSpreadsheet | null = null;

async function getOwnerDoc(): Promise<GoogleSpreadsheet> {
  if (ownerDocCache) return ownerDocCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  ownerDocCache = doc;
  return doc;
}

// 원본 시트는 헤더 변형이 다양 (\n, 공백) → 후보 중 실제 존재하는 키를 선택
function pickExistingKey(row: GoogleSpreadsheetRow, candidates: string[]): string {
  for (const c of candidates) {
    if (row.get(c) !== undefined) return c;
  }
  return candidates[0];
}

const ownerNameVariants = (n: number) => [
  `소유자${n}(성명)`,
  `소유자${n}\n(성명)`,
  `소유자${n} \n(성명)`,
  `소유자${n} (성명)`,
];
const postalVariants = [
  '소유자1(우편번호)',
  '소유자1\n(우편번호)',
  '소유자1 \n(우편번호)',
  '소유자1 (우편번호)',
];
const addressVariants = [
  '소유자1(주소)',
  '소유자1\n(주소)',
  '소유자1 \n(주소)',
  '소유자1 (주소)',
];

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
      ownerName: [1, 2, 3, 4, 5]
        .map((n) =>
          ownerNameVariants(n)
            .map((k) => String(row.get(k) || '').trim())
            .find(Boolean) || '',
        )
        .filter(Boolean)
        .join(', '),
      postalCode: normalizePostalCode(
        postalVariants.map((k) => String(row.get(k) || '').trim()).find(Boolean) || '',
      ),
      address:
        addressVariants.map((k) => String(row.get(k) || '').trim()).find(Boolean) || '',
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
    return new Map();
  }
}

// 마스터 시트("통합현황")에서 반대 의사 맵 읽기 (sync 전 보존용)
export async function getOppositionMap(): Promise<Map<string, boolean>> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return new Map();
  try {
    const rows = await sheet.getRows();
    const map = new Map<string, boolean>();
    for (const row of rows) {
      const key = `${row.get('동')}-${row.get('호수')}`;
      if (row.get('재건축반대') === 'TRUE') map.set(key, true);
    }
    return map;
  } catch {
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
    '동', '호수', '소유자명', '우편번호', '대표주소', '실거주여부',
    '신속통합동의서_제출_완료',
    ...surveyIds,
    '재건축반대', '메모', '마지막_동기화',
  ];

  await sheet.clear();
  await sheet.setHeaderRow(headers);

  const data = rows.map((r) => ({
    동: r.dong,
    호수: r.ho,
    소유자명: r.ownerName,
    우편번호: r.postalCode,
    대표주소: r.address,
    실거주여부: r.residency,
    신속통합동의서_제출_완료: r.consent ? 'TRUE' : 'FALSE',
    ...Object.fromEntries(
      surveyIds.map((id) => [id, r.surveys[id] ? 'TRUE' : 'FALSE']),
    ),
    재건축반대: r.opposition ? 'TRUE' : 'FALSE',
    메모: r.memo,
    마지막_동기화: r.lastSynced,
  }));

  for (let i = 0; i < data.length; i += 500) {
    await sheet.addRows(data.slice(i, i + 500));
  }
}

// 특정 세대 반대 의사 토글 (통합현황 시트)
export async function updateOpposition(dong: string, ho: string, value: boolean): Promise<void> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) throw new Error('통합현황 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) => String(r.get('동')) === dong && String(r.get('호수')) === ho,
  );
  if (!row) throw new Error(`${dong}동 ${ho}호를 찾을 수 없습니다.`);
  row.set('재건축반대', value ? 'TRUE' : 'FALSE');
  await row.save();
}

// 특정 세대 메모만 업데이트 (통합현황 시트)
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

interface ChangeLogEntry {
  field: string;
  oldValue: string;
  newValue: string;
}

const CHANGE_LOG_HEADERS = ['시각', '동', '호수', '필드', '이전값', '새값', '수정자'];

async function logChanges(
  doc: GoogleSpreadsheet,
  dong: string,
  ho: string,
  changes: ChangeLogEntry[],
  operator: string,
): Promise<void> {
  if (changes.length === 0) return;
  let sheet = doc.sheetsByTitle['변경로그'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: '변경로그', headerValues: CHANGE_LOG_HEADERS });
  } else {
    // 기존 시트에 새 컬럼(수정자 등)이 없으면 자동 추가
    await sheet.loadHeaderRow();
    const missing = CHANGE_LOG_HEADERS.filter((h) => !sheet!.headerValues.includes(h));
    if (missing.length > 0) {
      await sheet.setHeaderRow([...sheet.headerValues, ...missing]);
    }
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

// 위원이 모달에서 수정한 4필드를 원본 시트에 직접 반영 + 변경로그 append
export async function updateOwnerRecord(
  dong: string,
  ho: string,
  overrides: UnifiedRowOverrides,
  operator: string,
): Promise<{ changes: ChangeLogEntry[] }> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['원본'];
  if (!sheet) throw new Error('원본 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === dong &&
      String(r.get('호수') || '').trim() === ho,
  );
  if (!row) throw new Error(`원본 시트에 ${dong}동 ${ho}호가 없습니다.`);

  const changes: ChangeLogEntry[] = [];

  // 소유자명 — 콤마 구분 → 1~5에 분배 (6명 이상은 잘림)
  if (overrides.ownerName !== undefined) {
    const names = overrides.ownerName.split(/,\s*/).map((s) => s.trim());
    for (let n = 1; n <= 5; n++) {
      const key = pickExistingKey(row, ownerNameVariants(n));
      const oldValue = String(row.get(key) || '').trim();
      const newValue = names[n - 1] || '';
      if (oldValue !== newValue) {
        row.set(key, newValue);
        changes.push({ field: key, oldValue, newValue });
      }
    }
  }

  // 우편번호 (소유자1)
  if (overrides.postalCode !== undefined) {
    const key = pickExistingKey(row, postalVariants);
    const oldValue = String(row.get(key) || '').trim();
    const newValue = normalizePostalCode(overrides.postalCode);
    if (oldValue !== newValue) {
      row.set(key, newValue);
      changes.push({ field: key, oldValue, newValue });
    }
  }

  // 주소 (소유자1)
  if (overrides.address !== undefined) {
    const key = pickExistingKey(row, addressVariants);
    const oldValue = String(row.get(key) || '').trim();
    const newValue = overrides.address.trim();
    if (oldValue !== newValue) {
      row.set(key, newValue);
      changes.push({ field: key, oldValue, newValue });
    }
  }

  // 실거주여부
  if (overrides.residency !== undefined) {
    const oldValue = String(row.get('실거주여부') || '').trim();
    const newValue = overrides.residency.trim();
    if (oldValue !== newValue) {
      row.set('실거주여부', newValue);
      changes.push({ field: '실거주여부', oldValue, newValue });
    }
  }

  if (changes.length === 0) return { changes };

  await row.save();
  await logChanges(doc, dong, ho, changes, operator);
  // 통합현황 시트의 해당 행도 즉시 동기화 (전체 sync 없이 바로 반영)
  await updateMasterRowFields(doc, dong, ho, overrides);
  return { changes };
}

async function updateMasterRowFields(
  doc: GoogleSpreadsheet,
  dong: string,
  ho: string,
  overrides: UnifiedRowOverrides,
): Promise<void> {
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return;
  let rows;
  try {
    rows = await sheet.getRows();
  } catch {
    return; // 빈 시트(헤더 없음) — 첫 sync 전 정상
  }
  const row = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === dong &&
      String(r.get('호수') || '').trim() === ho,
  );
  if (!row) return;
  if (overrides.ownerName !== undefined) row.set('소유자명', overrides.ownerName);
  if (overrides.postalCode !== undefined) {
    row.set('우편번호', normalizePostalCode(overrides.postalCode));
  }
  if (overrides.address !== undefined) row.set('대표주소', overrides.address.trim());
  if (overrides.residency !== undefined) row.set('실거주여부', overrides.residency.trim());
  await row.save();
}

// 마스터 시트 전체 읽기 (API에서 사용)
export async function getMasterRows(): Promise<{ rows: UnifiedRow[]; surveyIds: string[] }> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return { rows: [], surveyIds: [] };

  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const fixedCols = new Set([
    '동', '호수', '소유자명', '우편번호', '대표주소', '실거주여부',
    '신속통합동의서_제출_완료', '재건축반대', '메모', '마지막_동기화',
  ]);
  const surveyIds = headers.filter((h) => !fixedCols.has(h));

  const sheetRows = await sheet.getRows();
  const rows: UnifiedRow[] = sheetRows.map((row) => ({
    dong: String(row.get('동') || ''),
    ho: String(row.get('호수') || ''),
    ownerName: String(row.get('소유자명') || ''),
    postalCode: normalizePostalCode(String(row.get('우편번호') || '')),
    address: String(row.get('대표주소') || ''),
    residency: String(row.get('실거주여부') || ''),
    consent: row.get('신속통합동의서_제출_완료') === 'TRUE',
    surveys: Object.fromEntries(
      surveyIds.map((id) => [id, row.get(id) === 'TRUE']),
    ),
    opposition: row.get('재건축반대') === 'TRUE',
    memo: String(row.get('메모') || ''),
    lastSynced: String(row.get('마지막_동기화') || ''),
  }));

  return { rows, surveyIds };
}

export async function getOwnersByDongHo(dong: string, ho: string): Promise<string[]> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['원본'];
  if (!sheet) throw new Error('원본 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) => String(r.get('동') || '').trim() === dong && String(r.get('호수') || '').trim() === ho,
  );
  if (!row) return [];
  const owners: string[] = [];
  for (let n = 1; n <= 5; n++) {
    const name =
      ownerNameVariants(n)
        .map((k) => String(row.get(k) || '').trim())
        .find(Boolean) || '';
    if (name) owners.push(name);
  }
  return owners;
}
