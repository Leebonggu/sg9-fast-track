# 신분증 사본 업로드 재개 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-06-22에 UI 전체가 숨겨진 신분증 사본 업로드 기능을 재개하되, 최초 1회 제출 후 즉시 잠그고 정정은 관리자가 확인 후 발급하는 1회용 링크로만 가능하게 하며, 업로드 시 전화번호와 개인정보동의 시각을 함께 기록한다.

**Architecture:** 기존 HMAC 토큰(`kakao-verify.ts`)과 `신분증업로드` 시트를 그대로 재사용한다. 새 토큰 체계를 만들지 않고, 시트에 `정정허용시각` 플래그 컬럼 하나를 추가해 "잠금/정정 가능" 상태를 표현한다. 잠금 판정은 항상 서버(시트 상태) 기준이며 토큰 자체엔 잠금 정보가 없다.

**Tech Stack:** Next.js 16 (App Router) / TypeScript / `google-spreadsheet` v5 / 순수 함수 테스트는 `tsx`로 직접 실행 (`npm test`), 기존 컨벤션과 동일.

## Global Constraints

- `web/CLAUDE.md`(`web/AGENTS.md`)가 명시: 이 Next.js 버전은 학습 데이터와 다를 수 있으므로 API 확신이 없으면 `node_modules/next/dist/docs/`를 먼저 확인한다.
- 이 기능은 `OWNER_SPREADSHEET_ID`(통합현황 마스터 스프레드시트) 안의 `신분증업로드` 시트만 건드린다. v2 라이브 시스템(`setup_v2.gs`)과 무관 — 절대 건드리지 않는다.
- `신분증업로드.전화번호`는 통합현황 `연락처` 컬럼과 자동 병합하지 않는다 (설계 문서 결정 사항).
- Apps Script(`survey_generic_webapp.gs`)는 변경하지 않는다 — 재배포 불필요.
- 참고 스펙: `docs/superpowers/specs/2026-07-12-id-upload-relaunch-design.md`

---

### Task 1: 전화번호 검증 공용 유틸

클라이언트 컴포넌트(`IdUploadSection.tsx`)와 서버 전용 모듈(`id-upload.ts`, google-spreadsheet 의존)이 같은 검증 로직을 써야 하는데, `id-upload.ts`를 클라이언트 컴포넌트에서 import하면 서버 전용 의존성이 클라이언트 번들에 섞여 들어간다. 그래서 의존성 없는 별도 파일로 분리한다.

**Files:**
- Create: `web/src/lib/phone-format.ts`
- Test: `web/tests/phone-format.test.ts`

**Interfaces:**
- Produces: `isValidPhone(v: string): boolean` — 숫자만 추출해 9~11자리면 true

- [ ] **Step 1: 실패하는 테스트 작성**

`web/tests/phone-format.test.ts`:
```typescript
/**
 * 회귀 테스트 — 전화번호 형식 검증 (순수 함수)
 * 실행: npm test (또는 tsx tests/phone-format.test.ts)
 */
import { isValidPhone } from '../src/lib/phone-format';

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
console.log(' 회귀 테스트: 전화번호 형식 검증');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

assertEqual('하이픈 포함 정상', isValidPhone('010-1234-5678'), true);
assertEqual('하이픈 없이 정상', isValidPhone('01012345678'), true);
assertEqual('지역번호(9자리)', isValidPhone('021234567'), true);
assertEqual('공백만', isValidPhone('   '), false);
assertEqual('빈 문자열', isValidPhone(''), false);
assertEqual('너무 짧음(8자리)', isValidPhone('1234567'), false);
assertEqual('너무 김(12자리)', isValidPhone('012345678901'), false);
assertEqual('문자 섞임', isValidPhone('010-abcd-5678'), false);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd web && npx tsx tests/phone-format.test.ts`
Expected: `Cannot find module '../src/lib/phone-format'` 에러로 실패

- [ ] **Step 3: 최소 구현 작성**

`web/src/lib/phone-format.ts`:
```typescript
export function isValidPhone(v: string): boolean {
  const digits = v.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 11;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd web && npx tsx tests/phone-format.test.ts`
Expected: `8 pass / 0 fail`

- [ ] **Step 5: package.json test 스크립트에 추가**

`web/package.json`의 `scripts.test`를 수정 (기존 3개 뒤에 이어붙임):
```json
"test": "tsx tests/donation-parser.test.ts && tsx tests/donation-classify.test.ts && tsx tests/donation-import-file.test.ts && tsx tests/phone-format.test.ts"
```

- [ ] **Step 6: 커밋**

```bash
cd web && git add src/lib/phone-format.ts tests/phone-format.test.ts package.json
git commit -m "feat: 전화번호 형식 검증 유틸 추가"
```

---

### Task 2: `id-upload.ts` 데이터 모델 확장 (읽기 경로 + 정정 윈도우 판정)

**Files:**
- Modify: `web/src/lib/id-upload.ts`
- Test: `web/tests/id-upload-correction-window.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 파일 확장)
- Produces:
  - `isCorrectionWindowOpen(allowedAtIso: string, now?: number): boolean`
  - `CORRECTION_WINDOW_MS: number`
  - `IdUploadRecord`에 `consentAt: string`, `phone: string`, `correctionAllowedAt: string` 필드 추가
  - 이후 태스크가 쓸 `ensureHeaders(doc, sheet)` 내부 헬퍼 (export 안 함, 파일 내부에서만 사용)
  - `getIdUploadPhone(dong: string, ho: string, ownerIndex: number): Promise<string>` — 지금은 어디서도 호출하지 않지만, 설계 문서의 "나중에 통합현황 연락처로 병합 가능하게" 결정에 따라 `owner-sheets.ts`를 안 건드리고도 병합 기능을 얹을 수 있도록 미리 분리해 둠

- [ ] **Step 1: 실패하는 테스트 작성**

`web/tests/id-upload-correction-window.test.ts`:
```typescript
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd web && npx tsx tests/id-upload-correction-window.test.ts`
Expected: `isCorrectionWindowOpen` 미정의 에러로 실패

- [ ] **Step 3: `id-upload.ts` 수정**

`web/src/lib/id-upload.ts` 상단 `HEADERS` 선언을 다음으로 교체:
```typescript
const HEADERS = [
  '시각', '동', '호수', '소유자명', '소유자순번', '파일명', '파일ID', 'Drive링크', 'IP', '상태',
  '개인정보동의시각', '전화번호', '정정허용시각',
];

export const CORRECTION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2시간

export function isCorrectionWindowOpen(allowedAtIso: string, now: number = Date.now()): boolean {
  const trimmed = allowedAtIso.trim();
  if (!trimmed) return false;
  const ts = new Date(trimmed).getTime();
  if (isNaN(ts)) return false;
  return now - ts <= CORRECTION_WINDOW_MS;
}
```

`ensureSheet` 함수를 다음으로 교체 (이미 존재하는 라이브 시트에 새 컬럼 3개를 안전하게 추가하기 위함 — 기존 데이터는 건드리지 않고 헤더만 확장):
```typescript
async function ensureHeaders(sheet: import('google-spreadsheet').GoogleSpreadsheetWorksheet) {
  await sheet.loadHeaderRow();
  const missing = HEADERS.filter((h) => !sheet.headerValues.includes(h));
  if (missing.length > 0) {
    await sheet.setHeaderRow([...sheet.headerValues, ...missing]);
  }
}

async function ensureSheet(doc: GoogleSpreadsheet) {
  let sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: HEADERS });
    return sheet;
  }
  await ensureHeaders(sheet);
  return sheet;
}
```

`IdUploadRecord` 인터페이스에 필드 3개 추가:
```typescript
export interface IdUploadRecord {
  timestamp: string;
  dong: string;
  ho: string;
  ownerName: string;
  ownerIndex: number;
  fileName: string;
  fileId: string;
  link: string;
  ip: string;
  status: string;
  consentAt: string;
  phone: string;
  correctionAllowedAt: string;
}
```

`mapRow` 함수를 다음으로 교체:
```typescript
function mapRow(r: import('google-spreadsheet').GoogleSpreadsheetRow): IdUploadRecord {
  return {
    timestamp: String(r.get('시각') || ''),
    dong: String(r.get('동') || '').trim(),
    ho: String(r.get('호수') || '').trim(),
    ownerName: String(r.get('소유자명') || ''),
    ownerIndex: parseInt(String(r.get('소유자순번') || '0'), 10) || 0,
    fileName: String(r.get('파일명') || ''),
    fileId: String(r.get('파일ID') || ''),
    link: String(r.get('Drive링크') || ''),
    ip: String(r.get('IP') || ''),
    status: String(r.get('상태') || ''),
    consentAt: String(r.get('개인정보동의시각') || ''),
    phone: String(r.get('전화번호') || ''),
    correctionAllowedAt: String(r.get('정정허용시각') || ''),
  };
}
```

`mapRow` 바로 아래에 forward-compat 조회 함수 추가 (지금은 어디서도 호출하지 않음 — 나중에 통합현황 연락처 병합 기능을 얹을 때 `owner-sheets.ts`를 안 건드리고 이 함수만 쓰기 위함):
```typescript
export async function getIdUploadPhone(
  dong: string,
  ho: string,
  ownerIndex: number,
): Promise<string> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return '';
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === dong &&
      String(r.get('호수') || '').trim() === ho &&
      (parseInt(String(r.get('소유자순번') || '0'), 10) || 0) === ownerIndex &&
      String(r.get('상태') || '') !== '파기',
  );
  return row ? String(row.get('전화번호') || '') : '';
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd web && npx tsx tests/id-upload-correction-window.test.ts`
Expected: `7 pass / 0 fail`

- [ ] **Step 5: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음 (이 시점엔 `recordIdUpload` 등이 아직 새 필드를 안 쓰므로 기존 타입과 충돌 없어야 함)

- [ ] **Step 6: package.json test 스크립트에 추가**

`web/package.json`의 `scripts.test`에 이어붙임:
```json
"test": "tsx tests/donation-parser.test.ts && tsx tests/donation-classify.test.ts && tsx tests/donation-import-file.test.ts && tsx tests/phone-format.test.ts && tsx tests/id-upload-correction-window.test.ts"
```

- [ ] **Step 7: 커밋**

```bash
cd web && git add src/lib/id-upload.ts tests/id-upload-correction-window.test.ts package.json
git commit -m "feat: 신분증업로드 시트에 동의시각·전화번호·정정허용 컬럼 추가"
```

---

### Task 3: `id-upload.ts` 쓰기 경로 — `recordIdUpload` 확장 + `allowCorrection` 추가

**Files:**
- Modify: `web/src/lib/id-upload.ts`

**Interfaces:**
- Consumes: Task 2의 `ensureHeaders`, `HEADERS`, `IdUploadRecord`
- Produces:
  - `recordIdUpload(rec: { dong, ho, ownerName, ownerIndex, fileName, fileId, link, ip, phone })`: 기존 시그니처에 `phone: string` 필드 추가
  - `allowCorrection(dong: string, ho: string, ownerIndex: number): Promise<boolean>`

- [ ] **Step 1: `recordIdUpload` 수정**

기존 함수 전체를 다음으로 교체 (rec 파라미터에 `phone` 추가, 신규 컬럼 3개 세팅):
```typescript
export async function recordIdUpload(rec: {
  dong: string;
  ho: string;
  ownerName: string;
  ownerIndex: number;
  fileName: string;
  fileId: string;
  link: string;
  ip: string;
  phone: string;
}): Promise<string | null> {
  const doc = await getDoc();
  const sheet = await ensureSheet(doc);
  const rows = await sheet.getRows();
  const now = new Date().toISOString();
  const existing = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === rec.dong &&
      String(r.get('호수') || '').trim() === rec.ho &&
      (parseInt(String(r.get('소유자순번') || '0'), 10) || 0) === rec.ownerIndex &&
      String(r.get('상태') || '') !== '파기',
  );
  if (existing) {
    const prevFileId = String(existing.get('파일ID') || '').trim();
    existing.set('시각', now);
    existing.set('소유자명', rec.ownerName);
    existing.set('파일명', rec.fileName);
    existing.set('파일ID', rec.fileId);
    existing.set('Drive링크', rec.link);
    existing.set('IP', rec.ip);
    existing.set('상태', '제출');
    existing.set('개인정보동의시각', now);
    existing.set('전화번호', rec.phone);
    existing.set('정정허용시각', ''); // 정정으로 재제출된 경우 즉시 재잠금
    await existing.save();
    return prevFileId && prevFileId !== rec.fileId ? prevFileId : null;
  }
  await sheet.addRow({
    시각: now,
    동: rec.dong,
    호수: rec.ho,
    소유자명: rec.ownerName,
    소유자순번: String(rec.ownerIndex),
    파일명: rec.fileName,
    파일ID: rec.fileId,
    Drive링크: rec.link,
    IP: rec.ip,
    상태: '제출',
    개인정보동의시각: now,
    전화번호: rec.phone,
    정정허용시각: '',
  });
  return null;
}
```

- [ ] **Step 2: `allowCorrection` 추가**

`markIdPurged` 함수 바로 아래에 추가:
```typescript
// 관리자: 이미 제출된 슬롯에 대해 1회성 정정 윈도우를 연다 (CORRECTION_WINDOW_MS 동안 재업로드 허용)
export async function allowCorrection(
  dong: string,
  ho: string,
  ownerIndex: number,
): Promise<boolean> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return false;
  await ensureHeaders(sheet);
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) =>
      String(r.get('동') || '').trim() === dong &&
      String(r.get('호수') || '').trim() === ho &&
      (parseInt(String(r.get('소유자순번') || '0'), 10) || 0) === ownerIndex &&
      String(r.get('상태') || '') !== '파기',
  );
  if (!row) return false;
  row.set('정정허용시각', new Date().toISOString());
  await row.save();
  return true;
}
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음. 만약 `POST /api/upload-id`(Task 4에서 아직 안 고침)가 `recordIdUpload` 호출부에서 `phone` 누락으로 타입 에러가 난다면 — 그건 Task 4에서 고칠 것이므로 지금은 그 한 곳의 에러만 있으면 정상.

- [ ] **Step 4: 커밋**

```bash
cd web && git add src/lib/id-upload.ts
git commit -m "feat: recordIdUpload에 전화번호·동의시각 기록, allowCorrection 추가"
```

---

### Task 4: `POST /api/upload-id` — 전화번호 수집 + 잠금 체크

**Files:**
- Modify: `web/src/app/api/upload-id/route.ts`

**Interfaces:**
- Consumes: `isValidPhone` (Task 1, `@/lib/phone-format`), `isCorrectionWindowOpen` (Task 2), `getIdUploads`(기존), `recordIdUpload`(Task 3, `phone` 필수)
- Produces: 슬롯이 잠겨있으면 403 응답 `{ error: string }`

- [ ] **Step 1: import 추가**

`web/src/app/api/upload-id/route.ts` 상단 import 블록에 추가:
```typescript
import { isValidPhone } from '@/lib/phone-format';
import { isCorrectionWindowOpen } from '@/lib/id-upload';
```
(`isCorrectionWindowOpen`은 기존 `import { uploadIdImage, recordIdUpload, getIdUploads, markIdPurged, deleteIdImage } from '@/lib/id-upload';` 줄에 이어붙여도 됨)

- [ ] **Step 2: POST 핸들러 수정**

기존 `POST` 함수의 아래 부분:
```typescript
    const body = await req.json();
    const { t, ownerIndex, ownerName, mimeType, base64 } = body ?? {};
```
을 다음으로 교체:
```typescript
    const body = await req.json();
    const { t, ownerIndex, ownerName, mimeType, base64, phone: rawPhone } = body ?? {};
```

기존:
```typescript
    // 독립적인 3개 시트 읽기를 병렬화 (#1 속도): rate limit / 사전동의 / 소유자
    const [rateLimited, consented, owners] = await Promise.all([
      checkRateLimit(ip),
      isConsented(dong, ho),
      getOwnersByDongHo(dong, ho),
    ]);
```
을 다음으로 교체 (신분증 업로드 현황도 같은 병렬 묶음에 추가 — 잠금 체크에 재사용):
```typescript
    // 독립적인 4개 시트 읽기를 병렬화 (#1 속도): rate limit / 사전동의 / 소유자 / 신분증 현황
    const [rateLimited, consented, owners, existingUploads] = await Promise.all([
      checkRateLimit(ip),
      isConsented(dong, ho),
      getOwnersByDongHo(dong, ho),
      getIdUploads(dong, ho),
    ]);
```

`idx` 계산 및 이름 검증 블록(`const idx = Number(ownerIndex); ...` 부터 소유자 이름 검증까지) **바로 다음**, `fileName` 생성 코드 **이전**에 다음 블록을 삽입 (잠금 체크 + 전화번호 검증):
```typescript
    const phone = typeof rawPhone === 'string' ? rawPhone.trim() : '';
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: '올바른 연락처를 입력해 주세요.' }, { status: 400 });
    }

    const existingForSlot = existingUploads.find((u) => u.ownerIndex === idx);
    if (existingForSlot && !isCorrectionWindowOpen(existingForSlot.correctionAllowedAt)) {
      return NextResponse.json(
        { error: '이미 제출된 슬롯입니다. 수정이 필요하면 위원에게 문의해 주세요.' },
        { status: 403 },
      );
    }
```

`recordIdUpload` 호출부:
```typescript
      recordIdUpload({ dong, ho, ownerName: realName, ownerIndex: idx, fileName, fileId, link, ip }),
```
을 다음으로 교체:
```typescript
      recordIdUpload({ dong, ho, ownerName: realName, ownerIndex: idx, fileName, fileId, link, ip, phone }),
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
cd web && git add src/app/api/upload-id/route.ts
git commit -m "feat: 신분증 업로드에 전화번호 필수화 + 슬롯 잠금 체크"
```

---

### Task 5: `GET /api/upload-id` — 전화번호·정정허용여부 응답에 포함

**Files:**
- Modify: `web/src/app/api/upload-id/route.ts`

**Interfaces:**
- Consumes: `isCorrectionWindowOpen` (이미 Task 4에서 import됨)
- Produces: `GET` 응답의 `uploaded[]` 각 항목에 `phone: string`, `correctionAllowed: boolean` 추가

- [ ] **Step 1: GET 핸들러의 응답 매핑 수정**

기존:
```typescript
    const uploaded = uploads.map((u) => ({
      ownerIndex: u.ownerIndex,
      ownerName: u.ownerName,
      fileName: u.fileName,
      fileId: u.fileId,
      link: u.link,
      timestamp: u.timestamp,
    }));
```
을 다음으로 교체:
```typescript
    const uploaded = uploads.map((u) => ({
      ownerIndex: u.ownerIndex,
      ownerName: u.ownerName,
      fileName: u.fileName,
      fileId: u.fileId,
      link: u.link,
      timestamp: u.timestamp,
      phone: u.phone,
      correctionAllowed: isCorrectionWindowOpen(u.correctionAllowedAt),
    }));
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd web && git add src/app/api/upload-id/route.ts
git commit -m "feat: 신분증 업로드 현황 조회에 전화번호·정정허용여부 포함"
```

---

### Task 6: 관리자 전용 "정정 허용" 라우트

기존 `/api/admin/kakao-link`와 동일한 패턴(미들웨어로 보호되는 관리자 전용 라우트, `createVerifyToken` 재사용)을 따른다. `/api/upload-id`에 pw-in-body 방식을 추가하는 대신, 이미 확립된 더 안전한 미들웨어 게이트 패턴을 새 기능에 적용한다.

**Files:**
- Create: `web/src/app/api/admin/id-correction/route.ts`
- Modify: `web/src/middleware.ts`

**Interfaces:**
- Consumes: `allowCorrection` (Task 3), `createVerifyToken`(기존 `@/lib/kakao-verify`), `appendVerifyLog`(기존 `@/lib/kakao-verify-log`)
- Produces: `POST /api/admin/id-correction` — 성공 시 `{ token: string }`, 실패 시 `{ error: string }`

- [ ] **Step 1: 라우트 파일 작성**

`web/src/app/api/admin/id-correction/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createVerifyToken } from '@/lib/kakao-verify';
import { appendVerifyLog } from '@/lib/kakao-verify-log';
import { getClientIp } from '@/lib/request-ip';
import { allowCorrection } from '@/lib/id-upload';

// 관리자 전용: 이미 제출된 신분증 슬롯에 대해 1회성 정정 윈도우를 연다.
// middleware.ts가 x-app-password 헤더를 검사하므로 여기서 별도 pw 체크 불필요.
export async function POST(req: NextRequest) {
  try {
    const { dong: rawDong, ho: rawHo, ownerIndex } = await req.json();
    if (!rawDong || !rawHo || ownerIndex === undefined) {
      return NextResponse.json({ error: '동, 호수, 소유자 순번이 필요합니다.' }, { status: 400 });
    }

    const dong = String(rawDong).replace(/동$/, '').trim();
    const ho = String(rawHo).trim();
    const idx = Number(ownerIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json({ error: '잘못된 소유자 순번입니다.' }, { status: 400 });
    }

    const ok = await allowCorrection(dong, ho, idx);
    if (!ok) {
      return NextResponse.json({ error: '제출 이력이 없는 슬롯입니다.' }, { status: 404 });
    }

    const token = createVerifyToken(dong, ho);
    await appendVerifyLog(dong, ho, `소유자${idx + 1}`, '어드민발급', getClientIp(req));

    return NextResponse.json({ token });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[admin/id-correction] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 미들웨어 보호 목록에 추가**

`web/src/middleware.ts`의 `PROTECTED_PREFIXES` 배열:
```typescript
const PROTECTED_PREFIXES = [
  '/api/unified',
  '/api/consent',
  '/api/dashboard',
  '/api/building',
  '/api/kakao-verify-logs',
  '/api/admin/kakao-link',
];
```
을 다음으로 교체 (새 항목 1개 추가):
```typescript
const PROTECTED_PREFIXES = [
  '/api/unified',
  '/api/consent',
  '/api/dashboard',
  '/api/building',
  '/api/kakao-verify-logs',
  '/api/admin/kakao-link',
  '/api/admin/id-correction',
];
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 검증 (미들웨어 게이트 확인)**

Run: `cd web && npm run dev` (백그라운드로 실행 후 아래 curl, 끝나면 서버 종료)
```bash
curl -s -X POST http://localhost:3000/api/admin/id-correction \
  -H "Content-Type: application/json" \
  -d '{"dong":"901","ho":"101","ownerIndex":0}'
```
Expected: `{"error":"인증이 필요합니다."}` (pw 헤더 없이 401) — 미들웨어가 정상적으로 막는지 확인

- [ ] **Step 5: 커밋**

```bash
cd web && git add src/app/api/admin/id-correction/route.ts src/middleware.ts
git commit -m "feat: 관리자용 신분증 정정 허용 라우트 추가"
```

---

### Task 7: 주민 화면 — `IdUploadSection.tsx`에 전화번호 입력 + 잠금 UI

**Files:**
- Modify: `web/src/components/IdUploadSection.tsx`

**Interfaces:**
- Consumes: `isValidPhone` (Task 1, `@/lib/phone-format`)
- Produces: `UploadedItem`에 `phone?: string`, `correctionAllowed?: boolean` 추가 (다음 태스크가 이 타입을 그대로 씀)

- [ ] **Step 1: import 및 타입 수정**

파일 상단:
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { isValidPhone } from '@/lib/phone-format';

interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  timestamp: string;
  phone?: string;
  correctionAllowed?: boolean;
}
```

- [ ] **Step 2: `phones` 상태 추가**

`export default function IdUploadSection(...)` 함수 본문 맨 위, 기존 `const [agreed, setAgreed] = useState(false);` 바로 아래에 추가:
```typescript
  const [phones, setPhones] = useState<Record<number, string>>({});
```

- [ ] **Step 3: `handleFile` 함수 수정**

기존:
```typescript
  async function handleFile(index: number, label: string, file: File | null) {
    if (!file) return;
    setError('');
    setBusy(index);
    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch('/api/upload-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, ownerIndex: index, ownerName: label, mimeType, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '업로드에 실패했습니다.');
        return;
      }
      setUploaded((prev) => ({
        ...prev,
        [index]: {
          ownerIndex: index,
          ownerName: label,
          fileName: file.name,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch {
      setError('업로드 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }
```
을 다음으로 교체:
```typescript
  async function handleFile(index: number, label: string, file: File | null) {
    if (!file) return;
    const phone = (phones[index] ?? '').trim();
    if (!isValidPhone(phone)) {
      setError('올바른 연락처를 입력해 주세요.');
      return;
    }
    setError('');
    setBusy(index);
    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch('/api/upload-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, ownerIndex: index, ownerName: label, mimeType, base64, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '업로드에 실패했습니다.');
        return;
      }
      setUploaded((prev) => ({
        ...prev,
        [index]: {
          ownerIndex: index,
          ownerName: label,
          fileName: file.name,
          timestamp: new Date().toISOString(),
          phone,
          correctionAllowed: false,
        },
      }));
    } catch {
      setError('업로드 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }
```

- [ ] **Step 4: 슬롯 렌더링 블록 교체**

기존:
```tsx
        {slots.map(({ index, label }) => {
          const done = uploaded[index];
          const isBusy = busy === index;
          return (
            <div
              key={index}
              className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-700 truncate">{label}</div>
                <div className={`text-[11px] ${done ? 'text-green-600' : 'text-gray-400'}`}>
                  {isBusy
                    ? '업로드 중…'
                    : done
                      ? `✓ 제출됨${done.timestamp ? ` · ${fmtTime(done.timestamp)}` : ''} (다시 올리면 교체)`
                      : '미제출'}
                </div>
              </div>
              <label
                className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer ${
                  agreed && !isBusy
                    ? 'bg-[#2F5496] text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {done ? '재촬영' : '촬영/선택'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={!agreed || isBusy}
                  onChange={(e) => {
                    handleFile(index, label, e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          );
        })}
```
을 다음으로 교체:
```tsx
        {slots.map(({ index, label }) => {
          const done = uploaded[index];
          const isBusy = busy === index;
          const locked = !!done && !done.correctionAllowed;
          const canUploadNow = !done || done.correctionAllowed;
          const phoneValue = phones[index] ?? done?.phone ?? '';
          const phoneOk = isValidPhone(phoneValue);
          return (
            <div
              key={index}
              className="border border-gray-200 rounded-xl px-3 py-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-700 truncate">{label}</div>
                  <div className={`text-[11px] ${done ? 'text-green-600' : 'text-gray-400'}`}>
                    {isBusy
                      ? '업로드 중…'
                      : done
                        ? locked
                          ? `✓ 제출완료${done.timestamp ? ` · ${fmtTime(done.timestamp)}` : ''} · 수정은 위원에게 문의`
                          : `✓ 제출됨${done.timestamp ? ` · ${fmtTime(done.timestamp)}` : ''} (다시 올리면 교체)`
                        : '미제출'}
                  </div>
                </div>
                {canUploadNow && (
                  <label
                    className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer ${
                      agreed && !isBusy && phoneOk
                        ? 'bg-[#2F5496] text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {done ? '재촬영' : '촬영/선택'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={!agreed || isBusy || !phoneOk}
                      onChange={(e) => {
                        handleFile(index, label, e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {canUploadNow && (
                <input
                  type="tel"
                  placeholder="연락처 (010-1234-5678)"
                  value={phoneValue}
                  onChange={(e) => setPhones((prev) => ({ ...prev, [index]: e.target.value }))}
                  disabled={isBusy}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2F5496]"
                />
              )}
            </div>
          );
        })}
```

- [ ] **Step 5: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
cd web && git add src/components/IdUploadSection.tsx
git commit -m "feat: 신분증 업로드에 전화번호 입력 + 제출 후 잠금 UI 추가"
```

---

### Task 8: `check-submission/result/page.tsx` — `IdUploadSection` 재노출

2026-06-22 커밋(`f39d9fb`)이 제거했던 부분을 되살리되, phone/correctionAllowed 필드를 함께 전달한다.

**Files:**
- Modify: `web/src/app/check-submission/result/page.tsx`

**Interfaces:**
- Consumes: `getOwnersByDongHo`(기존 `@/lib/owner-sheets`), `getIdUploads`(기존 `@/lib/id-upload`), `IdUploadSection`(Task 7)

- [ ] **Step 1: import 수정**

기존:
```typescript
import Link from 'next/link';
import { verifyToken } from '@/lib/kakao-verify';
import { getMasterRows } from '@/lib/owner-sheets';
import { getAllSurveyConfigs } from '@/lib/surveys/registry';
import type { UnifiedRow } from '@/lib/unified-types';
```
을 다음으로 교체:
```typescript
import Link from 'next/link';
import { verifyToken } from '@/lib/kakao-verify';
import { getMasterRows, getOwnersByDongHo } from '@/lib/owner-sheets';
import { getIdUploads } from '@/lib/id-upload';
import { getAllSurveyConfigs } from '@/lib/surveys/registry';
import type { UnifiedRow } from '@/lib/unified-types';
import IdUploadSection from '@/components/IdUploadSection';
```

- [ ] **Step 2: `CheckSubmissionResultPage` 함수 내부 수정**

기존 (surveyLabel 계산 직후 ~ `return <ResultView .../>` 까지):
```typescript
  const surveyLabel = (id: string) =>
    displayIdToTitle.get(id) ?? shortSurveyLabel(id);

  return (
    <ResultView
      row={row}
      surveyIds={surveyIds}
      surveyLabel={surveyLabel}
    />
  );
}
```
을 다음으로 교체:
```typescript
  const surveyLabel = (id: string) =>
    displayIdToTitle.get(id) ?? shortSurveyLabel(id);

  // 사전동의 완료 세대에만 신분증 업로드 노출 → 완료 시에만 소유자/현황 조회
  let owners: string[] = [];
  let uploaded: {
    ownerIndex: number;
    ownerName: string;
    fileName: string;
    timestamp: string;
    phone: string;
    correctionAllowed: boolean;
  }[] = [];
  if (row.consent) {
    const [o, ups] = await Promise.all([
      getOwnersByDongHo(result.dong, result.ho),
      getIdUploads(result.dong, result.ho),
    ]);
    owners = o;
    uploaded = ups.map((u) => ({
      ownerIndex: u.ownerIndex,
      ownerName: u.ownerName,
      fileName: u.fileName,
      timestamp: u.timestamp,
      phone: u.phone,
      correctionAllowed: isCorrectionWindowOpen(u.correctionAllowedAt),
    }));
  }

  return (
    <ResultView
      row={row}
      surveyIds={surveyIds}
      surveyLabel={surveyLabel}
      token={t}
      owners={owners}
      uploaded={uploaded}
    />
  );
}
```

이 블록은 `isCorrectionWindowOpen`을 쓰므로, import 목록의 `getIdUploads` 줄을 다음으로 교체:
```typescript
import { getIdUploads, isCorrectionWindowOpen } from '@/lib/id-upload';
```

- [ ] **Step 3: `ResultView` 함수 시그니처 및 본문 수정**

기존:
```typescript
function ResultView({
  row,
  surveyIds,
  surveyLabel,
}: {
  row: UnifiedRow;
  surveyIds: string[];
  surveyLabel: (id: string) => string;
}) {
```
을 다음으로 교체:
```typescript
function ResultView({
  row,
  surveyIds,
  surveyLabel,
  token,
  owners,
  uploaded,
}: {
  row: UnifiedRow;
  surveyIds: string[];
  surveyLabel: (id: string) => string;
  token: string;
  owners: string[];
  uploaded: {
    ownerIndex: number;
    ownerName: string;
    fileName: string;
    timestamp: string;
    phone: string;
    correctionAllowed: boolean;
  }[];
}) {
```

같은 함수 내부, 설문 상태 블록(`</div>` 로 닫히는 `border-t border-gray-100 pt-4 space-y-4` div) 바로 다음, `{hasAnyMissing && (` 블록 바로 이전에 삽입:
```tsx
        {row.consent && (
          <IdUploadSection token={token} owners={owners} initialUploaded={uploaded} />
        )}

```

- [ ] **Step 4: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
cd web && git add src/app/check-submission/result/page.tsx
git commit -m "feat: 제출현황 페이지에 신분증 업로드 섹션 재노출"
```

---

### Task 9: 관리자 화면 — `IdUploadAdmin.tsx`에 전화번호 표시 + "정정 허용" 버튼

**Files:**
- Modify: `web/src/components/unified/IdUploadAdmin.tsx`

**Interfaces:**
- Consumes: `adminFetch`(기존 `@/lib/admin-fetch`), `POST /api/admin/id-correction`(Task 6)

- [ ] **Step 1: import에 `adminFetch` 추가**

기존:
```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
```
을 다음으로 교체:
```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
```

- [ ] **Step 2: `UploadedItem` 인터페이스에 필드 추가**

기존:
```typescript
interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  fileId: string;
  link: string;
  timestamp: string;
}
```
을 다음으로 교체:
```typescript
interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  fileId: string;
  link: string;
  timestamp: string;
  phone: string;
  correctionAllowed: boolean;
}
```

- [ ] **Step 3: "정정 허용" 액션 함수 추가**

`remove` 함수 바로 아래에 추가:
```typescript
  const [correctionLinks, setCorrectionLinks] = useState<Record<number, string>>({});
  const [allowingIdx, setAllowingIdx] = useState<number | null>(null);

  async function requestCorrection(ownerIndex: number) {
    setAllowingIdx(ownerIndex);
    try {
      const res = await adminFetch('/api/admin/id-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho, ownerIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '정정 허용 실패');
        return;
      }
      const link = `${window.location.origin}/check-submission/result?t=${encodeURIComponent(data.token)}`;
      setCorrectionLinks((prev) => ({ ...prev, [ownerIndex]: link }));
      await load();
    } finally {
      setAllowingIdx(null);
    }
  }
```

- [ ] **Step 4: 슬롯 렌더링에 전화번호·버튼·링크 표시 추가**

기존:
```tsx
                <span className="text-xs text-gray-700 flex-1 truncate">{name}</span>
                {u ? (
                  <>
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 underline"
                    >
                      원본
                    </a>
                    <button
                      onClick={() => remove(idx)}
                      className="text-[11px] text-red-500 underline"
                    >
                      폐기
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-gray-400">미제출</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```
을 다음으로 교체:
```tsx
                <span className="text-xs text-gray-700 flex-1 truncate">
                  {name}
                  {u?.phone && <span className="text-gray-400"> · {u.phone}</span>}
                </span>
                {u ? (
                  <>
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 underline"
                    >
                      원본
                    </a>
                    <button
                      onClick={() => remove(idx)}
                      className="text-[11px] text-red-500 underline"
                    >
                      폐기
                    </button>
                    <button
                      onClick={() => requestCorrection(idx)}
                      disabled={allowingIdx === idx}
                      className="text-[11px] text-emerald-600 underline disabled:opacity-50"
                    >
                      {u.correctionAllowed ? '정정 허용됨' : '정정 허용'}
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-gray-400">미제출</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {Object.entries(correctionLinks).map(([idx, link]) => (
        <div key={idx} className="mt-1.5 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          <span className="text-[10px] text-emerald-700 truncate flex-1">{link}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(link)}
            className="text-[10px] text-emerald-700 font-semibold shrink-0"
          >
            복사
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
cd web && git add src/components/unified/IdUploadAdmin.tsx
git commit -m "feat: 관리자 신분증 패널에 전화번호 표시 + 정정 허용 버튼 추가"
```

---

### Task 10: `EditRowModal.tsx` — `IdUploadAdmin` 재노출

2026-06-22 커밋이 제거한 부분을 되살린다 (컴포넌트 자체는 삭제된 적 없음, import/사용만 없앴었음).

**Files:**
- Modify: `web/src/components/unified/EditRowModal.tsx`

- [ ] **Step 1: import 추가**

기존:
```typescript
'use client';

import { useEffect, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import DonationPanel from './DonationPanel';
import { adminFetch } from '@/lib/admin-fetch';
```
을 다음으로 교체:
```typescript
'use client';

import { useEffect, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import DonationPanel from './DonationPanel';
import IdUploadAdmin from './IdUploadAdmin';
import { adminFetch } from '@/lib/admin-fetch';
```

- [ ] **Step 2: 컴포넌트 배치**

기존 "원본 시트가 직접 수정됩니다" 경고 박스(`<div className="mt-2 rounded bg-amber-50 ...">`) 바로 위에 삽입:
```tsx
        <IdUploadAdmin dong={row.dong} ho={row.ho} />

```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
cd web && git add src/components/unified/EditRowModal.tsx
git commit -m "feat: 세대 수정 모달에 신분증 열람·정정 패널 재노출"
```

---

### Task 11: `UnifiedFilters.tsx` / `UnifiedSummary.tsx` — 필터·요약카드 재노출

2026-06-22 커밋이 제거한 부분을 되살린다. 로직(`applyFilter`의 `no-id` 케이스, `UnifiedSummary`의 `idDoneCount` 계산)은 이미 살아있으므로 화면 요소만 복원한다.

**Files:**
- Modify: `web/src/components/unified/UnifiedFilters.tsx`
- Modify: `web/src/components/unified/UnifiedSummary.tsx`

- [ ] **Step 1: `UnifiedFilters.tsx`에 필터 버튼 복원**

기존:
```typescript
  const baseFilters: { key: FilterType; label: string; variant?: 'blue' | 'orange' | 'green' | 'red' }[] = [
    { key: 'all', label: '전체' },
    { key: 'incomplete', label: '하나라도 미완료' },
    { key: 'no-consent', label: '동의서 미제출' },
    { key: 'no-donation', label: '후원금 미납부' },
```
을 다음으로 교체 (`no-id` 항목 삽입):
```typescript
  const baseFilters: { key: FilterType; label: string; variant?: 'blue' | 'orange' | 'green' | 'red' }[] = [
    { key: 'all', label: '전체' },
    { key: 'incomplete', label: '하나라도 미완료' },
    { key: 'no-consent', label: '동의서 미제출' },
    { key: 'no-id', label: '신분증 미제출' },
    { key: 'no-donation', label: '후원금 미납부' },
```

- [ ] **Step 2: `UnifiedSummary.tsx`에 통계 카드 복원**

기존 (surveyCounts 카드들을 렌더링하는 `.map` 블록 바로 다음, 닫는 `</div>` 이전):
```tsx
          </div>
        </div>
      ))}
    </div>
  );
}
```
을 다음으로 교체:
```tsx
          </div>
        </div>
      ))}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="text-xs text-gray-400">신분증 제출(동의세대)</div>
        <div className="text-lg font-bold text-emerald-600">
          {idDoneCount.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">
            / {consentCount.toLocaleString()} · {consentPct(idDoneCount)}%
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음 (이 시점에 `idDoneCount`가 실제로 쓰이므로 기존의 "계산되지만 미사용" 상태였던 dead code 경고도 해소됨)

- [ ] **Step 4: 커밋**

```bash
cd web && git add src/components/unified/UnifiedFilters.tsx src/components/unified/UnifiedSummary.tsx
git commit -m "feat: 통합현황 대시보드에 신분증 미제출 필터·통계 재노출"
```

---

### Task 12: 전체 검증 + 수동 스모크 테스트

Google Sheets I/O가 실제 라이브 스프레드시트에 의존하므로 자동화된 통합 테스트는 없다 (기존 컨벤션과 동일 — `donation-*.test.ts`도 순수 로직만 테스트). 이 태스크는 순수 로직 테스트 전체 실행 + 빌드 확인 + 실제 앱을 띄운 수동 체크리스트로 구성한다.

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 유닛 테스트 실행**

Run: `cd web && npm test`
Expected: 모든 테스트 스위트(`donation-parser`, `donation-classify`, `donation-import-file`, `phone-format`, `id-upload-correction-window`) 통과, 실패 0건

- [ ] **Step 2: 린트**

Run: `cd web && npm run lint`
Expected: 에러 없음 (`idDoneCount` 등 관련 미사용 변수 경고가 있었다면 Task 11에서 이미 해소됨)

- [ ] **Step 3: 빌드**

Run: `cd web && npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 수동 스모크 테스트 (dev 서버, 실제 스프레드시트 대상)**

Run: `cd web && npm run dev`

체크리스트 (테스트용 세대 하나를 정해서 — 사전동의 완료된 세대):
1. `/check-submission`에서 해당 동/호/이름 입력 → 결과 페이지 진입
2. 신분증 업로드 섹션이 보이는지, 소유자 슬롯마다 전화번호 입력란이 있는지 확인
3. 개인정보 동의 체크 없이 파일 선택 버튼이 비활성 상태인지 확인
4. 동의 체크 후 전화번호 없이 파일 선택 시도 → 비활성 유지 확인
5. 올바른 전화번호 입력 + 사진 업로드 → "제출완료 · 수정은 위원에게 문의"로 바뀌고 재촬영 버튼이 사라지는지 확인
6. 같은 페이지를 새로고침(토큰 재사용) → 다시 업로드를 시도해도(개발자도구로 강제) 서버가 403을 반환하는지 확인 (버튼이 없으므로 UI로는 재현 어려움 — curl로 직접 `POST /api/upload-id` 확인 가능)
7. `/unified`에서 그 세대를 열어 `EditRowModal` → 신분증 패널에 방금 올린 사진·전화번호가 보이는지 확인
8. "정정 허용" 클릭 → 초록색 링크 박스가 뜨는지, "복사" 버튼이 동작하는지 확인
9. 그 링크로 `/check-submission/result?t=...` 접속 → 이번엔 재촬영 버튼이 다시 보이는지 확인
10. 재업로드 완료 → 다시 잠기는지(재촬영 버튼 사라짐) 확인
11. `/unified` 요약 카드에 "신분증 제출(동의세대)" 카드가, 필터에 "신분증 미제출" 버튼이 보이는지 확인
12. `/unified/id-print?dong=...&ho=...`가 여전히 정상 동작하는지 확인 (변경 안 했으므로 회귀 확인 목적)

- [ ] **Step 5: 결과 보고**

체크리스트 12개 항목 중 실패한 항목이 있으면 해당 태스크로 돌아가 수정. 전부 통과하면 완료.
