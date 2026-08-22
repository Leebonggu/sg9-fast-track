/**
 * 역방향 동기화 — 종이 동의 세대를 전자업체 벌크등록용 xlsx로 변환.
 *
 * 실행: npm run econsent-writeback -- <업체파일.xlsx> [출력.xlsx] [--mode=sinto|plan]
 *      (= npx tsx --env-file=.env.local scripts/make-econsent-writeback.mts ...)
 *
 * 모드 (파일 헤더로 자동 감지 — `선택 항목` 컬럼은 정비계획입안 파일에만 있다):
 *  - sinto: 신속통합기획. 대상 = 종이 신통동의(consent=TRUE) + 신분증 제출.
 *  - plan:  정비계획입안.  대상 = 종이 입안동의(planConsent=TRUE) + 신분증 제출.
 *    입안 파일의 `선택 항목`(추진위/직접조합)은 벌크로 입력 불가 — 서면동의 행은 '-'로
 *    남는다 (2026-08-22 실측: 업체가 8/3 수동 등록한 908-107도 '-' + 자동완비).
 * 신분증 제출 = 업로드>0 또는 종이수령. (사용자 확정 기준: 신분증까지 제출된 대상만 입력)
 * 동작: 업체에서 내려받은 파일의 사본을 만들어 대상 소유자 행의 `제출상태`만
 *       '서면동의(직접)'으로 바꾼다. 다른 셀·열 구성(recipientSeq 등 숨김 컬럼 포함)은
 *       건드리지 않는다 — 업체 벌크등록은 내려받은 파일 그대로의 열 구성을 요구한다.
 *
 * 누구를 표기하나 (업체 명부는 소유자 단위, 우리 동의는 세대 단위라 사람을 골라야 한다):
 *  - 단독 소유: 그 행. 단, 동의서 이름이 등기 소유자와 실질 불일치면 보류(소유권 이전/대필 의심).
 *  - 공유: 동의서에 서명한 이름(consentName) 또는 신분증을 낸 이름과 일치하는 행만.
 *    동명이인 접미사(윤지영A)는 떼고 비교. 매칭 0이면 보류.
 *  - 업체에 이미 제출 기록(전자동의/서면동의)이 있는 행은 건드리지 않는다
 *    (업체 비교 단계에서도 '적용 불가'로 걸러지지만 애초에 diff를 만들지 않는다).
 *
 * 보류·표기 명단은 docs/raw/에 md로 저장한다 (gitignore — 개인정보라 커밋 금지).
 * 라이브 시트에는 아무것도 쓰지 않는다. 제출일시는 업체 등록 화면에서 입력한다.
 */
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { getMasterRows } from '../src/lib/owner-sheets';
import { getAllIdUploads } from '../src/lib/id-upload';

const [vendorPath, outArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// --include=916-1506,902-101 : 이름 불일치로 보류된 단독 세대를 사람이 판단한 뒤 강제 포함.
// 포함하더라도 명단 리포트에 '이름 확인 필요'로 남는다. 공유 세대는 어느 행인지 특정할 수
// 없어 지원하지 않는다(수동 처리).
const includeArg = process.argv.find((a) => a.startsWith('--include='));
const forceInclude = new Set(
  (includeArg?.slice('--include='.length) ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);
// --exclude=905-1008,910-605 : 대상 조건을 만족해도 사람이 빼기로 결정한 세대.
const excludeArg = process.argv.find((a) => a.startsWith('--exclude='));
const forceExclude = new Set(
  (excludeArg?.slice('--exclude='.length) ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);
const modeArg = process.argv.find((a) => a.startsWith('--mode='))?.slice('--mode='.length);
if (!vendorPath) {
  console.error('사용법: npm run econsent-writeback -- <업체파일.xlsx> [출력.xlsx] [--mode=sinto|plan] [--include=동-호,…] [--exclude=동-호,…]');
  process.exit(1);
}
const outPath =
  outArg ?? vendorPath.replace(/\.xlsx$/, '') + '_서면동의반영.xlsx';

const WRITTEN = '서면동의(직접)';
const CHANGEABLE = new Set(['미제출', '철회']); // 업체 룰: 이 상태만 서면동의로 변경 가능

const strip = (s: string) => s.replace(/[A-Z]+$/, '').trim();
const nameSet = (raw: string) =>
  new Set(raw.split(/[,ㆍ·/、]\s*/).map((s) => s.trim()).filter(Boolean));

// ── 1. 업체 파일 읽기 + 모드 감지 ────────────────────────────────────────
const wb = XLSX.read(fs.readFileSync(vendorPath), { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const vrows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false, defval: '' });

// 헤더 행에서 제출상태 컬럼 위치 탐색 + 모드 감지 (선택 항목 컬럼 = 입안 파일)
const range = XLSX.utils.decode_range(ws['!ref']!);
let statusCol = -1;
let hasSelectCol = false;
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
  const h = cell ? String(cell.v).trim() : '';
  if (h === '제출상태') statusCol = c;
  if (h === '선택 항목') hasSelectCol = true;
}
if (statusCol < 0) throw new Error('업체 파일에서 제출상태 컬럼을 찾지 못했습니다.');
const mode = modeArg ?? (hasSelectCol ? 'plan' : 'sinto');
if (mode !== 'sinto' && mode !== 'plan') throw new Error(`--mode는 sinto|plan: ${mode}`);
if ((mode === 'plan') !== hasSelectCol) {
  throw new Error(
    `모드(${mode})와 파일이 안 맞습니다 — '선택 항목' 컬럼 ${hasSelectCol ? '있음(입안 파일)' : '없음(신통 파일)'}. 파일을 확인하세요.`,
  );
}
console.log(`모드: ${mode === 'plan' ? '정비계획입안' : '신속통합기획'} (헤더 자동 감지)`);

// ── 2. 우리 쪽 대상 세대 ──────────────────────────────────────────────────
const [{ rows }, uploads] = await Promise.all([getMasterRows(), getAllIdUploads()]);
const uploadNames = new Map<string, Set<string>>();
for (const u of uploads) {
  const k = `${u.dong}-${u.ho}`;
  if (!uploadNames.has(k)) uploadNames.set(k, new Set());
  if (u.ownerName) uploadNames.get(k)!.add(u.ownerName.trim());
}
const targets = rows.filter((r) => {
  const k = `${r.dong}-${r.ho}`;
  if (forceExclude.has(k)) return false;
  const consented = mode === 'plan' ? r.planConsent : r.consent;
  return consented && (r.idReceived || uploadNames.has(k));
});

interface VRow { name: string; status: string; excelRow: number }
const vendorByKey = new Map<string, VRow[]>();
vrows.forEach((v, i) => {
  const dong = String(v['동'] || '').replace(/\D/g, '');
  const ho = String(v['호수'] || '').replace(/\D/g, '');
  if (!dong || !ho || String(v['건물명'] || '').includes('상가')) return;
  const k = `${dong}-${ho}`;
  if (!vendorByKey.has(k)) vendorByKey.set(k, []);
  vendorByKey.get(k)!.push({
    name: String(v['이름'] || '').trim(),
    status: String(v['제출상태'] || ''),
    excelRow: range.s.r + 1 + i, // 헤더 다음 행부터
  });
});

// ── 3. 매칭 → 표기 대상 행 산출 ──────────────────────────────────────────
const marks: { key: string; name: string; excelRow: number }[] = [];
const review: string[] = [];
const nameCheck: string[] = []; // --include로 강제 포함 — 표기는 하되 이름 확인 필요
let alreadyDone = 0;

for (const t of targets) {
  const k = `${t.dong}-${t.ho}`;
  const vlist = vendorByKey.get(k);
  if (!vlist || vlist.length === 0) { review.push(`${k}: 업체 명부에 없음`); continue; }

  const pending = vlist.filter((v) => CHANGEABLE.has(v.status) && v.name);
  if (pending.length === 0) {
    if (vlist.some((v) => v.status && !CHANGEABLE.has(v.status))) alreadyDone++;
    else review.push(`${k}: 변경 가능한 행 없음(무명뿐)`);
    continue;
  }

  const consentNames = new Set([...nameSet(t.consentName || '')].map(strip));
  const upNames = new Set([...(uploadNames.get(k) ?? [])].map(strip));
  const ownerNames = new Set([...nameSet(t.ownerName || '')].map(strip));

  let marked: VRow[] = [];
  if (vlist.filter((v) => v.name).length === 1) {
    const v = pending[0];
    const vn = strip(v.name);
    // 동의서 이름이 있는데 등기 소유자와도, 명부 이름과도 안 맞으면 보류
    const consentMismatch =
      t.consentName && ![...consentNames].some((n) => ownerNames.has(n) || n === vn);
    if (consentMismatch && !forceInclude.has(k)) {
      review.push(`${k}: 단독 이름 불일치 (명부 ${v.name} / 동의서 ${t.consentName}) — 확인 후 수동 처리 (포함하려면 --include=${k})`);
    } else {
      marked = [v];
      if (consentMismatch) {
        nameCheck.push(`${k} ${v.name}: 동의서 이름 '${t.consentName}'과 불일치 — 동의서 원본과 등기 대조 필요`);
      }
    }
  } else {
    marked = pending.filter((v) => {
      const vn = strip(v.name);
      return consentNames.has(vn) || upNames.has(vn);
    });
    if (marked.length === 0) {
      review.push(
        `${k}: 공유 ${vlist.length}인 중 매칭 행 없음 (동의서 ${t.consentName || '-'} / 신분증 ${[...upNames].join(',') || '-'}) — 확인 후 수동 처리`,
      );
    }
  }
  for (const m of marked) marks.push({ key: k, name: m.name, excelRow: m.excelRow });
}

// ── 4. 사본에 표기 후 저장 ───────────────────────────────────────────────
for (const m of marks) {
  const addr = XLSX.utils.encode_cell({ r: m.excelRow, c: statusCol });
  const cell = ws[addr];
  const before = cell ? String(cell.v) : '';
  if (!CHANGEABLE.has(before)) {
    throw new Error(`${m.key} ${m.name} (${addr}): 제출상태가 '${before}' — 행 정렬이 어긋났습니다. 파일을 다시 내려받으세요.`);
  }
  ws[addr] = { t: 's', v: WRITTEN };
}
XLSX.writeFile(wb, outPath);

// ── 5. 명단 리포트 (docs/raw — gitignore) ────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const modeLabel = mode === 'plan' ? '정비계획입안' : '신통';
const reportPath = path.resolve(
  import.meta.dirname,
  `../../docs/raw/${today}_서면동의_역동기화_명단${mode === 'plan' ? '_입안' : ''}.md`,
);
const households = new Set(marks.map((m) => m.key));
const lines = [
  `# 서면동의(직접) 역동기화 명단 (${modeLabel}) — ${today}`,
  '',
  `- 원본: ${path.basename(vendorPath)}`,
  `- 출력: ${path.basename(outPath)} (제출상태 ${marks.length}행 변경)`,
  `- 대상 세대(종이 ${modeLabel}동의+신분증): ${targets.length} / 표기 ${households.size}세대 ${marks.length}행 / 업체에 이미 제출 ${alreadyDone}세대 / 보류 ${review.length}건`,
  ...(forceExclude.size ? [`- 사람이 제외 결정한 세대(--exclude): ${[...forceExclude].join(', ')}`] : []),
  '- 업로드 후 업체 등록 화면에서 제출일시 입력 필요. 이 명단은 개인정보 — 커밋 금지.',
  ...(mode === 'plan'
    ? ["- 입안 `선택 항목`(추진위/직접조합)은 벌크 입력 불가 — 서면동의 행은 '-'로 남음 (업체 8/3 수동 등록 선례 동일)"]
    : []),
  '',
  '## 표기한 행',
  ...marks.map((m) => `- ${m.key} ${m.name} (엑셀 ${m.excelRow + 1}행)`),
  '',
  '## ⚠ 표기했으나 이름 확인 필요 (--include 강제 포함)',
  ...(nameCheck.length ? nameCheck.map((r) => `- ${r}`) : ['- 없음']),
  '',
  '## 보류 (자동 표기 제외 — 수동 확인)',
  ...(review.length ? review.map((r) => `- ${r}`) : ['- 없음']),
  '',
];
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'));

console.log(`출력: ${outPath}`);
console.log(`제출상태 변경 ${marks.length}행 / ${households.size}세대 (이미 제출 ${alreadyDone}세대 제외, 보류 ${review.length}건)`);
console.log(`명단: ${reportPath}`);
nameCheck.forEach((r) => console.log('  ⚠ 이름확인 -', r));
review.forEach((r) => console.log('  보류 -', r));
