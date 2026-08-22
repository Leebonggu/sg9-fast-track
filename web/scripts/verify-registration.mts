/**
 * 업체 일괄등록 후 재다운로드 파일 검증 + 공유용 명단 생성.
 *
 * 실행: npm run verify-registration -- <재다운로드.xlsx> <등록전원본.xlsx> [명단.md]
 *
 * 하는 일:
 *  1. 우리가 표기했던 명단(docs/raw의 역동기화 명단 md)의 전원이
 *     '서면동의(직접)' + '자동완비'로 등록됐는지 확인 (하나라도 실패면 exit 1)
 *  2. 등록 전 원본 대비 우리와 무관한 변동(명부 드리프트) 보고
 *     — 업체 명부는 살아있는 문서: 무명 행 재배정, 신규 전자동의가 수시로 생긴다
 *  3. 위원 공유용 동별 명단 텍스트 출력
 *
 * 행 대조는 동-호+이름으로만 한다. recipientSeq는 다운로드 간에 재사용/이동되어
 * 신뢰할 수 없다 (2026-08-22 실측: 무명 행 41개 재배정 시 seq가 다른 사람에게 넘어감).
 * 검증만 하고 아무것도 쓰지 않는다. 마감은 econsent-import(정방향)로 별도 진행.
 */
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const [newPath, origPath, reportArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!newPath || !origPath) {
  console.error('사용법: npm run verify-registration -- <재다운로드.xlsx> <등록전원본.xlsx> [명단.md]');
  process.exit(1);
}

const load = (p: string) => {
  const wb = XLSX.read(fs.readFileSync(p), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { name: wb.SheetNames[0], rows: XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false, defval: '' }) };
};
const nw = load(newPath);
const og = load(origPath);

const isPlan = '선택 항목' in nw.rows[0];
if (('선택 항목' in og.rows[0]) !== isPlan) {
  throw new Error('재다운로드와 원본의 종류(신통/입안)가 다릅니다. 파일을 확인하세요.');
}
const modeLabel = isPlan ? '정비계획입안' : '신속통합기획';
console.log(`종류: ${modeLabel} | 재다운로드 ${nw.rows.length}행 / 원본 ${og.rows.length}행`);
if (nw.name !== og.name) console.log(`⚠ 시트명 다름: '${nw.name}' vs '${og.name}'`);

// ── 명단 md 찾기 (미지정 시 docs/raw에서 모드에 맞는 최신 파일) ─────────────
const rawDir = path.resolve(import.meta.dirname, '../../docs/raw');
let reportPath = reportArg;
if (!reportPath) {
  const cands = fs.readdirSync(rawDir)
    .filter((f) => f.includes('서면동의_역동기화_명단') && f.endsWith('.md'))
    .filter((f) => f.includes('_입안') === isPlan)
    .map((f) => path.join(rawDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!cands.length) throw new Error(`docs/raw에 ${modeLabel} 역동기화 명단 md가 없습니다. 경로를 직접 지정하세요.`);
  reportPath = cands[0];
}
console.log(`명단: ${path.basename(reportPath)}`);
const marked: { dong: string; ho: string; name: string }[] = [];
for (const line of fs.readFileSync(reportPath, 'utf8').split('\n')) {
  const m = line.match(/^- (\d+)-(\d+) (.+?) \(엑셀 /);
  if (m) marked.push({ dong: m[1], ho: m[2], name: m[3].trim() });
}
if (!marked.length) throw new Error('명단 md에서 표기 행을 못 읽었습니다. "## 표기한 행" 형식 확인.');

// ── 1. 우리 명단 전원 등록 확인 ─────────────────────────────────────────────
const key = (v: Record<string, string>) =>
  `${String(v['동']).replace(/\D/g, '')}-${String(v['호수']).replace(/\D/g, '')}|${String(v['이름']).trim()}`;
const nwByKey = new Map(nw.rows.map((r) => [key(r), r]));
let ok = 0;
const fails: string[] = [];
const dates = new Map<string, number>();
for (const m of marked) {
  const row = nwByKey.get(`${m.dong}-${m.ho}|${m.name}`);
  if (!row) { fails.push(`${m.dong}-${m.ho} ${m.name}: 재다운로드에서 못 찾음 (명부 변동 의심)`); continue; }
  if (row['제출상태'] === '서면동의(직접)' && row['완비여부'] === '자동완비') {
    ok++;
    dates.set(String(row['제출일시']), (dates.get(String(row['제출일시'])) ?? 0) + 1);
  } else {
    fails.push(`${m.dong}-${m.ho} ${m.name}: 제출상태='${row['제출상태']}' 완비='${row['완비여부']}'`);
  }
}
console.log(`\n[1] 등록 확인: ${ok}/${marked.length} 서면동의(직접)+자동완비`);
console.log('    제출일시:', [...dates.entries()].map(([d, n]) => `${d}(${n}명)`).join(', '));
fails.forEach((f) => console.log('    ✗', f));

// 전체 집계 참고
const dist = (rows: Record<string, string>[], f: string) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r[f] || '(빈값)', (m.get(r[f] || '(빈값)') ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' / ');
};
console.log(`    제출상태 분포: ${dist(nw.rows, '제출상태')}`);

// ── 2. 명부 드리프트 (우리와 무관한 변동) ───────────────────────────────────
const ogByKey = new Map(og.rows.map((r) => [key(r), r]));
const markedKeys = new Set(marked.map((m) => `${m.dong}-${m.ho}|${m.name}`));
const drift: string[] = [];
let statusDrift = 0;
for (const [k, r] of nwByKey) {
  const o = ogByKey.get(k);
  if (!o) {
    if (String(r['이름']).trim()) drift.push(`새 등장: ${k.replace('|', ' ')} [${r['제출상태'] || '빈'}]`);
    continue;
  }
  if (String(r['제출상태']) !== String(o['제출상태']) && !markedKeys.has(k)) {
    statusDrift++;
    drift.push(`상태 변경: ${k.replace('|', ' ')} '${o['제출상태'] || '빈'}'→'${r['제출상태'] || '빈'}'`);
  }
}
for (const [k, o] of ogByKey) {
  if (!nwByKey.has(k) && String(o['이름']).trim()) drift.push(`사라짐: ${k.replace('|', ' ')} [${o['제출상태'] || '빈'}]`);
}
console.log(`\n[2] 명부 드리프트 (우리 표기 제외): ${drift.length}건 (제출상태 변경 ${statusDrift}건)`);
drift.slice(0, 20).forEach((d) => console.log('    ·', d));
if (drift.length > 20) console.log(`    … 외 ${drift.length - 20}건`);
if (drift.length) console.log('    → 명부가 바뀌었으니 정방향 임포트는 같은 시각에 받은 신통·입안 쌍으로!');

// ── 3. 공유용 명단 ──────────────────────────────────────────────────────────
const strip = (s: string) => s.replace(/[A-Z]+$/, '').trim();
const byHouse = new Map<string, string[]>();
for (const m of marked) {
  const k = `${m.dong}-${m.ho}`;
  if (!byHouse.has(k)) byHouse.set(k, []);
  byHouse.get(k)!.push(strip(m.name));
}
const byDong = new Map<string, { ho: number; names: string[] }[]>();
for (const [k, names] of byHouse) {
  const [dong, ho] = k.split('-');
  if (!byDong.has(dong)) byDong.set(dong, []);
  byDong.get(dong)!.push({ ho: Number(ho), names });
}
const shared = [...byHouse.values()].filter((n) => n.length > 1);
const sharedNote = shared.length
  ? shared.every((n) => n.length === 2)
    ? ` (공유 세대 ${shared.length}곳은 2명씩)`
    : ` (공유 ${shared.length}곳 포함)`
  : '';
const regDate = ([...dates.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '').slice(0, 10);
const docName = isPlan ? '입안 동의서' : '신속통합 동의서';
const share: string[] = [
  `📋 ${modeLabel} 서면동의 일괄등록 완료 (${regDate}) ${marked.length}건 전원 성공`,
  `— 종이로 수거한 ${docName} 중 신분증까지 제출된 세대를 '서면동의(직접)'로 등록`,
  `— 총 ${byHouse.size}세대 ${marked.length}명${sharedNote} / 실패 0건`,
  '',
];
for (const dong of [...byDong.keys()].sort((a, b) => Number(a) - Number(b))) {
  const houses = byDong.get(dong)!.sort((a, b) => a.ho - b.ho);
  share.push(`[${dong}동] ${houses.length}세대`);
  const items = houses.map((h) => `${h.ho}호 ${h.names.join('·')}${h.names.length > 1 ? ' (공유)' : ''}`);
  for (let i = 0; i < items.length; i += 4) share.push(' ' + items.slice(i, i + 4).join(' / '));
  share.push('');
}
console.log(`\n[3] 공유용 명단 ${fails.length ? '(⚠ 위 실패 건 해결 전 공유 금지)' : ''}\n`);
console.log(share.join('\n'));

if (fails.length) process.exit(1);
