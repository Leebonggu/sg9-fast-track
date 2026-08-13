/**
 * 전자동의서 대상자관리 xlsx 2개를 파싱해 집계 리포트를 출력한다.
 * 업로드 전에 파일이 멀쩡한지 눈으로 확인하는 용도 + 파서 회귀 검증.
 *
 * 실행:
 *   tsx scripts/verify-econsent-parser.mts <신속통합.xlsx> <정비계획입안.xlsx> [--baseline]
 *
 * --baseline 을 주면 2026-08-10 파일의 실측값과 대조해 assert한다.
 * 원본은 개인정보라 저장소에 넣지 않으므로 경로를 인자로 받는다.
 */
import fs from 'node:fs';
import { parseEconsentFiles } from '../src/lib/econsent-parser';

const [sintoPath, planPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const baseline = process.argv.includes('--baseline');

if (!sintoPath || !planPath) {
  console.error('사용법: tsx scripts/verify-econsent-parser.mts <신속통합.xlsx> <정비계획입안.xlsx> [--baseline]');
  process.exit(1);
}

const r = parseEconsentFiles(fs.readFileSync(sintoPath), fs.readFileSync(planPath));
const hh = [...r.households.values()];
const count = (fn: (h: (typeof hh)[number]) => boolean) => hh.filter(fn).length;

const shared = count((h) => h.ownerCount > 1);
const withRep = count((h) => h.ownerCount > 1 && h.representative !== '');
const choiceRows = r.owners.reduce<Record<string, number>>((m, o) => {
  if (o.planChoice) m[o.planChoice] = (m[o.planChoice] ?? 0) + 1;
  return m;
}, {});

const stats = {
  '소유자 행': r.owners.length,
  '세대': r.households.size,
  '상가 스킵': r.skipped.commercial,
  '무명 소유자': r.unnamedOwners,
  '신통 완전': count((h) => h.sinto === '완전'),
  '신통 일부': count((h) => h.sinto === '일부'),
  '입안 완전': count((h) => h.plan === '완전'),
  '입안 일부': count((h) => h.plan === '일부'),
  '공유 세대': shared,
  '대표 선임': withRep,
  '대표 미선임': shared - withRep,
  '추진위원회 구성(행)': choiceRows['추진위원회 구성'] ?? 0,
  '직접조합설립(행)': choiceRows['직접조합설립'] ?? 0,
  '연령대 있는 세대': count((h) => h.ageGroup !== ''),
  '연락처 있는 세대': count((h) => h.phone !== ''),
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 전자동의 파싱 리포트');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
for (const [k, v] of Object.entries(stats)) {
  console.log(`  ${k.padEnd(22, ' ')} ${String(v).padStart(6, ' ')}`);
}

// 세대 기준 추진방식 (행 기준과 달리 공유 세대를 1로 셈)
const choiceHouseholds = hh.reduce<Record<string, number>>((m, h) => {
  if (h.planChoice) m[h.planChoice] = (m[h.planChoice] ?? 0) + 1;
  return m;
}, {});
console.log('\n  추진방식 (세대 기준)');
for (const [k, v] of Object.entries(choiceHouseholds)) {
  console.log(`    ${k.padEnd(20, ' ')} ${String(v).padStart(6, ' ')}`);
}

console.log(`\n  warnings: ${r.warnings.length}건`);
r.warnings.slice(0, 20).forEach((w) => console.log(`    - ${w}`));
if (r.warnings.length > 20) console.log(`    ... 외 ${r.warnings.length - 20}건`);

if (!baseline) process.exit(0);

// 2026-08-10 파일 실측값 — 라이브 데이터로 직접 확인한 수치다. 안 맞으면 파서가 틀린 것이다.
const EXPECTED: Record<string, number> = {
  '소유자 행': 3181,
  '세대': 2830,
  '상가 스킵': 45,
  '신통 완전': 474,
  '신통 일부': 32,
  '입안 완전': 390,
  '입안 일부': 30,
  '공유 세대': 334,
  '대표 선임': 75,
  '대표 미선임': 259,
  '추진위원회 구성(행)': 441,
  '직접조합설립(행)': 40,
  '연령대 있는 세대': 2784,
  // 원본 연락처는 1,117세대지만 902-708의 "0105686"은 잘린 번호라 파서가 버린다.
  '연락처 있는 세대': 1116,
  '무명 소유자': 37,
};

console.log('\n━━ baseline 대조 (2026-08-10 파일) ━━');
let fail = 0;
for (const [k, want] of Object.entries(EXPECTED)) {
  const got = stats[k as keyof typeof stats];
  if (got === want) {
    console.log(`  ✓ ${k.padEnd(22, ' ')} ${want}`);
  } else {
    fail++;
    console.log(`  ✗ ${k.padEnd(22, ' ')} got ${got}, expected ${want}`);
  }
}
console.log(fail === 0 ? '\n  전 항목 일치' : `\n  ${fail}개 불일치`);
process.exit(fail === 0 ? 0 : 1);
