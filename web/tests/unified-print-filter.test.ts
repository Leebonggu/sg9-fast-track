/**
 * 회귀 테스트 — 정비입안 3종 수거 대상 필터 (plan-docs-pending)
 * 실행: npm test (또는 tsx tests/unified-print-filter.test.ts)
 *
 * 계약: 신통을 동의한 세대 중 정비입안 동의서·개인정보 동의·신분증 가운데
 * 하나라도 미완료인 세대만 잡는다. 세 항목 모두 종이·전자 합산 기준이라,
 * 전자동의로 자동 인정되는 세대는 자연히 빠져야 한다.
 */
import { applyFilter } from '../src/lib/unified-utils';
import type { UnifiedRow } from '../src/lib/unified-types';

let pass = 0;
let fail = 0;

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}: got ${a}, expected ${e}`); }
}

function row(p: Partial<UnifiedRow> & { ho: string }): UnifiedRow {
  return {
    dong: '901', ownerName: '홍길동', postalCode: '', address: '', residency: '',
    consent: false, surveys: {}, memo: '', lastSynced: '', ...p,
  };
}

// 필터를 통과하는지(= 수거 대상인지)만 본다
const hit = (r: UnifiedRow) => applyFilter([r], 'plan-docs-pending', []).length === 1;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: 정비입안 3종 수거 대상 필터');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('[1] 모수 — 신통 동의자만');
assertEqual('신통 미동의 세대는 제외', hit(row({ ho: '101' })), false);
assertEqual(
  '신통 미동의면 3종이 비어 있어도 제외',
  hit(row({ ho: '102', planConsent: false, privacyConsent: false })),
  false,
);

console.log('\n[2] 종이로 신통만 낸 세대');
assertEqual('3종 다 미완료 → 대상', hit(row({ ho: '201', consent: true })), true);

console.log('\n[3] 3종 중 하나만 빠져도 대상');
const twoOfThree = { consent: true, privacyConsent: true, idReceived: true };
assertEqual('정비입안만 미완료', hit(row({ ho: '301', ...twoOfThree })), true);
assertEqual(
  '개인정보만 미완료',
  hit(row({ ho: '302', consent: true, planConsent: true, idReceived: true })),
  true,
);
assertEqual(
  '신분증만 미완료',
  hit(row({ ho: '303', consent: true, planConsent: true, privacyConsent: true })),
  true,
);

console.log('\n[4] 3종 모두 완료면 제외');
assertEqual(
  '종이로 3종 완료',
  hit(row({ ho: '401', consent: true, planConsent: true, privacyConsent: true, idReceived: true })),
  false,
);

console.log('\n[5] 전자동의 — 개인정보·신분증 자동 인정');
assertEqual(
  '신통·정비입안 둘 다 전자 완료 → 제외',
  hit(row({ ho: '501', econsentSinto: '완전', econsentPlan: '완전' })),
  false,
);
assertEqual(
  '신통만 전자, 정비입안 미제출 → 대상',
  hit(row({ ho: '502', econsentSinto: '완전' })),
  true,
);
assertEqual(
  '신통 전자 + 정비입안은 종이로 수령 → 제외',
  hit(row({ ho: '503', econsentSinto: '완전', planConsent: true })),
  false,
);

console.log('\n[6] 일부 서명은 동의로 치지 않는다');
assertEqual(
  '신통이 "일부"뿐이면 모수에 안 들어감',
  hit(row({ ho: '601', econsentSinto: '일부' })),
  false,
);
assertEqual(
  '정비입안이 "일부"면 미완료 → 대상',
  hit(row({ ho: '602', consent: true, econsentPlan: '일부', privacyConsent: true, idReceived: true })),
  true,
);

console.log('\n[7] 신분증은 온라인 업로드로도 충족');
assertEqual(
  'idUploaded > 0이면 신분증 완료',
  hit(row({ ho: '701', consent: true, planConsent: true, privacyConsent: true, idUploaded: 2 })),
  false,
);
assertEqual(
  'idUploaded 0이면 미완료 → 대상',
  hit(row({ ho: '702', consent: true, planConsent: true, privacyConsent: true, idUploaded: 0 })),
  true,
);

console.log(`\n 결과: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
