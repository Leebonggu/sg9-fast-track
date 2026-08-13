/**
 * 회귀 테스트 — 전화번호 형식 검증 (순수 함수)
 * 실행: npm test (또는 tsx tests/phone-format.test.ts)
 */
import { isValidPhone, normalizePhone, splitContacts } from '../src/lib/phone-format';

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
console.log(' 회귀 테스트: 선행 0 유실 복원 (연락처는 전부 휴대폰 번호)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 실제 설문시트에서 관측된 케이스 (902-108)
assertEqual('10자리 선행0 유실 복원', normalizePhone('1026302685'), '010-2630-2685');
assertEqual('11자리 하이픈 없음', normalizePhone('01012345678'), '010-1234-5678');
assertEqual('이미 정상 형식은 그대로', normalizePhone('010-1234-5678'), '010-1234-5678');
assertEqual('공백 섞임', normalizePhone(' 010 1234 5678 '), '010-1234-5678');
// 011/016 등 구형 번호도 1로 시작하므로 동일하게 복원된다
assertEqual('구형 번호 복원', normalizePhone('1112345678'), '011-1234-5678');
// 휴대폰으로 판단되지 않는 형태는 원본 유지 — 잘못 고치느니 그대로 두는 게 낫다
assertEqual('유선번호는 손대지 않음', normalizePhone('0212345678'), '0212345678');
assertEqual('1로 시작 안 하는 10자리는 손대지 않음', normalizePhone('9912345678'), '9912345678');
assertEqual('빈 문자열', normalizePhone(''), '');
assertEqual('공백만', normalizePhone('   '), '');
assertEqual('숫자 없음', normalizePhone('없음'), '없음');
assertEqual('너무 짧음은 원본 유지', normalizePhone('1234'), '1234');


// ─── splitContacts ────────────────────────────────────────────────────────
// 통합현황 `연락처`의 실제 형태를 고정한다 (2026-08-13 라이브 실측 1,208세대 기준).
// 인쇄물에서 이름과 번호를 한 줄에 그렸다가 셀을 넘쳐 글자가 겹친 버그가 있었다.
{
  console.log('\n[splitContacts] 이름 병기 연락처 분리');
  const one = splitContacts('나영선 010-2150-9054'); // 17자 — 전체의 86%
  assertEqual('이름 분리', one.length === 1 && one[0].name, '나영선');
  assertEqual('번호 분리', one[0].number, '010-2150-9054');

  const bare = splitContacts('010-1234-5678');
  assertEqual('순수 번호는 이름 없음', bare[0].name, '');
  assertEqual('순수 번호 유지', bare[0].number, '010-1234-5678');

  // 시트가 번호를 숫자로 저장해 선행 0이 날아간 7건
  const raw = splitContacts('1097084871');
  assertEqual('선행 0 복원 + 하이픈', raw[0].number, '010-9708-4871');

  // 공동소유 3인 병기 (25자)
  const multi = splitContacts('김영자,남정현,남승현 010-9493-0644');
  assertEqual('쉼표 이름 통째 보존', multi[0].name, '김영자,남정현,남승현');
  assertEqual('쉼표 이름의 번호', multi[0].number, '010-9493-0644');

  // 응답자 2명 (37자, 실측 2건)
  const two = splitContacts('김원배 010-9156-5991 / 김회영 010-9038-5226');
  assertEqual('연락처 2건으로 분리', two.length, 2);
  assertEqual('둘째 이름', two[1].name, '김회영');
  assertEqual('둘째 번호', two[1].number, '010-9038-5226');

  assertEqual('빈 문자열은 빈 배열', splitContacts('').length, 0);
  assertEqual('공백만 있어도 빈 배열', splitContacts('   ').length, 0);
}
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
