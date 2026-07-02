/**
 * 회귀 테스트 — 후원금 동/호수 파서
 *
 * 2026-07-02 실제 은행 거래내역 2개 파일(공지.xls, 국민은행자료다운.xls)에서
 * 나온 텍스트 패턴을 그대로 고정. 새 패턴이 나오면 케이스를 추가한다.
 *
 * 실행: npm test (또는 tsx tests/donation-parser.test.ts)
 */
import { extractDongHo, parseTransactionRow } from '../src/lib/donation-parser';

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
console.log(' 회귀 테스트: 후원금 동/호수 파서');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n[1] extractDongHo — 정상 형식');
assertEqual('슬래시', extractDongHo('917/808'), { dong: '917', ho: '808' });
assertEqual('호 접미사', extractDongHo('922/903호'), { dong: '922', ho: '903' });
assertEqual('숫자만(7자리)', extractDongHo('9081007'), { dong: '908', ho: '1007' });
assertEqual('@ 접두사 + 동/호', extractDongHo('@914동406호'), { dong: '914', ho: '406' });
assertEqual('동/호수(중간 슬래시)', extractDongHo('916-1308'), { dong: '916', ho: '1308' });

console.log('\n[2] extractDongHo — 무효 케이스');
assertEqual('동 범위 밖(999)', extractDongHo('999/101'), null);
assertEqual('자릿수 부족(3자리만)', extractDongHo('905'), null);
assertEqual('빈 문자열', extractDongHo(''), null);

console.log('\n[3] parseTransactionRow — 보낸분/받는분 필드에서 성공');
assertEqual('동+호', parseTransactionRow('917동610호', ''), { dong: '917', ho: '610', source: 'sender' });
assertEqual('대시', parseTransactionRow('916-901', ''), { dong: '916', ho: '901', source: 'sender' });
assertEqual('전각공백', parseTransactionRow('915동　503호', ''), { dong: '915', ho: '503', source: 'sender' });
assertEqual('이름 접두사', parseTransactionRow('윤미경903-203', ''), { dong: '903', ho: '203', source: 'sender' });
assertEqual('이중 언더스코어', parseTransactionRow('915__306', ''), { dong: '915', ho: '306', source: 'sender' });

console.log('\n[4] parseTransactionRow — 은행 표시글자수 제한으로 sender가 잘린 경우 (memo 우선)');
assertEqual('절단1', parseTransactionRow('이춘자　910-50', '910/505'), { dong: '910', ho: '505', source: 'memo' });
assertEqual('절단2(sender=이름만)', parseTransactionRow('이광숙', '918/1407'), { dong: '918', ho: '1407', source: 'memo' });
assertEqual('절단3', parseTransactionRow('박현주　908동14', '908-1408'), { dong: '908', ho: '1408', source: 'memo' });
assertEqual('절단4', parseTransactionRow('정재천(905동40', '905/401'), { dong: '905', ho: '401', source: 'memo' });
assertEqual('절단5', parseTransactionRow('안은정/918동80', '918/806'), { dong: '918', ho: '806', source: 'memo' });
assertEqual('sender 완전한데 틀림, memo가 정정', parseTransactionRow('909동1207호', '919/1207'), { dong: '919', ho: '1207', source: 'memo' });

console.log('\n[5] parseTransactionRow — 파싱 실패');
assertEqual('이름만, memo 없음(1)', parseTransactionRow('손승현', ''), { dong: '', ho: '', source: 'fail' });
assertEqual('이름만, memo 없음(2)', parseTransactionRow('김지원', ''), { dong: '', ho: '', source: 'fail' });

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
