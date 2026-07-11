/**
 * 회귀 테스트 — 전화번호 형식 검증 (순수 함수)
 * 실행: npm test (또는 tsx tests/phone-format.test.ts)
 */
import { isValidPhone } from '../src/lib/phone-format';

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
console.log(' 회귀 테스트: 전화번호 형식 검증');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assertEqual('하이픈 포함 정상', isValidPhone('010-1234-5678'), true);
assertEqual('하이픈 없이 정상', isValidPhone('01012345678'), true);
assertEqual('지역번호(9자리)', isValidPhone('021234567'), true);
assertEqual('공백만', isValidPhone('   '), false);
assertEqual('빈 문자열', isValidPhone(''), false);
assertEqual('너무 짧음(8자리)', isValidPhone('1234567'), false);
assertEqual('너무 김(12자리)', isValidPhone('012345678901'), false);
assertEqual('문자 섞임', isValidPhone('010-abcd-5678'), false);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
