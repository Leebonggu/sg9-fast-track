/**
 * 회귀 테스트 — 전자동의서 대상자관리 xlsx 파싱 (서울시 전자동의 시스템 포맷)
 * 실행: npm test (또는 tsx tests/econsent-parser.test.ts)
 *
 * 실제 2026-08-10 파일에 대한 수치 검증은 scripts/verify-econsent-parser.mts 가 담당한다
 * (원본이 개인정보라 저장소에 넣지 않음). 여기서는 판정 로직만 합성 데이터로 고정한다.
 */
import * as XLSX from 'xlsx';
import { parseEconsentFiles } from '../src/lib/econsent-parser';

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

function assertThrows(label: string, fn: () => unknown, expectSubstring: string): void {
  try {
    fn();
    fail++;
    console.log(`  ✗ ${label}: 예외가 안 났다`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes(expectSubstring)) {
      pass++;
      console.log(`  ✓ ${label}`);
    } else {
      fail++;
      console.log(`  ✗ ${label}: 메시지에 "${expectSubstring}" 없음 → "${msg}"`);
    }
  }
}

const BASE_HEADERS = [
  '연번', '제출상태', '제출일시', '소유구분', '대표자여부',
  '이름', '건물명', '동', '층', '호수', '생년월일', '연락처',
];

interface Owner {
  seq: string; status: string; at?: string; ownership: string; rep?: string;
  name: string; building?: string; dong: string; ho: string;
  birth?: string; phone?: string; choice?: string;
}

function build(owners: Owner[], withChoice: boolean): Buffer {
  const headers = withChoice ? [...BASE_HEADERS, '선택 항목'] : BASE_HEADERS;
  const rows = owners.map((o) => {
    const base = [
      o.seq, o.status, o.at ?? '', o.ownership, o.rep ?? '',
      o.name, o.building ?? '상계주공아파트', o.dong, '제1층', o.ho,
      o.birth ?? '', o.phone ?? '',
    ];
    return withChoice ? [...base, o.choice ?? '-'] : base;
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '전자 동의서 대상자 관리 내역');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// 신통/입안 제출상태만 다르고 나머지는 같은 한 쌍을 만든다.
function pair(owners: Owner[], planStatus: (o: Owner) => string): [Buffer, Buffer] {
  return [
    build(owners, false),
    build(owners.map((o) => ({ ...o, status: planStatus(o) })), true),
  ];
}

const NOW = new Date('2026-08-12T00:00:00+09:00');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: econsent-parser');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n[1] 세대 판정 — 단독/공유 전원/공유 일부/미제출');
{
  const owners: Owner[] = [
    // 단독 제출
    { seq: '1', status: '전자동의', at: '2026-07-20 10:00:00', ownership: '단독', name: '김단독', dong: '제901동', ho: '제101호', birth: '1960-05-05' },
    // 공유 2명 전원 제출 + 대표 선임
    { seq: '2-1', status: '전자동의', at: '2026-07-15 09:00:00', ownership: '공유', rep: '대표', name: '박대표', dong: '제901동', ho: '제102호', birth: '1955-01-01' },
    { seq: '2-2', status: '전자동의', at: '2026-07-16 09:00:00', ownership: '공유', rep: '위임', name: '박배우', dong: '제901동', ho: '제102호', birth: '1958-01-01' },
    // 공유 2명 중 1명만 제출 (대표 미선임)
    { seq: '3-1', status: '전자동의', at: '2026-08-01 12:00:00', ownership: '공유', rep: '미선임', name: '이일부', dong: '제901동', ho: '제103호', birth: '1975-03-03' },
    { seq: '3-2', status: '미제출', ownership: '공유', rep: '미선임', name: '이배우', dong: '제901동', ho: '제103호', birth: '1980-03-03' },
    // 단독 미제출
    { seq: '4', status: '미제출', ownership: '단독', name: '최미제', dong: '제901동', ho: '제104호', birth: '1990-12-12' },
  ];
  const [s, p] = pair(owners, (o) => (o.seq === '1' ? '미제출' : o.status));
  const r = parseEconsentFiles(s, p, NOW);

  assertEqual('소유자 행 수', r.owners.length, 6);
  assertEqual('세대 수', r.households.size, 4);
  assertEqual('단독 제출 → 완전', r.households.get('901-101')!.sinto, '완전');
  assertEqual('공유 전원 제출 → 완전', r.households.get('901-102')!.sinto, '완전');
  assertEqual('공유 일부 제출 → 일부', r.households.get('901-103')!.sinto, '일부');
  assertEqual('미제출 → 빈칸', r.households.get('901-104')!.sinto, '');
  assertEqual('입안은 신통과 독립 판정', r.households.get('901-101')!.plan, '');
  assertEqual('대표자 이름', r.households.get('901-102')!.representative, '박대표');
  assertEqual('대표 미선임은 빈칸', r.households.get('901-103')!.representative, '');
  assertEqual('공유 소유자수', r.households.get('901-102')!.ownerCount, 2);
  assertEqual('최초 제출일시', r.households.get('901-102')!.firstSubmittedAt, '2026-07-15 09:00:00');
}

console.log('\n[2] 서면동의(직접)도 제출로 인정');
{
  const owners: Owner[] = [
    { seq: '1', status: '서면동의(직접)', at: '2026-07-20 10:00:00', ownership: '단독', name: '서면인', dong: '제902동', ho: '제201호', birth: '1970-01-01' },
  ];
  const [s, p] = pair(owners, () => '미제출');
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('서면동의(직접) → 완전', r.households.get('902-201')!.sinto, '완전');
}

console.log('\n[2-1] 위임자의 "미제출(대표자제출)"은 미제출로 취급 (2026-08-27 실측: 완비여부 미비)');
{
  const owners: Owner[] = [
    { seq: '1-1', status: '전자동의', at: '2026-07-20 10:00:00', ownership: '공유', rep: '대표', name: '정석환', dong: '제907동', ho: '제602호', birth: '1970-01-01' },
    { seq: '1-2', status: '미제출(대표자제출)', ownership: '공유', rep: '위임', name: '권지은', dong: '제907동', ho: '제602호', birth: '1972-01-01' },
  ];
  const [s, p] = pair(owners, () => '미제출');
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('대표만 제출 → 일부(완전 아님)', r.households.get('907-602')!.sinto, '일부');
  assertEqual('알려지지 않은 값 경고 없음', r.warnings.some((w) => w.includes('미제출(대표자제출)')), false);
}

console.log('\n[3] 상가는 스킵, 무명 행은 세대로 유지');
{
  const owners: Owner[] = [
    { seq: '1', status: '미제출', ownership: '단독', name: '홍두진', building: '상계주공아파트9단지종합상가', dong: '', ho: '제101호' },
    { seq: '2', status: '미제출', ownership: '', name: '', dong: '제903동', ho: '제301호' },
    { seq: '3', status: '전자동의', at: '2026-07-20 10:00:00', ownership: '단독', name: '정상인', dong: '제903동', ho: '제302호', birth: '1965-06-06' },
  ];
  const [s, p] = pair(owners, () => '미제출');
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('상가 스킵', r.skipped.commercial, 1);
  assertEqual('무명은 스킵하지 않고 카운트만', r.unnamedOwners, 1);
  assertEqual('무명 세대도 유지', r.households.size, 2);
  assertEqual('세대 키', [...r.households.keys()].sort(), ['903-301', '903-302']);
  assertEqual('무명 세대는 미제출', r.households.get('903-301')!.sinto, '');
  assertEqual('무명은 ownerNames에서 제외', r.households.get('903-301')!.ownerNames, []);
}

console.log('\n[3-1] 무명 공유자가 있어도 "일부"가 "완전"으로 둔갑하지 않는다');
{
  const owners: Owner[] = [
    { seq: '1-1', status: '전자동의', at: '2026-07-20 10:00:00', ownership: '공유', rep: '미선임', name: '서명함', dong: '제903동', ho: '제401호', birth: '1970-01-01' },
    { seq: '1-2', status: '미제출', ownership: '공유', rep: '미선임', name: '', dong: '제903동', ho: '제401호' },
  ];
  const [s, p] = pair(owners, () => '미제출');
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('무명 공유자 포함 ownerCount', r.households.get('903-401')!.ownerCount, 2);
  assertEqual('판정은 일부', r.households.get('903-401')!.sinto, '일부');
}

console.log('\n[4] 추진방식 선택 항목');
{
  const owners: Owner[] = [
    { seq: '1', status: '전자동의', at: '2026-07-20 10:00:00', ownership: '단독', name: '추진파', dong: '제904동', ho: '제401호', birth: '1970-01-01', choice: '추진위원회 구성' },
    { seq: '2', status: '전자동의', at: '2026-07-20 10:00:00', ownership: '단독', name: '조합파', dong: '제904동', ho: '제402호', birth: '1970-01-01', choice: '직접조합설립' },
    { seq: '3', status: '미제출', ownership: '단독', name: '무선택', dong: '제904동', ho: '제403호', birth: '1970-01-01', choice: '-' },
  ];
  const [s, p] = pair(owners, (o) => o.status);
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('추진위원회 구성', r.households.get('904-401')!.planChoice, '추진위원회 구성');
  assertEqual('직접조합설립', r.households.get('904-402')!.planChoice, '직접조합설립');
  assertEqual('"-"는 빈칸', r.households.get('904-403')!.planChoice, '');
}

console.log('\n[5] 연령대 — 세대 내 최고 연령 기준');
{
  const owners: Owner[] = [
    { seq: '1-1', status: '미제출', ownership: '공유', name: '연장자', dong: '제905동', ho: '제501호', birth: '1950-01-01' },
    { seq: '1-2', status: '미제출', ownership: '공유', name: '연소자', dong: '제905동', ho: '제501호', birth: '1990-01-01' },
    { seq: '2', status: '미제출', ownership: '단독', name: '생일전', dong: '제905동', ho: '제502호', birth: '1966-12-31' },
    { seq: '3', status: '미제출', ownership: '단독', name: '초고령', dong: '제905동', ho: '제503호', birth: '1930-01-01' },
    { seq: '4', status: '미제출', ownership: '단독', name: '무생일', dong: '제905동', ho: '제504호', birth: '' },
  ];
  const [s, p] = pair(owners, () => '미제출');
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('최고 연령 채택 (1950 → 70대)', r.households.get('905-501')!.ageGroup, '70대');
  assertEqual('생일 전이면 만나이 -1 (1966-12-31 → 59세 → 50대)', r.households.get('905-502')!.ageGroup, '50대');
  assertEqual('90세 이상', r.households.get('905-503')!.ageGroup, '90대 이상');
  assertEqual('생년월일 없으면 빈칸', r.households.get('905-504')!.ageGroup, '');
}

console.log('\n[6] 연락처 정규화');
{
  const owners: Owner[] = [
    { seq: '1', status: '미제출', ownership: '단독', name: '정상', dong: '제906동', ho: '제601호', phone: '010-8340-6863' },
    { seq: '2', status: '미제출', ownership: '단독', name: '하이픈없음', dong: '제906동', ho: '제602호', phone: '01083406863' },
    { seq: '3', status: '미제출', ownership: '단독', name: '잘림', dong: '제906동', ho: '제603호', phone: '0105686' },
  ];
  const [s, p] = pair(owners, () => '미제출');
  const r = parseEconsentFiles(s, p, NOW);
  assertEqual('표준 포맷 유지', r.households.get('906-601')!.phone, '010-8340-6863');
  assertEqual('하이픈 재삽입', r.households.get('906-602')!.phone, '010-8340-6863');
  assertEqual('잘린 번호는 버림', r.households.get('906-603')!.phone, '');
  assertEqual('버린 건 warning', r.warnings.some((w) => w.includes('0105686')), true);
}

console.log('\n[7] 파일 사고 방어');
{
  const owners: Owner[] = [
    { seq: '1', status: '미제출', ownership: '단독', name: '김', dong: '제907동', ho: '제701호' },
  ];
  const sinto = build(owners, false);
  const plan = build(owners, true);

  assertThrows('두 파일 뒤바꿔 올리면 throw', () => parseEconsentFiles(plan, sinto, NOW), '뒤바뀐');
  assertThrows('같은 파일 두 번 올리면 throw', () => parseEconsentFiles(sinto, sinto, NOW), '뒤바뀐');

  const shorter = build(owners.slice(0, 0).concat(owners), true);
  const longer = build([...owners, { seq: '2', status: '미제출', ownership: '단독', name: '이', dong: '제907동', ho: '제702호' }], true);
  assertThrows('행 수 불일치 throw', () => parseEconsentFiles(sinto, longer, NOW), '행 수가 다릅니다');
  void shorter;

  const mismatched = build([{ ...owners[0], name: '다른사람' }], true);
  assertThrows('같은 행 다른 사람이면 throw', () => parseEconsentFiles(sinto, mismatched, NOW), '두 파일에서 다릅니다');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass, ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
