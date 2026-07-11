/**
 * 회귀 테스트 — 신분증 정정 허용 윈도우 판정 (순수 함수)
 * 실행: npm test (또는 tsx tests/id-upload-correction-window.test.ts)
 */
import { isCorrectionWindowOpen, CORRECTION_WINDOW_MS } from '../src/lib/id-upload';

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
console.log(' 회귀 테스트: 정정 허용 윈도우 판정');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const NOW = new Date('2026-07-12T10:00:00Z').getTime();

assertEqual('빈 문자열 → 닫힘', isCorrectionWindowOpen('', NOW), false);
assertEqual('공백만 → 닫힘', isCorrectionWindowOpen('   ', NOW), false);
assertEqual('잘못된 날짜 → 닫힘', isCorrectionWindowOpen('not-a-date', NOW), false);
assertEqual(
  '1시간 전 허용 → 열림(2시간 이내)',
  isCorrectionWindowOpen(new Date(NOW - 60 * 60 * 1000).toISOString(), NOW),
  true,
);
assertEqual(
  '정확히 2시간 전 → 열림(경계 포함)',
  isCorrectionWindowOpen(new Date(NOW - CORRECTION_WINDOW_MS).toISOString(), NOW),
  true,
);
assertEqual(
  '2시간 1분 전 → 닫힘(만료)',
  isCorrectionWindowOpen(new Date(NOW - CORRECTION_WINDOW_MS - 60 * 1000).toISOString(), NOW),
  false,
);
assertEqual(
  '미래 시각 → 열림(시계 오차 허용)',
  isCorrectionWindowOpen(new Date(NOW + 60 * 1000).toISOString(), NOW),
  true,
);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
