/**
 * 회귀 테스트 — xlsx 버퍼 파싱 (국민은행 원장 포맷)
 * 실행: npm test (또는 tsx tests/donation-import-file.test.ts)
 */
import * as XLSX from 'xlsx';
import { parseImportFile } from '../src/lib/donation-import';

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

function buildXlsxBuffer(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: donation-import 파일 파싱');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n[1] 정상 파일');
const buf = buildXlsxBuffer([
  ['No', '거래일시', '보낸분/받는분', '입금액(원)', '메모'],
  [1, '2026.07.02 13:48:51', '917동610호', 50000, ''],
  [2, '2026.07.01 21:01:30', '조종현', 50000, '906/703'],
]);
const rows = parseImportFile(buf);
assertEqual('행 개수', rows.length, 2);
assertEqual('첫 행 파싱', { dong: rows[0].dong, ho: rows[0].ho, source: rows[0].source }, { dong: '917', ho: '610', source: 'sender' });
assertEqual('첫 행 iso', rows[0].iso, '2026-07-02T13:48:51+09:00');
assertEqual('둘째 행 memo 우선', { dong: rows[1].dong, ho: rows[1].ho, source: rows[1].source }, { dong: '906', ho: '703', source: 'memo' });

console.log('\n[2] 컬럼 누락 → 에러');
const badBuf = buildXlsxBuffer([
  ['번호', '날짜', '금액'],
  [1, '2026.07.02', 50000],
]);
let threw = false;
try {
  parseImportFile(badBuf);
} catch {
  threw = true;
}
assertEqual('예상 컬럼 없으면 throw', threw, true);

console.log('\n[3] 헤더만 있는 빈 파일');
const emptyBuf = buildXlsxBuffer([
  ['No', '거래일시', '보낸분/받는분', '입금액(원)', '메모'],
]);
assertEqual('빈 결과(에러 아님)', parseImportFile(emptyBuf).length, 0);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
