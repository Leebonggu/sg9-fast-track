/**
 * 인쇄 명단(/unified/print) 레이아웃 실측 (읽기 전용)
 *
 * 인쇄물은 화면으로 판단하면 안 된다. page.tsx의 <style jsx global> 블록을 그대로 뽑아
 * 라이브 통합현황의 실제 최악 케이스(가장 긴 이름·연락처·공유 세대)로 정적 HTML을 만들고,
 * 헤드리스 크롬으로 PDF를 뽑아 컬럼이 넘치는지 숫자로 잰다.
 *
 * 세 가지를 낸다:
 *   1) 인쇄 상태 측정 — @media print 규칙을 강제 적용
 *   2) 화면 상태 측정 — 위원이 인쇄 버튼 누르기 전에 보는 그대로
 *      (둘은 .dong-section의 width/padding이 달라 실제로 어긋난 적이 있다. 반드시 둘 다 잰다)
 *   3) 실제 PDF — out/print-layout.pdf (눈으로 확인)
 *
 * 실행: npm run verify-print
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from '../src/lib/google-auth';
import { splitContacts } from '../src/lib/phone-format';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE = path.join(process.cwd(), 'src/app/unified/print/page.tsx');
const OUT = path.join(process.cwd(), 'out');
fs.mkdirSync(OUT, { recursive: true });

const s = (v: unknown) => String(v ?? '').trim();

// ── 1. page.tsx에서 CSS를 그대로 뽑는다 (복붙하면 실제와 달라져 측정이 거짓말을 한다)
const src = fs.readFileSync(PAGE, 'utf8');
const m = src.match(/<style jsx global>\{`([\s\S]*?)`\}<\/style>/);
if (!m) throw new Error('page.tsx에서 <style jsx global> 블록을 못 찾았다');
const css = m[1];

// @media print 안의 규칙을 밖으로 꺼내 화면 렌더에서도 인쇄 상태로 재게 한다.
// (--dump-dom은 screen 미디어라 이걸 안 하면 인쇄와 다른 폭을 잰다)
const printBlock = css.match(/@media print \{([\s\S]*)\n\s*\}\s*$/);
const printOverrides = printBlock ? printBlock[1] : '';

// ── 2. 라이브 통합현황에서 실제 최악 케이스를 고른다
const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, getServiceAccountAuth());
await doc.loadInfo();
const rows = await doc.sheetsByTitle['통합현황'].getRows();

type R = {
  dong: string; ho: string; name: string; age: string; phone: string;
  live: string; rep: string; co: number;
  // 상태 5종은 종이·전자를 따로 들고 있어야 "O전"이 겹쳐 찍히는 최악 폭을 잴 수 있다
  sintoPaper: boolean; sintoElec: boolean;
  planPaper: boolean; planElec: boolean;
  privacyPaper: boolean; idPaper: boolean; survey: boolean;
};
const all: R[] = [];
for (const r of rows) {
  const dong = s(r.get('동'));
  const ho = s(r.get('호수'));
  if (!dong || !ho) continue;
  all.push({
    dong, ho,
    name: s(r.get('소유자명')),
    age: s(r.get('연령대')) || s(r.get('연령대_명부')),
    phone: s(r.get('연락처_수정')) || s(r.get('연락처')),
    live: s(r.get('실거주여부')),
    rep: s(r.get('공유_대표자')),
    co: Number(r.get('공유_소유자수')) || 0,
    sintoPaper: s(r.get('신속통합동의서_제출_완료')) === 'TRUE',
    sintoElec: s(r.get('신속통합_전자동의')) === '완전',
    planPaper: s(r.get('정비계획입안_동의서')) === 'TRUE',
    planElec: s(r.get('정비계획입안_전자동의')) === '완전',
    privacyPaper: s(r.get('개인정보수집동의')) === 'TRUE',
    idPaper: s(r.get('신분증_수령')) === 'TRUE',
    survey: s(r.get('2026_04_기본조사_제출_완료')) === 'TRUE',
  });
}

const byLen = (f: (r: R) => string) => [...all].sort((a, b) => f(b).length - f(a).length);
const worst = [
  ...byLen((r) => r.name).slice(0, 12),
  ...byLen((r) => r.phone).slice(0, 8),
  ...[...all].sort((a, b) => b.co - a.co).slice(0, 5),
  ...byLen((r) => r.rep).slice(0, 5),
  // 종이·전자 둘 다인 세대 — 상태 칸에 "O전"이 겹쳐 찍히는 가장 넓은 본문이다
  ...all.filter((r) => r.sintoPaper && r.sintoElec).slice(0, 6),
];

console.log('=== 라이브 최악 케이스 ===');
console.log(`  세대 ${all.length}`);
console.log(`  가장 긴 소유자명 ${byLen((r) => r.name)[0].name.length}자: ${JSON.stringify(byLen((r) => r.name)[0].name)}`);
console.log(`  가장 긴 연락처 ${byLen((r) => r.phone)[0].phone.length}자: ${JSON.stringify(byLen((r) => r.phone)[0].phone)}`);
console.log(`  쉼표 이름 세대: ${all.filter((r) => r.name.includes(',')).length}`);
console.log(`  3인 이상 공유: ${all.filter((r) => r.co >= 3).length}`);

// 실제 한 동도 통째로 (평균적인 모습 확인용) — 세대가 가장 많은 동
const dongCount = new Map<string, number>();
for (const r of all) dongCount.set(r.dong, (dongCount.get(r.dong) ?? 0) + 1);
const bigDong = [...dongCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
const bigDongRows = all.filter((r) => r.dong === bigDong).slice(0, 40);

// ── 3. 컴포넌트와 같은 마크업으로 정적 HTML 생성
const SURVEYS = ['기본조사']; // 현재 설문 1개

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// page.tsx의 mark()와 같은 규칙 — 종이 O, 전자 전, 둘 다면 겹쳐 찍는다.
// 여기가 어긋나면 가장 넓은 본문("O전")을 안 재게 되므로 page.tsx를 고칠 때 같이 고칠 것.
const mk = (paper: boolean, elec: boolean) =>
  !paper && !elec
    ? '<span class="ox-x">X</span>'
    : `${paper ? '<span class="ox-o">O</span>' : ''}${elec ? '<span class="ox-e">전</span>' : ''}`;
const elecAny = (r: R) => r.sintoElec || r.planElec;

function cell(r: R, i: number) {
  const contacts = splitContacts(r.phone);
  const phoneHtml = contacts.length === 0 ? '-' : contacts.map((c) =>
    `<span class="contact">${c.name ? `<span class="contact-name">${esc(c.name)}</span>` : ''}<span class="contact-num">${esc(c.number || '-')}</span></span>`
  ).join('');
  const rep = r.co > 1
    ? `<span class="rep ${r.rep ? 'rep-set' : 'rep-none'}">${r.rep ? `대표 ${esc(r.rep)}` : `대표 미선임 (공유 ${r.co}인)`}</span>`
    : '';
  return `<tr>
    <td class="c-no">${i + 1}</td>
    <td class="c-dong">${esc(r.dong)}</td>
    <td class="c-ho">${esc(r.ho)}</td>
    <td class="c-name">${esc(r.name.replace(/,\s*/g, ', '))}${rep}</td>
    <td class="c-age">${esc(r.age) || '-'}</td>
    <td class="c-phone">${phoneHtml}</td>
    <td class="c-live">${esc(r.live) || '-'}</td>
    <td class="c-stat">${mk(r.sintoPaper, r.sintoElec)}</td>
    ${SURVEYS.map(() => `<td class="c-stat ${r.survey ? 'ox-o' : 'ox-x'}">${r.survey ? 'O' : 'X'}</td>`).join('')}
    <td class="c-stat">${mk(r.planPaper, r.planElec)}</td>
    <td class="c-stat">${mk(r.privacyPaper, elecAny(r))}</td>
    <td class="c-stat">${mk(r.idPaper, elecAny(r))}</td>
    <td class="c-visit"><span class="checkbox"></span></td>
  </tr>`;
}

function section(title: string, rs: R[]) {
  const leftSpan = 6;
  const totalCols = 12 + SURVEYS.length;
  return `<section class="dong-section"><table class="list-table">
  <colgroup>
    <col class="c-no"><col class="c-dong"><col class="c-ho"><col class="c-name">
    <col class="c-age"><col class="c-phone"><col class="c-live"><col class="c-stat">
    ${SURVEYS.map(() => '<col class="c-stat">').join('')}
    <col class="c-stat"><col class="c-stat"><col class="c-stat"><col class="c-visit">
  </colgroup>
  <thead>
    <tr class="sheet-title">
      <th class="t-left" colspan="${leftSpan}">${esc(title)} <span class="sub">정비입안 3종 수거 명단</span></th>
      <th class="t-right" colspan="${totalCols - leftSpan}"><span class="count">${rs.length}세대</span><span class="date">2026년 8월 14일</span><span class="legend">O 종이 · 전 전자 · O전 둘다 · X 없음</span></th>
    </tr>
    <tr class="col-head">
      <th class="c-no">번호</th><th class="c-dong">동</th><th class="c-ho">호수</th>
      <th class="c-name">성명</th><th class="c-age">연령</th><th class="c-phone">연락처</th>
      <th class="c-live">실거주</th><th class="c-stat">신통<br>동의서</th>
      ${SURVEYS.map((l) => `<th class="c-stat">${l.slice(0, 2)}<br>${l.slice(2)}</th>`).join('')}
      <th class="c-stat">입안<br>동의서</th><th class="c-stat">개인<br>정보</th>
      <th class="c-stat">신분증</th><th class="c-visit">방문</th>
    </tr>
  </thead>
  <tbody>${rs.map(cell).join('')}</tbody>
</table></section>`;
}

// 넘침 측정 — 인쇄 상태에서 각 셀의 실제 내용 폭이 칸을 넘는지
const probe = `<script>
window.addEventListener('load', () => {
  const out = [];
  const sec = document.querySelector('.dong-section');
  const tbl = document.querySelector('.list-table');
  const MM = document.getElementById('mm').getBoundingClientRect().width / 100;
  // ⚠ clientWidth는 패딩을 포함한다. 그걸 "내용 폭"으로 쓰면 패딩이 있는 화면 상태에서
  //   표가 17mm 넘치는데도 정상으로 보인다(실제로 그렇게 놓쳤다). 패딩을 빼야 한다.
  const cs = getComputedStyle(sec);
  const inner = sec.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const tw = tbl.getBoundingClientRect().width;
  out.push('섹션 내용폭 ' + (inner / MM).toFixed(1) + 'mm (패딩 제외)');
  out.push('표 실제폭 ' + (tw / MM).toFixed(1) + 'mm');
  out.push(tw > inner + 0.5
    ? '>>> 표가 ' + ((tw - inner) / MM).toFixed(1) + 'mm 넘친다 — 오른쪽이 잘린다'
    : '표가 내용 폭 안에 들어간다');
  const over = new Map();
  for (const c of document.querySelectorAll('td, th')) {
    if (c.scrollWidth > c.clientWidth + 1) {
      const k = c.className.split(' ')[0];
      const cur = over.get(k) || { n: 0, worst: 0, sample: '' };
      cur.n++;
      const ex = c.scrollWidth - c.clientWidth;
      if (ex > cur.worst) { cur.worst = ex; cur.sample = c.textContent.slice(0, 24); }
      over.set(k, cur);
    }
  }
  out.push('--- 넘치는 셀 (scrollWidth > clientWidth) ---');
  if (over.size === 0) out.push('없음');
  for (const [k, v] of [...over].sort((a,b) => b[1].worst - a[1].worst)) {
    out.push(k + ': ' + v.n + '개, 최대 +' + (v.worst / MM).toFixed(1) + 'mm, 예: ' + JSON.stringify(v.sample));
  }
  // 줄수 — 행이 몇 줄로 늘어났는지 (성명이 접히면 행 높이가 커진다)
  const hs = [...document.querySelectorAll('tbody tr')].map(r => r.getBoundingClientRect().height / MM);
  out.push('--- 행 높이 ---');
  out.push('최소 ' + Math.min(...hs).toFixed(1) + 'mm / 최대 ' + Math.max(...hs).toFixed(1) + 'mm / 평균 ' + (hs.reduce((a,b)=>a+b,0)/hs.length).toFixed(1) + 'mm');
  out.push('A4 세로 인쇄영역 273mm 기준 예상 행수/장: ' + Math.floor(273 / (hs.reduce((a,b)=>a+b,0)/hs.length)));
  document.title = 'MEASURED';
  document.getElementById('out').textContent = out.join('\\n');
});
</script>`;

const body = `<body><div id="mm"></div><pre id="out"></pre>
<div class="print-root">
${section(`${bigDong}동`, bigDongRows)}
${section('최악 케이스', worst)}
</div>${probe}</body></html>`;

const head = (extra: string) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>${css}</style>
<style>
#mm { width: 100mm; height: 1px; position: absolute; }
#out { font: 12px monospace; white-space: pre; }
${extra}
</style></head>`;

// 인쇄 상태 — @media print 안의 규칙을 밖으로 꺼내 적용하고, 본문 폭(A4 210 - 12*2)을 재현
const printHtml = head(`body { background: white; margin: 0; }
.print-root { padding: 0; gap: 0; width: 186mm; }
${printOverrides}`) + body;

// 화면 상태 — page.tsx의 CSS를 그대로. 위원이 인쇄 버튼 누르기 전에 보는 화면이다.
const screenHtml = head('') + body;

const printPath = path.join(OUT, 'print-layout.html');
const screenPath = path.join(OUT, 'screen-layout.html');
fs.writeFileSync(printPath, printHtml);
fs.writeFileSync(screenPath, screenHtml);

// ── 4. 측정값 뽑기
function measure(file: string, label: string) {
  const dom = execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--virtual-time-budget=5000',
    '--window-size=1600,2000', '--dump-dom', `file://${file}`,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const hit = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  console.log(`\n=== ${label} 실측 ===`);
  console.log(hit ? hit[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<') : '(측정 실패)');
}
measure(printPath, '인쇄 상태');
measure(screenPath, '화면 상태');

// ── 5. 실제 PDF + 화면 스크린샷
const pdfPath = path.join(OUT, 'print-layout.pdf');
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--virtual-time-budget=5000',
  '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${printPath}`,
], { stdio: 'ignore' });
const shotPath = path.join(OUT, 'screen-layout.png');
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--virtual-time-budget=5000',
  '--window-size=1600,1400', `--screenshot=${shotPath}`, `file://${screenPath}`,
], { stdio: 'ignore' });
console.log(`\nPDF:   ${pdfPath}`);
console.log(`화면:  ${shotPath}`);
