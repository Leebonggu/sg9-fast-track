/**
 * 회귀 테스트 — 전자동의 업로드 간 전이 이력 diff
 * 실행: npm test (또는 tsx tests/econsent-diff.test.ts)
 */
import { diffOwners } from '../src/lib/econsent-sheets';
import type { EconsentOwnerRow } from '../src/lib/econsent-types';

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
    console.log(`  ✗ ${label}:\n      got      ${a}\n      expected ${e}`);
  }
}

function owner(p: Partial<EconsentOwnerRow> & { dong: string; ho: string; name: string }): EconsentOwnerRow {
  return {
    seq: '1', birth: '1970-01-01', phone: '', ownership: '단독', repStatus: '',
    sintoStatus: '미제출', sintoSubmittedAt: '', planStatus: '미제출', planSubmittedAt: '',
    planChoice: '', ...p,
  };
}

// 로그 행에서 비교하기 쉬운 형태만 뽑는다
const brief = (cs: ReturnType<typeof diffOwners>) =>
  cs.map((c) => `${c.dong}-${c.ho} ${c.field}: ${c.oldValue || '∅'} → ${c.newValue || '∅'}`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: econsent 전이 이력 diff');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n[1] 변경 없으면 빈 배열');
{
  const a = [owner({ dong: '901', ho: '101', name: '김철수' })];
  assertEqual('동일 스냅샷', diffOwners(a, a), []);
}

console.log('\n[2] 신규 동의 — 미제출 → 전자동의');
{
  const prev = [owner({ dong: '901', ho: '101', name: '김철수' })];
  const next = [owner({ dong: '901', ho: '101', name: '김철수', sintoStatus: '전자동의', sintoSubmittedAt: '2026-08-20 10:00:00' })];
  assertEqual('신통 제출상태 전이', brief(diffOwners(prev, next)), ['901-101 신통_제출상태: 미제출 → 전자동의']);
}

console.log('\n[3] 추진방식 입장 변경');
{
  const prev = [owner({ dong: '901', ho: '101', name: '김철수', planStatus: '전자동의', planChoice: '추진위원회 구성' })];
  const next = [owner({ dong: '901', ho: '101', name: '김철수', planStatus: '전자동의', planChoice: '직접조합설립' })];
  assertEqual('선택항목 전이', brief(diffOwners(prev, next)), ['901-101 입안_선택항목: 추진위원회 구성 → 직접조합설립']);
}

console.log('\n[4] 대표 선임 성사');
{
  const prev = [
    owner({ dong: '901', ho: '102', name: '박대표', ownership: '공유', repStatus: '미선임' }),
    owner({ dong: '901', ho: '102', name: '박배우', ownership: '공유', repStatus: '미선임' }),
  ];
  const next = [
    owner({ dong: '901', ho: '102', name: '박대표', ownership: '공유', repStatus: '대표' }),
    owner({ dong: '901', ho: '102', name: '박배우', ownership: '공유', repStatus: '위임' }),
  ];
  assertEqual('두 소유자 각각 기록', brief(diffOwners(prev, next)), [
    '901-102 대표자여부: 미선임 → 대표',
    '901-102 대표자여부: 미선임 → 위임',
  ]);
}

console.log('\n[5] 소유권 이전 — 세대 단위 한 줄로');
{
  const prev = [owner({ dong: '901', ho: '503', name: '류지민' })];
  const next = [
    owner({ dong: '901', ho: '503', name: '강민규', ownership: '공유' }),
    owner({ dong: '901', ho: '503', name: '김채리', ownership: '공유' }),
  ];
  assertEqual('소유자명단 1행', brief(diffOwners(prev, next)), ['901-503 소유자명단: 류지민 → 강민규, 김채리']);
}

console.log('\n[6] 행 순서만 바뀐 건 변경이 아니다');
{
  const a = owner({ dong: '901', ho: '102', name: '박대표', ownership: '공유' });
  const b = owner({ dong: '901', ho: '102', name: '박배우', ownership: '공유' });
  assertEqual('명단 정렬 후 비교', diffOwners([a, b], [b, a]), []);
}

console.log('\n[7] 연락처 갱신');
{
  const prev = [owner({ dong: '901', ho: '101', name: '김철수', phone: '' })];
  const next = [owner({ dong: '901', ho: '101', name: '김철수', phone: '010-1111-2222' })];
  assertEqual('빈 값 → 번호', brief(diffOwners(prev, next)), ['901-101 연락처: ∅ → 010-1111-2222']);
}

console.log('\n[8] 신규 세대는 소유자명단으로만 잡히지 않는다 (직전에 없던 세대)');
{
  const prev: EconsentOwnerRow[] = [];
  const next = [owner({ dong: '999', ho: '101', name: '신규인', sintoStatus: '전자동의' })];
  assertEqual('직전에 없던 세대는 전이 없음', diffOwners(prev, next), []);
}

console.log('\n[9] 무명 행은 전이 대상이 아니다');
{
  const prev = [owner({ dong: '901', ho: '104', name: '', ownership: '' })];
  const next = [owner({ dong: '901', ho: '104', name: '', ownership: '', sintoStatus: '전자동의' })];
  assertEqual('무명은 건너뜀', diffOwners(prev, next), []);
}

console.log('\n[10] 여러 세대 동시 변경');
{
  const prev = [
    owner({ dong: '901', ho: '101', name: '김철수' }),
    owner({ dong: '902', ho: '201', name: '이영희' }),
    owner({ dong: '903', ho: '301', name: '박민수' }),
  ];
  const next = [
    owner({ dong: '901', ho: '101', name: '김철수', sintoStatus: '전자동의' }),
    owner({ dong: '902', ho: '201', name: '이영희' }),
    owner({ dong: '903', ho: '301', name: '박민수', planStatus: '전자동의', planChoice: '추진위원회 구성' }),
  ];
  const cs = diffOwners(prev, next);
  assertEqual('변경된 2세대만', brief(cs), [
    '901-101 신통_제출상태: 미제출 → 전자동의',
    '903-301 입안_제출상태: 미제출 → 전자동의',
    '903-301 입안_선택항목: ∅ → 추진위원회 구성',
  ]);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass, ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
