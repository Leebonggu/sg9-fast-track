/**
 * 회귀 테스트 — 후원금 중복 분류 로직 (순수 함수, 구글시트 I/O 없음)
 * 실행: npm test (또는 tsx tests/donation-classify.test.ts)
 */
import { classifyRows, buildDedupKey } from '../src/lib/donation-import';
import type { ParsedImportRow } from '../src/lib/donation-import-types';

let pass = 0;
let fail = 0;

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}: got ${a}, expected ${e}`);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: 후원금 중복 분류');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const ISO_A = '2026-07-01T12:00:00+09:00';
const ISO_B = '2026-07-01T13:00:00+09:00';
const ISO_C = '2026-07-02T09:00:00+09:00';

const existing = new Map<string, { dong: string; ho: string }>([
  [buildDedupKey(ISO_A, 50000), { dong: '901', ho: '101' }],
  [buildDedupKey(ISO_B, 30000), { dong: '902', ho: '202' }],
]);

function row(partial: Partial<ParsedImportRow>): ParsedImportRow {
  return {
    rowIdx: 0, iso: '', dateOnly: '', amount: 0, sender: '', memo: '', dong: '', ho: '', source: 'sender',
    ...partial,
  };
}

const rows: ParsedImportRow[] = [
  row({ rowIdx: 1, iso: ISO_A, amount: 50000, dong: '901', ho: '101', source: 'sender' }), // 동/호수 일치 → duplicate
  row({ rowIdx: 2, iso: ISO_A, amount: 50000, dong: '', ho: '', source: 'fail' }),          // 파싱실패지만 키 일치 → duplicate
  row({ rowIdx: 3, iso: ISO_B, amount: 30000, dong: '905', ho: '505', source: 'sender' }), // 동/호수 불일치 → review
  row({ rowIdx: 4, iso: ISO_C, amount: 99999, dong: '910', ho: '303', source: 'sender' }), // 키 자체가 없음 → new
];

const result = classifyRows(rows, existing);

console.log('\n[1] 분류 결과');
assertEqual('row1 duplicate', result[0].classification, 'duplicate');
assertEqual('row2 duplicate(파싱실패도 키일치면 중복처리)', result[1].classification, 'duplicate');
assertEqual('row3 review', result[2].classification, 'review');
assertEqual('row3 existing 값 포함', { dong: result[2].existingDong, ho: result[2].existingHo }, { dong: '902', ho: '202' });
assertEqual('row4 new', result[3].classification, 'new');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
