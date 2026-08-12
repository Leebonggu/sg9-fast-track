/**
 * 회귀 테스트 — 통합현황 자유 검색
 * 실행: npm test (또는 tsx tests/unified-search.test.ts)
 *
 * 배경: 표가 가상 스크롤이라 브라우저 Ctrl+F가 렌더된 30여 행만 훑는다.
 * searchRows가 그 자리를 대신하므로, 화면에 없는 필드까지 걸리는지가 핵심 계약이다.
 */
import { searchRows } from '../src/lib/unified-utils';
import type { UnifiedRow } from '../src/lib/unified-types';

let pass = 0;
let fail = 0;

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}: got ${a}, expected ${e}`); }
}

function row(p: Partial<UnifiedRow> & { dong: string; ho: string }): UnifiedRow {
  return {
    ownerName: '', postalCode: '', address: '', residency: '',
    consent: false, surveys: {}, memo: '', lastSynced: '', ...p,
  };
}

const rows: UnifiedRow[] = [
  row({ dong: '901', ho: '101', ownerName: '김철수', phone: '010-1234-5678' }),
  row({ dong: '901', ho: '102', ownerName: '이영희', memo: '부재중 3회' }),
  row({ dong: '903', ho: '1204', ownerName: '김철수', phone: '010-9999-0000' }),
  row({ dong: '911', ho: '502', ownerName: '박민수', rosterName: '최지혜, 박민수' }),
  row({ dong: '920', ho: '101', ownerName: '정소영', representative: '정소영', planChoice: '직접조합설립' }),
];
const keys = (rs: UnifiedRow[]) => rs.map((r) => `${r.dong}-${r.ho}`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: 통합현황 검색');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

assertEqual('빈 검색어는 전체 반환', searchRows(rows, '').length, 5);
assertEqual('공백만 입력해도 전체 반환', searchRows(rows, '   ').length, 5);
assertEqual('이름으로 검색', keys(searchRows(rows, '김철수')), ['901-101', '903-1204']);
assertEqual('동으로 검색', keys(searchRows(rows, '901')), ['901-101', '901-102']);
assertEqual('토큰 2개는 AND', keys(searchRows(rows, '901 김')), ['901-101']);
assertEqual('"동-호수" 결합 표기', keys(searchRows(rows, '903-1204')), ['903-1204']);
assertEqual('"동 호수" 띄어쓰기 표기', keys(searchRows(rows, '903 1204')), ['903-1204']);
assertEqual('"동호수" 붙여쓰기 표기', keys(searchRows(rows, '9031204')), ['903-1204']);
assertEqual('연락처 일부', keys(searchRows(rows, '9999')), ['903-1204']);
assertEqual('메모', keys(searchRows(rows, '부재중')), ['901-102']);
// 아래 3개는 표에 컬럼이 없거나 배지로만 보이는 값 — Ctrl+F로는 절대 못 찾는다
assertEqual('명부이름(화면 밖 필드)', keys(searchRows(rows, '최지혜')), ['911-502']);
assertEqual('공유 대표자', keys(searchRows(rows, '정소영')), ['920-101']);
assertEqual('추진방식', keys(searchRows(rows, '직접조합설립')), ['920-101']);
assertEqual('없는 값은 빈 결과', searchRows(rows, '없는이름').length, 0);
assertEqual('원본 배열을 변형하지 않음', rows.length, 5);

console.log(`\n 결과: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
