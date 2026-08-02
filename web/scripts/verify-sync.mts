/**
 * sync 결과 검증 (읽기 전용) — 통합현황을 직접 읽어 실제 반영 상태를 센다.
 *
 * 실행: npm run verify-sync
 */
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from '../src/lib/google-auth';
import { SURVEY_PHONE_MARK } from '../src/lib/survey-phone-note';

const s = (v: unknown) => String(v ?? '').trim();

const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, getServiceAccountAuth());
await doc.loadInfo();
const rows = await doc.sheetsByTitle['통합현황'].getRows();

let total = 0, withPhone = 0, brokenZero = 0, hyphenated = 0;
let memoTotal = 0, memoWithMark = 0, memoMarkTwice = 0;
const markSamples: string[] = [];
const brokenRows: string[] = [];

for (const r of rows) {
  const dong = s(r.get('동'));
  const ho = s(r.get('호수'));
  if (!dong || !ho) continue;
  total++;

  const phone = s(r.get('연락처'));
  const override = s(r.get('연락처_수정'));
  if (phone) {
    withPhone++;
    if (phone.includes('-')) hyphenated++;
    for (const chunk of phone.split('/')) {
      const d = chunk.replace(/[^0-9]/g, '');
      if (d.length === 10 && d.startsWith('1')) {
        brokenZero++;
        // 정규화를 안 태우는 경로가 어디인지 보려면 연락처_수정 여부가 핵심이다
        brokenRows.push(`${dong}-${ho} 연락처=${JSON.stringify(phone)} 수정=${JSON.stringify(override)}`);
      }
    }
  }

  const memo = s(r.get('메모'));
  if (memo) memoTotal++;
  const marks = memo.split(SURVEY_PHONE_MARK).length - 1;
  if (marks > 0) {
    memoWithMark++;
    if (markSamples.length < 3) markSamples.push(`${dong}-${ho}: ${JSON.stringify(memo)}`);
  }
  if (marks > 1) memoMarkTwice++;
}

console.log(`\n통합현황 행 수                : ${total}`);
console.log(`연락처 있는 세대              : ${withPhone}`);
console.log(`  └ 하이픈 형식(정규화됨)     : ${hyphenated}`);
console.log(`  └ 선행0 유실 잔여           : ${brokenZero}`);
console.log(`\n메모 있는 세대                : ${memoTotal}`);
console.log(`  └ [설문연락처] 줄 포함      : ${memoWithMark}`);
console.log(`  └ 마커가 2번 이상(누적 버그) : ${memoMarkTwice}   (0이어야 정상)`);
console.log('\n[선행0 유실이 남은 행 — 어느 경로로 들어왔는지]');
brokenRows.forEach((x) => console.log('  ' + x));
console.log('\n[메모 샘플]');
markSamples.forEach((x) => console.log('  ' + x));
