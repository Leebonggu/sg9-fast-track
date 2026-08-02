/**
 * 설문 연락처 보강 — 드라이런 + 이름 불일치 목록 추출 (읽기 전용, 시트에 절대 쓰지 않는다)
 *
 * 실행: npm run phone-gap
 *      (= npx tsx --env-file=.env.local scripts/check-survey-phone-gap.mts)
 *
 * 배경: getPhoneMap()은 v2 동별 시트(신속통합동의서)만 읽는다. 설문만 내고 동의서는 안 낸
 *       세대는 통합현황 연락처가 구조적으로 빈다. syncMasterSheet가 설문 연락처를 fallback으로
 *       쓰도록 고쳤고, 이 스크립트는 그 결과를 시트에 쓰기 전에 미리 보여준다.
 *
 * 판정: 설문 응답자는 배우자·가족·세입자일 수 있으므로 isOwnerName(sync와 동일 함수)으로
 *       소유자 명단에 있는 이름만 채운다. 나머지는 목록으로 뽑아 위원이 직접 확인한다.
 *
 * 출력: docs/raw/YYYY-MM-DD_설문연락처-이름불일치.md  (docs/raw/는 .gitignore — PII라 커밋 금지)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOwners, getMasterPreservation } from '../src/lib/owner-sheets';
import { withSurveyPhoneNote, stripSurveyPhoneNote } from '../src/lib/survey-phone-note';
import { getPhoneMap } from '../src/lib/sheets';
import { getMergedSurveyPhoneMap } from '../src/lib/survey-sheets';
import { getAllSurveyConfigs } from '../src/lib/surveys/registry';
import { isOwnerName } from '../src/lib/unified-sync';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function main() {
  const [owners, phoneMap, preserved, surveyPhoneMap] = await Promise.all([
    getOwners(),
    getPhoneMap(),
    getMasterPreservation(),
    getMergedSurveyPhoneMap(getAllSurveyConfigs()),
  ]);
  const { memo: memoMap, phoneOverride: phoneOverrideMap } = preserved;

  let hadPhone = 0;
  const willFill: { key: string; owner: string; contacts: string }[] = [];
  const mismatch: { key: string; owner: string; contacts: string }[] = [];

  for (const owner of owners) {
    const key = `${owner.dong}-${owner.ho}`;
    const existing = phoneOverrideMap.get(key) || phoneMap.get(key) || '';
    if (existing) { hadPhone++; continue; }

    const contacts = surveyPhoneMap.get(key) ?? [];
    if (contacts.length === 0) continue;

    const matched = contacts.filter((c) => isOwnerName(owner.ownerName, c.name));
    const line = contacts.map((c) => `${c.name} ${c.phone}`).join(' / ');
    if (matched.length > 0) {
      willFill.push({ key, owner: owner.ownerName, contacts: matched.map((c) => `${c.name} ${c.phone}`).join(' / ') });
    } else {
      mismatch.push({ key, owner: owner.ownerName, contacts: line });
    }
  }

  // 기존 v2 연락처도 시트가 숫자로 저장한 탓에 선행 0이 빠진 게 섞여 있다 (별도 과제)
  let v2Total = 0;
  let v2Broken = 0;
  for (const v of phoneMap.values()) {
    for (const chunk of v.split('/')) {
      const d = chunk.replace(/[^0-9]/g, '');
      if (!d) continue;
      v2Total++;
      if (d.length === 10 && d.startsWith('1')) v2Broken++;
    }
  }

  console.log(`\n전체 세대                     : ${owners.length}`);
  console.log(`이미 연락처 있음              : ${hadPhone}`);
  console.log(`설문에서 채워짐 (이름 일치)   : ${willFill.length}   ← sync 시 반영될 건수`);
  console.log(`이름 불일치 → 채우지 않음     : ${mismatch.length}   ← 별도 목록`);
  // normalizePhone을 getPhoneMap에 태운 뒤로는 0이어야 정상 (0이 아니면 복원 규칙에 구멍이 있다는 뜻)
  console.log(`\n[검증] v2 연락처 ${v2Total}건 중 선행0 유실 잔여: ${v2Broken}건 (0이어야 정상)`);

  // toISOString()은 UTC라 KST 새벽에 날짜가 하루 밀린다 → 로컬 날짜로 뽑는다
  const today = new Date().toLocaleDateString('sv-SE');
  const outDir = resolve(REPO_ROOT, 'docs/raw');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${today}_설문연락처-이름불일치.md`);

  const md = [
    `# 설문 연락처 — 소유자명 불일치 목록 (${today})`,
    '',
    '설문에 연락처는 있으나 **응답자명이 원본 소유자 명단에 없어** 통합현황에 자동 반영하지 않은 세대다.',
    '배우자·가족일 수도, 세입자일 수도 있어 위원이 직접 확인해야 한다.',
    '',
    `- 자동 반영된 세대(이름 일치): ${willFill.length}건`,
    `- 아래 확인 필요 목록: ${mismatch.length}건`,
    '',
    '| 동-호 | 원본 소유자 | 설문 응답자 · 연락처 |',
    '|---|---|---|',
    ...mismatch
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
      .map((m) => `| ${m.key} | ${m.owner} | ${m.contacts} |`),
    '',
  ].join('\n');
  writeFileSync(outPath, md, 'utf8');
  console.log(`\n불일치 목록 저장: ${outPath}`);

  // 안전 검증 — 기존 메모가 한 글자라도 사라지는 세대가 있는지 전 세대 대조.
  // 자동 줄을 걷어낸 결과가 원본 메모(trim)와 정확히 같아야 한다.
  let memoTotal = 0;
  let memoLost = 0;
  const lostSamples: string[] = [];
  for (const owner of owners) {
    const key = `${owner.dong}-${owner.ho}`;
    const oldMemo = memoMap.get(key) || '';
    if (oldMemo) memoTotal++;
    const existing = phoneOverrideMap.get(key) || phoneMap.get(key) || '';
    const contacts = surveyPhoneMap.get(key) ?? [];
    const matched = contacts.filter((c) => isOwnerName(owner.ownerName, c.name));
    const phone = existing || matched.map((c) => `${c.name} ${c.phone}`).join(' / ');
    const unmatched = phone ? [] : contacts.filter((c) => !isOwnerName(owner.ownerName, c.name));
    const newMemo = withSurveyPhoneNote(oldMemo, unmatched);
    if (stripSurveyPhoneNote(newMemo) !== oldMemo.trim()) {
      memoLost++;
      if (lostSamples.length < 5) lostSamples.push(`${key}: ${JSON.stringify(oldMemo)} → ${JSON.stringify(newMemo)}`);
    }
  }
  console.log(`\n[메모 안전 검증] 기존 메모 ${memoTotal}건 / 내용이 유실되는 세대: ${memoLost}건`);
  for (const l of lostSamples) console.log(`  ${l}`);

  console.log('\n[연락처가 채워질 세대 — 앞 10건 미리보기]');
  for (const w of willFill.slice(0, 10)) console.log(`  ${w.key.padEnd(9)} ${w.owner.padEnd(10)} ${w.contacts}`);

  console.log('\n[메모가 붙을 세대 — 앞 10건 미리보기]');
  for (const m of mismatch.slice(0, 10)) {
    const memo = withSurveyPhoneNote(memoMap.get(m.key) || '', surveyPhoneMap.get(m.key) ?? []);
    console.log(`  ${m.key.padEnd(9)} ${m.owner.padEnd(10)} ${JSON.stringify(memo)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
