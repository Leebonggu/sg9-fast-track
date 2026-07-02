# 후원금 은행거래내역 일괄업로드 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/unified/donations-import` 페이지에서 국민은행 거래내역 xls를 업로드하면, 이미 등록된 후원금은 자동 제외하고 신규 건만 미리보기 확인 후 `후원금` 구글시트에 등록한다.

**Architecture:** 파싱(순수 함수, 패턴 확장 가능) → 분류(순수 함수, new/duplicate/review 3분류) → API 2개(미리보기/커밋) → 클라이언트 미리보기 테이블(동/호수 inline 수정 가능). 순수 로직과 I/O(구글시트, xlsx 파일 읽기)를 분리해서 순수 로직만 회귀 테스트로 고정한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, `xlsx`(이미 dependency), `google-spreadsheet`(이미 dependency), `tsx`(신규 devDependency, recon-sim과 동일 패턴의 회귀테스트 실행용).

## Global Constraints

- 스펙 원문: `docs/superpowers/specs/2026-07-02-donation-bulk-import-design.md`
- 파싱 실패(`source: 'fail'`) 또는 중복키는 일치하나 동/호수가 다른 건(`review`)은 **자동 등록 금지** — 반드시 관리자가 미리보기에서 확인 후 등록
- 중복판단 키: `${원본송금시각_KST_ISO}|${금액}` (동/호수 불일치시 `review`로 분류, 무시하지 않음)
- `시각` 필드는 항상 **원본 송금시각**(KST, `+09:00`)을 보존 — 등록 실행 시각을 쓰지 않음 (기존 `addDonation()`의 "시각=지금" 로직과 다른 별도 함수로 구현)
- `등록자` 값: 세션에 `operatorName`이 있으면 `"엑셀 일괄등록(이름)"`, 없으면 `"엑셀 일괄등록"`
- 새 npm 패키지는 `tsx`(devDependency)만 추가 — 그 외 기존 dependency(`xlsx`, `google-spreadsheet`)만 재사용
- v2 시트(`setup_v2.gs`)나 `.env.local`은 이 작업과 무관 — 건드리지 않음
- 이 플랜의 마지막 단계(Task 6)는 **검증만** 한다 — 실제 프로덕션 `후원금` 시트에 신규 19건을 등록하는 건 사용자가 완성된 페이지에서 직접 수행하기로 함(사용자 명시 요청), 플랜 실행 중 자동으로 커밋하지 않는다

---

### Task 1: 파서 핵심 함수 + 테스트 인프라

**Files:**
- Modify: `web/package.json` (devDependencies에 `tsx` 추가, `test` 스크립트 추가)
- Create: `web/src/lib/donation-parser.ts`
- Create: `web/tests/donation-parser.test.ts`

**Interfaces:**
- Produces: `extractDongHo(text: string): { dong: string; ho: string } | null`
- Produces: `type ParseSource = 'memo' | 'sender' | 'fail'`
- Produces: `parseTransactionRow(sender: string, memo: string): { dong: string; ho: string; source: ParseSource }`

- [ ] **Step 1: package.json에 tsx devDependency + test 스크립트 추가**

`web/package.json`의 `"scripts"`와 `"devDependencies"`를 수정:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "tsx tests/donation-parser.test.ts && tsx tests/donation-classify.test.ts && tsx tests/donation-import-file.test.ts"
  },
```

```json
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/pdf-parse": "^1.1.5",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.2",
    "tailwindcss": "^4",
    "tsx": "^4.19.2",
    "typescript": "^5"
  }
```

Run: `cd web && npm install`
Expected: `tsx` installed, no errors.

- [ ] **Step 2: 실패하는 테스트 작성**

Create `web/tests/donation-parser.test.ts`:

```ts
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
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `cd web && npx tsx tests/donation-parser.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/donation-parser'`

- [ ] **Step 4: donation-parser.ts 구현**

Create `web/src/lib/donation-parser.ts`:

```ts
import { BUILDING_CONFIG } from './buildings';

const VALID_DONG = new Set(Object.keys(BUILDING_CONFIG).map((k) => k.replace('동', '')));

// 문자열에서 숫자만 추출해 앞 3자리를 동(901~923 검증), 나머지(1~4자리)를 호수로 해석.
// 은행 송금 메모는 자유 텍스트라 구분자가 계속 늘어나므로(동/호, /, -, _, 공백 등)
// 구분자 자체를 파싱하지 않고 숫자만 뽑아내는 방식으로 대부분의 형식을 흡수한다.
export function extractDongHo(text: string): { dong: string; ho: string } | null {
  if (!text) return null;
  const digits = String(text).replace(/[^0-9]/g, '');
  if (digits.length < 4 || digits.length > 7) return null;
  const dong = digits.slice(0, 3);
  const ho = digits.slice(3);
  if (!VALID_DONG.has(dong)) return null;
  if (ho.length < 1 || ho.length > 4) return null;
  return { dong, ho };
}

export type ParseSource = 'memo' | 'sender' | 'fail';

export interface ParsedDongHo {
  dong: string;
  ho: string;
  source: ParseSource;
}

// 은행 UI가 보낸분 이름을 표시글자수 제한으로 잘라내는 경우가 있어(2026-07-02 실측 6건)
// memo가 있고 유효하게 파싱되면 memo를 우선한다. memo도 100% 정확하진 않지만
// sender보다는 사람이 사후에 확인해서 채워넣은 값일 가능성이 높다.
export function parseTransactionRow(sender: string, memo: string): ParsedDongHo {
  const fromMemo = memo ? extractDongHo(memo) : null;
  if (fromMemo) return { ...fromMemo, source: 'memo' };
  const fromSender = extractDongHo(sender);
  if (fromSender) return { ...fromSender, source: 'sender' };
  return { dong: '', ho: '', source: 'fail' };
}
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `cd web && npx tsx tests/donation-parser.test.ts`
Expected: `결과: 21 pass / 0 fail`, exit code 0

- [ ] **Step 6: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/package.json web/package-lock.json web/src/lib/donation-parser.ts web/tests/donation-parser.test.ts
git commit -m "feat: 후원금 동/호수 파서 + 회귀 테스트 추가"
```

---

### Task 2: xlsx 파싱 + 중복 분류 (순수 로직)

**Files:**
- Create: `web/src/lib/donation-import-types.ts`
- Create: `web/src/lib/donation-import.ts`
- Create: `web/tests/donation-classify.test.ts`
- Create: `web/tests/donation-import-file.test.ts`

**Interfaces:**
- Consumes: `parseTransactionRow`, `ParseSource` from Task 1 (`../src/lib/donation-parser`)
- Produces: `ParsedImportRow`, `ClassifiedImportRow`, `ImportClassification` (types, `donation-import-types.ts`)
- Produces: `buildDedupKey(iso: string, amount: number): string`
- Produces: `toIsoKst(dateStr: string): { iso: string; dateOnly: string } | null`
- Produces: `parseImportFile(buffer: Buffer): ParsedImportRow[]`
- Produces: `classifyRows(rows: ParsedImportRow[], existing: Map<string, { dong: string; ho: string }>): ClassifiedImportRow[]`

- [ ] **Step 1: 타입 정의**

Create `web/src/lib/donation-import-types.ts`:

```ts
import type { ParseSource } from './donation-parser';

export type ImportClassification = 'new' | 'duplicate' | 'review';

export interface ParsedImportRow {
  rowIdx: number;
  iso: string;       // 원본 송금시각 KST ISO, 예: "2026-07-02T13:48:51+09:00"
  dateOnly: string;  // "2026-07-02"
  amount: number;
  sender: string;
  memo: string;
  dong: string;
  ho: string;
  source: ParseSource;
}

export interface ClassifiedImportRow extends ParsedImportRow {
  classification: ImportClassification;
  existingDong?: string;
  existingHo?: string;
}
```

이 파일은 `donation-parser.ts`(BUILDING_CONFIG만 의존, Node 전용 API 없음)에만 의존하므로 클라이언트 컴포넌트에서 타입만 import해도 안전하다. `donation-import.ts`(아래, `xlsx`+`Buffer` 사용)는 서버(API route)에서만 import한다.

- [ ] **Step 2: 실패하는 분류 테스트 작성**

Create `web/tests/donation-classify.test.ts`:

```ts
/**
 * 회귀 테스트 — 후원금 중복 분류 로직 (순수 함수, 구글시트 I/O 없음)
 * 실행: npm test (또는 tsx tests/donation-classify.test.ts)
 */
import { classifyRows, buildDedupKey } from '../src/lib/donation-import';
import type { ParsedImportRow } from '../src/lib/donation-import-types';

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
console.log(' 회귀 테스트: 후원금 중복 분류');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const ISO_A = '2026-07-01T12:00:00+09:00';
const ISO_B = '2026-07-01T13:00:00+09:00';
const ISO_C = '2026-07-02T09:00:00+09:00';

const existing = new Map<string, { dong: string; ho: string }>([
  [buildDedupKey(ISO_A, 50000), { dong: '901', ho: '101' }],
  [buildDedupKey(ISO_B, 30000), { dong: '902', ho: '202' }],
]);

function row(partial: Partial<ParsedImportRow>): ParsedImportRow {
  return {
    rowIdx: 0, iso: '', dateOnly: '', amount: 0, sender: '', memo: '', dong: '', ho: '', source: 'sender',
    ...partial,
  };
}

const rows: ParsedImportRow[] = [
  row({ rowIdx: 1, iso: ISO_A, amount: 50000, dong: '901', ho: '101', source: 'sender' }), // 동/호수 일치 → duplicate
  row({ rowIdx: 2, iso: ISO_A, amount: 50000, dong: '', ho: '', source: 'fail' }),          // 파싱실패지만 키 일치 → duplicate
  row({ rowIdx: 3, iso: ISO_B, amount: 30000, dong: '905', ho: '505', source: 'sender' }), // 동/호수 불일치 → review
  row({ rowIdx: 4, iso: ISO_C, amount: 99999, dong: '910', ho: '303', source: 'sender' }), // 키 자체가 없음 → new
];

const result = classifyRows(rows, existing);

console.log('\n[1] 분류 결과');
assertEqual('row1 duplicate', result[0].classification, 'duplicate');
assertEqual('row2 duplicate(파싱실패도 키일치면 중복처리)', result[1].classification, 'duplicate');
assertEqual('row3 review', result[2].classification, 'review');
assertEqual('row3 existing 값 포함', { dong: result[2].existingDong, ho: result[2].existingHo }, { dong: '902', ho: '202' });
assertEqual('row4 new', result[3].classification, 'new');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
```

- [ ] **Step 3: 실패하는 파일 파싱 테스트 작성**

Create `web/tests/donation-import-file.test.ts`:

```ts
/**
 * 회귀 테스트 — xlsx 버퍼 파싱 (국민은행 원장 포맷)
 * 실행: npm test (또는 tsx tests/donation-import-file.test.ts)
 */
import * as XLSX from 'xlsx';
import { parseImportFile } from '../src/lib/donation-import';

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

function buildXlsxBuffer(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: donation-import 파일 파싱');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n[1] 정상 파일');
const buf = buildXlsxBuffer([
  ['No', '거래일시', '보낸분/받는분', '입금액(원)', '메모'],
  [1, '2026.07.02 13:48:51', '917동610호', 50000, ''],
  [2, '2026.07.01 21:01:30', '조종현', 50000, '906/703'],
]);
const rows = parseImportFile(buf);
assertEqual('행 개수', rows.length, 2);
assertEqual('첫 행 파싱', { dong: rows[0].dong, ho: rows[0].ho, source: rows[0].source }, { dong: '917', ho: '610', source: 'sender' });
assertEqual('첫 행 iso', rows[0].iso, '2026-07-02T13:48:51+09:00');
assertEqual('둘째 행 memo 우선', { dong: rows[1].dong, ho: rows[1].ho, source: rows[1].source }, { dong: '906', ho: '703', source: 'memo' });

console.log('\n[2] 컬럼 누락 → 에러');
const badBuf = buildXlsxBuffer([
  ['번호', '날짜', '금액'],
  [1, '2026.07.02', 50000],
]);
let threw = false;
try {
  parseImportFile(badBuf);
} catch {
  threw = true;
}
assertEqual('예상 컬럼 없으면 throw', threw, true);

console.log('\n[3] 헤더만 있는 빈 파일');
const emptyBuf = buildXlsxBuffer([
  ['No', '거래일시', '보낸분/받는분', '입금액(원)', '메모'],
]);
assertEqual('빈 결과(에러 아님)', parseImportFile(emptyBuf).length, 0);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) process.exit(1);
```

- [ ] **Step 4: 테스트 실행해서 실패 확인**

Run: `cd web && npx tsx tests/donation-classify.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/donation-import'`

Run: `cd web && npx tsx tests/donation-import-file.test.ts`
Expected: FAIL — 동일 사유

- [ ] **Step 5: donation-import.ts 구현**

Create `web/src/lib/donation-import.ts`:

```ts
import * as XLSX from 'xlsx';
import { parseTransactionRow } from './donation-parser';
import type { ParsedImportRow, ClassifiedImportRow } from './donation-import-types';

export function buildDedupKey(iso: string, amount: number): string {
  return `${iso}|${amount}`;
}

// "2026.07.02 13:48:51" (은행 거래일시 표기, KST) -> ISO 문자열 + 날짜만
export function toIsoKst(dateStr: string): { iso: string; dateOnly: string } | null {
  const m = String(dateStr).trim().match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${se}+09:00`, dateOnly: `${y}-${mo}-${d}` };
}

// 국민은행 거래내역 원장 포맷: No / 거래일시 / 보낸분/받는분 / 입금액(원) / 메모(선택)
export function parseImportFile(buffer: Buffer): ParsedImportRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (rows.length === 0) return [];

  const header = (rows[0] as unknown[]).map((h) => String(h));
  const dateIdx = header.indexOf('거래일시');
  const senderIdx = header.indexOf('보낸분/받는분');
  const amountIdx = header.indexOf('입금액(원)');
  const memoIdx = header.indexOf('메모');

  if (dateIdx === -1 || senderIdx === -1 || amountIdx === -1) {
    throw new Error('예상한 컬럼(거래일시/보낸분·받는분/입금액(원))을 찾을 수 없습니다.');
  }

  const result: ParsedImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const dateStr = String(row[dateIdx] ?? '');
    if (!dateStr) continue;
    const dt = toIsoKst(dateStr);
    if (!dt) continue;
    const sender = String(row[senderIdx] ?? '');
    const memo = memoIdx === -1 ? '' : String(row[memoIdx] ?? '');
    const amount = Number(row[amountIdx]) || 0;
    const { dong, ho, source } = parseTransactionRow(sender, memo);
    result.push({ rowIdx: i, iso: dt.iso, dateOnly: dt.dateOnly, amount, sender, memo, dong, ho, source });
  }
  return result;
}

// 시각+금액 키가 일치하는데 동/호수까지 같으면(또는 신규쪽 파싱이 실패했으면) 확실한 중복.
// 동/호수가 다르면 콜리전이거나 파싱 오류일 수 있어 review로 넘겨 사람이 확인하게 한다.
export function classifyRows(
  rows: ParsedImportRow[],
  existing: Map<string, { dong: string; ho: string }>,
): ClassifiedImportRow[] {
  return rows.map((row) => {
    const key = buildDedupKey(row.iso, row.amount);
    const match = existing.get(key);
    if (!match) {
      return { ...row, classification: 'new' };
    }
    const sameUnit = !row.dong || (row.dong === match.dong && row.ho === match.ho);
    if (sameUnit) {
      return { ...row, classification: 'duplicate', existingDong: match.dong, existingHo: match.ho };
    }
    return { ...row, classification: 'review', existingDong: match.dong, existingHo: match.ho };
  });
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd web && npx tsx tests/donation-classify.test.ts`
Expected: `결과: 5 pass / 0 fail`

Run: `cd web && npx tsx tests/donation-import-file.test.ts`
Expected: `결과: 5 pass / 0 fail`

- [ ] **Step 7: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/lib/donation-import-types.ts web/src/lib/donation-import.ts web/tests/donation-classify.test.ts web/tests/donation-import-file.test.ts
git commit -m "feat: 후원금 xlsx 파싱 + 중복 분류(new/duplicate/review) 로직 추가"
```

---

### Task 3: `donation.ts`에 중복조회/일괄등록 함수 추가

**Files:**
- Modify: `web/src/lib/donation.ts`

**Interfaces:**
- Consumes: `buildDedupKey` from Task 2 (`./donation-import`)
- Produces: `getExistingDonationsByKey(): Promise<Map<string, { dong: string; ho: string }>>`
- Produces: `interface BulkDonationInput { iso: string; dateOnly: string; amount: number; dong: string; ho: string }`
- Produces: `bulkAddDonations(records: BulkDonationInput[], registrant: string): Promise<void>`

- [ ] **Step 1: import 추가 + 함수 추가**

`web/src/lib/donation.ts` 최상단 import 블록에 추가:

```ts
import { buildDedupKey } from './donation-import';
```

파일 맨 끝(`cancelDonation` 함수 뒤)에 추가:

```ts

// 업로드 미리보기용 — 후원금 시트 전체를 시각+금액 키로 로드 (중복판단)
export async function getExistingDonationsByKey(): Promise<Map<string, { dong: string; ho: string }>> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  const map = new Map<string, { dong: string; ho: string }>();
  if (!sheet) return map;
  const rows = await sheet.getRows();
  for (const row of rows) {
    const key = buildDedupKey(String(row.get('시각') || ''), Number(row.get('금액')) || 0);
    map.set(key, { dong: String(row.get('동') || '').trim(), ho: String(row.get('호수') || '').trim() });
  }
  return map;
}

export interface BulkDonationInput {
  iso: string;
  dateOnly: string;
  amount: number;
  dong: string;
  ho: string;
}

// xlsx 일괄업로드 확정 등록 — addDonation()과 달리 시각을 "지금"이 아니라
// 원본 송금시각(iso, 파라미터로 전달받음) 그대로 저장한다.
export async function bulkAddDonations(records: BulkDonationInput[], registrant: string): Promise<void> {
  if (records.length === 0) return;
  const doc = await getDoc();
  const sheet = await ensureSheet(doc);
  await sheet.addRows(
    records.map((r) => ({
      ID: crypto.randomUUID(),
      시각: r.iso,
      동: r.dong,
      호수: r.ho,
      납부일: r.dateOnly,
      금액: String(r.amount),
      등록자: registrant,
      비고: '',
      상태: '정상',
    })),
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/lib/donation.ts
git commit -m "feat: donation.ts에 중복조회/일괄등록 함수 추가"
```

---

### Task 4: API 라우트 (미리보기/커밋)

**Files:**
- Create: `web/src/app/api/unified/donations/import/preview/route.ts`
- Create: `web/src/app/api/unified/donations/import/commit/route.ts`

**Interfaces:**
- Consumes: `parseImportFile`, `classifyRows`, `buildDedupKey` from Task 2
- Consumes: `getExistingDonationsByKey`, `bulkAddDonations`, `BulkDonationInput` from Task 3
- Produces: `POST /api/unified/donations/import/preview` — multipart `file` → `{ new, review, duplicates }` (각각 `ClassifiedImportRow[]`)
- Produces: `POST /api/unified/donations/import/commit` — `{ records: BulkDonationInput[], registrant: string }` → `{ inserted: number, skipped: number }`

- [ ] **Step 1: preview route 작성**

Create `web/src/app/api/unified/donations/import/preview/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseImportFile, classifyRows } from '@/lib/donation-import';
import { getExistingDonationsByKey } from '@/lib/donation';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseImportFile(buffer);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '파싱 실패' }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ new: [], review: [], duplicates: [] });
  }

  const existing = await getExistingDonationsByKey();
  const classified = classifyRows(parsed, existing);

  return NextResponse.json({
    new: classified.filter((r) => r.classification === 'new'),
    review: classified.filter((r) => r.classification === 'review'),
    duplicates: classified.filter((r) => r.classification === 'duplicate'),
  });
}
```

- [ ] **Step 2: commit route 작성**

Create `web/src/app/api/unified/donations/import/commit/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getExistingDonationsByKey, bulkAddDonations, type BulkDonationInput } from '@/lib/donation';
import { buildDedupKey } from '@/lib/donation-import';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const records: BulkDonationInput[] = body.records ?? [];
  const registrant: string = body.registrant || '엑셀 일괄등록';

  const invalid = records.filter((r) => !r.dong || !r.ho || !r.amount || !r.iso);
  if (invalid.length > 0) {
    return NextResponse.json({ error: '동/호수/금액이 비어있는 레코드가 있습니다.' }, { status: 400 });
  }

  const existing = await getExistingDonationsByKey();
  const toInsert = records.filter((r) => !existing.has(buildDedupKey(r.iso, r.amount)));
  const skipped = records.length - toInsert.length;

  await bulkAddDonations(toInsert, registrant);

  return NextResponse.json({ inserted: toInsert.length, skipped });
}
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/app/api/unified/donations/import/
git commit -m "feat: 후원금 일괄업로드 미리보기/커밋 API 라우트 추가"
```

---

### Task 5: 업로드 페이지 + 미리보기 테이블 UI

**Files:**
- Create: `web/src/components/unified/DonationImportTable.tsx`
- Create: `web/src/app/unified/donations-import/page.tsx`
- Modify: `web/src/app/unified/page.tsx` (진입 링크 추가)

**Interfaces:**
- Consumes: `ClassifiedImportRow` type from Task 2 (`@/lib/donation-import-types`)
- Consumes: `POST /api/unified/donations/import/preview`, `POST /api/unified/donations/import/commit` from Task 4

- [ ] **Step 1: 미리보기 테이블 컴포넌트**

Create `web/src/components/unified/DonationImportTable.tsx`:

```tsx
'use client';

import type { ClassifiedImportRow } from '@/lib/donation-import-types';

export interface EditableRow extends ClassifiedImportRow {
  checked: boolean;
}

interface Props {
  newRows: EditableRow[];
  reviewRows: EditableRow[];
  duplicateCount: number;
  onEdit: (rowIdx: number, field: 'dong' | 'ho', value: string) => void;
  onToggle: (rowIdx: number) => void;
}

function formatTime(iso: string) {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}/${m[2]} ${m[3]}` : iso;
}

function RowTable({
  rows, onEdit, onToggle, showExisting,
}: {
  rows: EditableRow[];
  onEdit: Props['onEdit'];
  onToggle: Props['onToggle'];
  showExisting?: boolean;
}) {
  if (rows.length === 0) return <p className="text-xs text-gray-400">없음</p>;
  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-2"></th>
            <th className="p-2 text-left">시각</th>
            <th className="p-2 text-left">동</th>
            <th className="p-2 text-left">호수</th>
            {showExisting && <th className="p-2 text-left">기존 등록값</th>}
            <th className="p-2 text-right">금액</th>
            <th className="p-2 text-left">원본텍스트</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowIdx} className="border-t border-gray-100">
              <td className="p-2">
                <input type="checkbox" checked={r.checked} onChange={() => onToggle(r.rowIdx)} />
              </td>
              <td className="p-2 whitespace-nowrap">{formatTime(r.iso)}</td>
              <td className="p-2">
                <input
                  className="w-14 border border-gray-200 rounded px-1 py-0.5"
                  value={r.dong}
                  onChange={(e) => onEdit(r.rowIdx, 'dong', e.target.value)}
                />
              </td>
              <td className="p-2">
                <input
                  className="w-16 border border-gray-200 rounded px-1 py-0.5"
                  value={r.ho}
                  onChange={(e) => onEdit(r.rowIdx, 'ho', e.target.value)}
                />
              </td>
              {showExisting && (
                <td className="p-2 text-gray-400">{r.existingDong}/{r.existingHo}</td>
              )}
              <td className="p-2 text-right">{r.amount.toLocaleString()}</td>
              <td className="p-2 text-gray-400 truncate max-w-[200px]">
                {r.sender}{r.memo ? ` (메모: ${r.memo})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DonationImportTable({ newRows, reviewRows, duplicateCount, onEdit, onToggle }: Props) {
  const newSum = newRows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          신규 {newRows.length}건 (합계 {newSum.toLocaleString()}원)
        </h2>
        <RowTable rows={newRows} onEdit={onEdit} onToggle={onToggle} />
      </section>

      {reviewRows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-orange-600 mb-2">확인 필요 {reviewRows.length}건</h2>
          <p className="text-xs text-gray-400 mb-2">
            시각·금액은 기존 등록건과 일치하지만 동/호수가 다릅니다. 확인 후 등록하세요.
          </p>
          <RowTable rows={reviewRows} onEdit={onEdit} onToggle={onToggle} showExisting />
        </section>
      )}

      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer">이미 등록됨 {duplicateCount}건 (자동 제외)</summary>
      </details>
    </div>
  );
}
```

- [ ] **Step 2: 업로드 페이지**

Create `web/src/app/unified/donations-import/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import DonationImportTable from '@/components/unified/DonationImportTable';
import type { EditableRow } from '@/components/unified/DonationImportTable';
import type { ClassifiedImportRow } from '@/lib/donation-import-types';

interface PreviewResponse {
  new: ClassifiedImportRow[];
  review: ClassifiedImportRow[];
  duplicates: ClassifiedImportRow[];
}

export default function DonationsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newRows, setNewRows] = useState<EditableRow[]>([]);
  const [reviewRows, setReviewRows] = useState<EditableRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/unified/donations/import/preview', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '미리보기 실패');
        setNewRows([]);
        setReviewRows([]);
        setDuplicateCount(0);
        return;
      }
      const body = data as PreviewResponse;
      setNewRows(body.new.map((r) => ({ ...r, checked: true })));
      setReviewRows(body.review.map((r) => ({ ...r, checked: false })));
      setDuplicateCount(body.duplicates.length);
    } finally {
      setLoading(false);
    }
  }

  function editField(rowIdx: number, field: 'dong' | 'ho', value: string) {
    setNewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, [field]: value } : r)));
    setReviewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, [field]: value } : r)));
  }

  function toggleRow(rowIdx: number) {
    setNewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, checked: !r.checked } : r)));
    setReviewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, checked: !r.checked } : r)));
  }

  async function handleCommit() {
    const toSubmit = [...newRows, ...reviewRows].filter((r) => r.checked && r.dong && r.ho);
    if (toSubmit.length === 0) {
      alert('등록할 건을 선택해 주세요.');
      return;
    }
    setCommitting(true);
    try {
      const operatorName = typeof window !== 'undefined' ? sessionStorage.getItem('operatorName') : '';
      const registrant = operatorName ? `엑셀 일괄등록(${operatorName})` : '엑셀 일괄등록';
      const res = await fetch('/api/unified/donations/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: toSubmit.map((r) => ({ iso: r.iso, dateOnly: r.dateOnly, amount: r.amount, dong: r.dong, ho: r.ho })),
          registrant,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '등록 실패');
        return;
      }
      setResult(data);
      setNewRows([]);
      setReviewRows([]);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-5xl mx-auto">
        <h1 className="text-lg font-bold text-gray-800 mb-4">후원금 일괄업로드</h1>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="text-xs px-3 py-1.5 rounded bg-[#2F5496] text-white font-semibold disabled:opacity-50"
          >
            {loading ? '분석 중...' : '미리보기'}
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {result && (
          <p className="text-sm text-green-600 mb-4">
            등록 완료: {result.inserted}건 (중복으로 제외됨: {result.skipped}건)
          </p>
        )}

        {(newRows.length > 0 || reviewRows.length > 0 || duplicateCount > 0) && (
          <>
            <DonationImportTable
              newRows={newRows}
              reviewRows={reviewRows}
              duplicateCount={duplicateCount}
              onEdit={editField}
              onToggle={toggleRow}
            />
            <button
              onClick={handleCommit}
              disabled={committing}
              className="mt-4 text-sm px-4 py-2 rounded bg-green-600 text-white font-semibold disabled:opacity-50"
            >
              {committing ? '등록 중...' : '선택한 건 등록'}
            </button>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 3: `/unified` 페이지에 진입 링크 추가**

`web/src/app/unified/page.tsx` 상단 import에 `Link` 추가:

```ts
import Link from 'next/link';
```

`<h1>통합 현황</h1>`과 `<SyncButton .../>` 를 감싸는 부분(파일의 49~52번째 줄 부근)을 다음으로 교체:

```tsx
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">통합 현황</h1>
            <div className="flex items-center gap-2">
              <Link
                href="/unified/donations-import"
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                후원금 일괄업로드
              </Link>
              <SyncButton lastSynced={lastSynced} onSynced={fetchData} />
            </div>
          </div>
```

- [ ] **Step 4: 타입체크 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

Run: `cd web && npm run lint`
Expected: 에러 없음(경고는 허용)

- [ ] **Step 5: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/components/unified/DonationImportTable.tsx web/src/app/unified/donations-import/page.tsx web/src/app/unified/page.tsx
git commit -m "feat: 후원금 일괄업로드 페이지 UI 추가"
```

---

### Task 6: 로컬 실행 + 실제 파일로 엔드투엔드 검증

**Files:** (변경 없음, 검증만)

- [ ] **Step 1: 전체 회귀 테스트 실행**

Run: `cd web && npm test`
Expected: 3개 테스트 파일 모두 `0 fail`

- [ ] **Step 2: dev 서버 기동 확인**

Run: `cd web && lsof -i :3000 -sTCP:LISTEN -t` (이미 실행 중인지 확인)
- 이미 떠 있으면 그대로 사용
- 없으면: `cd web && npm run dev &` 로 백그라운드 기동 후 `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/unified` 로 200 확인

- [ ] **Step 3: 실제 파일로 preview API 직접 검증**

`/Users/leebonggu/Downloads/국민은행자료다운.xls`를 실제 preview API에 업로드해서 분류 결과를 확인한다.

사전 분석(2026-07-02, 이 플랜을 짜기 전 스크립트로 직접 대조)에 따르면 217건 중 198건이 기존 등록 198건과 시각+금액이 일치하는 중복후보다. 그중 7건은 sender 필드만 쓰면 기존값과 안 맞았는데, memo-우선 순위로 바꾸면 6건(row 48/72/105/132/135/164 — 전부 은행이 sender를 표시글자수 제한으로 잘라낸 케이스)은 memo값이 기존 등록값과 정확히 일치해서 `duplicate`로 잡혀야 한다. 나머지 1건(row 68, sender="이광숙"/memo="918/1407")은 sender에 숫자가 아예 없어 처음부터 memo를 썼던 케이스라 우선순위 변경과 무관하고, memo값(918/1407) 자체가 기존 등록값(918/407)과 다르므로 **여전히 `review`로 남아야 정상**이다(이게 바로 스펙에서 말한 "review는 파서가 못 잡는 진짜 불일치를 사람에게 넘기는 안전장치" 사례).

```bash
curl -s -F "file=@/Users/leebonggu/Downloads/국민은행자료다운.xls" http://localhost:3000/api/unified/donations/import/preview \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('new:',j.new.length,'review:',j.review.length,'duplicates:',j.duplicates.length);console.log('new 합계:', j.new.reduce((s,r)=>s+r.amount,0));if(j.review.length)console.log('review 상세:', JSON.stringify(j.review.map(r=>({sender:r.sender,memo:r.memo,dong:r.dong,ho:r.ho,existingDong:r.existingDong,existingHo:r.existingHo}))));})"
```

Expected: `new: 19 review: 1 duplicates: 197`, `new 합계: 890000`, review 상세에 row68(이광숙, memo="918/1407", existingDong=918/existingHo=407) 1건만 나와야 함.
(review 개수가 이거랑 다르게 나오면 — 특히 0건이면 memo-우선 로직이 의도대로 안 걸린 것일 수 있으니 원인을 확인할 것)

- [ ] **Step 4: 브라우저에서 페이지 육안 확인 (가능한 경우)**

`mcp__claude-in-chrome__tabs_context_mcp`로 확장 연결 확인 후, 연결되면:
- `http://localhost:3000/unified/donations-import` 접속
- 로그인(APP_PASSWORD) 후 파일 업로드 → 미리보기 클릭 → 신규 19건이 정확히 표에 표시되는지, "이미 등록됨 198건" 접힌 상태로 나오는지 스크린샷으로 확인
- **등록 버튼은 누르지 않는다** (사용자가 직접 하기로 함)

확장이 연결 안 되면 이 스텝은 생략하고 Step 3의 API 검증 결과로 갈음, 사용자에게 브라우저에서 직접 확인해달라고 안내.

- [ ] **Step 5: 최종 보고**

사용자에게 다음을 보고:
- `npm test` 결과 (pass/fail 개수)
- dev 서버가 로컬에서 실행 중이라는 것과 URL(`http://localhost:3000/unified/donations-import`)
- Step 3 API 검증 결과(신규/확인필요/중복 건수, 이전 수동 분석과 일치 여부)
- **19건 등록은 하지 않았음** — 사용자가 페이지에서 직접 확인 후 등록하기로 합의된 사항임을 재확인
