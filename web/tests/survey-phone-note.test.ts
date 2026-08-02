/**
 * 회귀 테스트 — 설문 연락처 불일치 메모 (순수 함수)
 * 실행: npm test (또는 tsx tests/survey-phone-note.test.ts)
 *
 * 핵심: 메모는 통합현황을 왕복한다(sync가 읽어서 다시 쓴다). 자동 줄을 걷어내지 않고
 *       덧붙이기만 하면 sync마다 같은 줄이 쌓이고, 조건이 해소돼도 영원히 남는다.
 */
import { withSurveyPhoneNote, stripSurveyPhoneNote } from '../src/lib/survey-phone-note';

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

const 유혜연 = [{ name: '유혜연', phone: '010-2630-2685' }];
const 둘 = [
  { name: '유혜연', phone: '010-2630-2685' },
  { name: '홍인비', phone: '010-8637-2025' },
];
const NOTE = '[설문연락처] 유혜연 010-2630-2685 (소유자명 불일치 — 확인 필요)';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: 설문 연락처 불일치 메모');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assertEqual('빈 메모에 자동 줄 추가', withSurveyPhoneNote('', 유혜연), NOTE);

assertEqual(
  '위원 메모는 위에 그대로 보존',
  withSurveyPhoneNote('전화 안 받음', 유혜연),
  `전화 안 받음\n${NOTE}`,
);

assertEqual(
  '여러 명이면 한 줄에 나열',
  withSurveyPhoneNote('', 둘),
  '[설문연락처] 유혜연 010-2630-2685 / 홍인비 010-8637-2025 (소유자명 불일치 — 확인 필요)',
);

// sync가 반복 실행돼도 줄이 쌓이면 안 된다
assertEqual(
  '재실행해도 중복 누적 없음',
  withSurveyPhoneNote(withSurveyPhoneNote(withSurveyPhoneNote('전화 안 받음', 유혜연), 유혜연), 유혜연),
  `전화 안 받음\n${NOTE}`,
);

// 조건이 해소되면(연락처가 채워지면) 자동 줄은 사라져야 한다
assertEqual(
  '불일치 해소 시 자동 줄 제거',
  withSurveyPhoneNote(`전화 안 받음\n${NOTE}`, []),
  '전화 안 받음',
);

assertEqual(
  '불일치 해소 + 위원 메모도 없으면 빈 문자열',
  withSurveyPhoneNote(NOTE, []),
  '',
);

// 응답자가 바뀌면 옛 줄이 남지 않고 갱신돼야 한다
assertEqual(
  '내용 갱신 시 옛 줄 제거',
  withSurveyPhoneNote(`메모\n${NOTE}`, [{ name: '김종숙', phone: '010-3397-5135' }]),
  '메모\n[설문연락처] 김종숙 010-3397-5135 (소유자명 불일치 — 확인 필요)',
);

assertEqual('빈 메모 + 불일치 없음', withSurveyPhoneNote('', []), '');

assertEqual(
  '위원이 여러 줄로 쓴 메모 보존',
  withSurveyPhoneNote('1차 방문 부재\n2차 방문 예정', 유혜연),
  `1차 방문 부재\n2차 방문 예정\n${NOTE}`,
);

// 위원 메모가 마침 대괄호로 시작해도 오인해서 지우면 안 된다
assertEqual(
  '다른 대괄호 메모는 지우지 않음',
  withSurveyPhoneNote('[중요] 재방문 필요', 유혜연),
  `[중요] 재방문 필요\n${NOTE}`,
);

assertEqual('strip — 자동 줄만 제거', stripSurveyPhoneNote(`메모\n${NOTE}`), '메모');
assertEqual('strip — 자동 줄 없으면 그대로', stripSurveyPhoneNote('메모'), '메모');

// 단일행 입력 UI를 거치면 \n이 사라져 앞 메모에 들러붙는다. 그 상태에서도 복구돼야 한다.
const 뭉개진 = `종이:안명숙${NOTE}`;
assertEqual(
  '줄바꿈 유실로 들러붙은 자동 줄 제거',
  stripSurveyPhoneNote(뭉개진),
  '종이:안명숙',
);
assertEqual(
  '뭉개진 메모에서도 중복 누적 없이 재생성',
  withSurveyPhoneNote(뭉개진, 유혜연),
  `종이:안명숙\n${NOTE}`,
);
assertEqual(
  '뭉개진 메모 + 불일치 해소 시 위원 메모만 남음',
  withSurveyPhoneNote(뭉개진, []),
  '종이:안명숙',
);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
