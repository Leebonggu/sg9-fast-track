import * as XLSX from 'xlsx';
import { parseTransactionRow } from './donation-parser';
import type { ParsedImportRow, ClassifiedImportRow } from './donation-import-types';

export function buildDedupKey(iso: string, amount: number): string {
  return `${iso}|${amount}`;
}

// "2026.07.02 13:48:51" (은행 거래일시 표기, KST) -> ISO 문자열 + 날짜만
export function toIsoKst(dateStr: string): { iso: string; dateOnly: string } | null {
  const m = String(dateStr).trim().match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${se}+09:00`, dateOnly: `${y}-${mo}-${d}` };
}

// 국민은행 거래내역 원장 포맷: No / 거래일시 / 보낸분/받는분 / 입금액(원) / 메모(선택)
export function parseImportFile(buffer: Buffer): ParsedImportRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (rows.length === 0) return [];

  const header = (rows[0] as unknown[]).map((h) => String(h));
  const dateIdx = header.indexOf('거래일시');
  const senderIdx = header.indexOf('보낸분/받는분');
  const amountIdx = header.indexOf('입금액(원)');
  const memoIdx = header.indexOf('메모');

  if (dateIdx === -1 || senderIdx === -1 || amountIdx === -1) {
    throw new Error('예상한 컬럼(거래일시/보낸분·받는분/입금액(원))을 찾을 수 없습니다.');
  }

  const result: ParsedImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const dateStr = String(row[dateIdx] ?? '');
    if (!dateStr) continue;
    const dt = toIsoKst(dateStr);
    if (!dt) continue;
    const sender = String(row[senderIdx] ?? '');
    const memo = memoIdx === -1 ? '' : String(row[memoIdx] ?? '');
    const amount = Number(row[amountIdx]) || 0;
    const { dong, ho, source } = parseTransactionRow(sender, memo);
    result.push({ rowIdx: i, iso: dt.iso, dateOnly: dt.dateOnly, amount, sender, memo, dong, ho, source });
  }
  return result;
}

// 시각+금액 키가 일치하는데 동/호수까지 같으면(또는 신규쪽 파싱이 실패했으면) 확실한 중복.
// 동/호수가 다르면 콜리전이거나 파싱 오류일 수 있어 review로 넘겨 사람이 확인하게 한다.
export function classifyRows(
  rows: ParsedImportRow[],
  existing: Map<string, { dong: string; ho: string }>,
): ClassifiedImportRow[] {
  return rows.map((row) => {
    const key = buildDedupKey(row.iso, row.amount);
    const match = existing.get(key);
    if (!match) {
      return { ...row, classification: 'new' };
    }
    const sameUnit = !row.dong || (row.dong === match.dong && row.ho === match.ho);
    if (sameUnit) {
      return { ...row, classification: 'duplicate', existingDong: match.dong, existingHo: match.ho };
    }
    return { ...row, classification: 'review', existingDong: match.dong, existingHo: match.ho };
  });
}
