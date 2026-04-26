# 통합 소유자 현황 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전체 2,830세대 소유자 목록 기준으로 신통기획접수·사전동의·설문 참여 현황을 동별로 조회하고 메모를 관리하는 통합 대시보드를 기존 Next.js 웹앱에 추가한다.

**Architecture:** 소스 시트들(신통접수·사전동의·설문)을 매 요청마다 join하지 않고, sync 시 한 번 join 결과를 마스터 시트(통합현황)에 materialized view로 저장한다. 웹앱은 마스터 시트 하나만 읽어 빠른 응답을 보장한다. 메모는 마스터 시트에 직접 쓰며 sync 시 보존된다.

**Tech Stack:** Next.js (web/), google-spreadsheet, TypeScript, Tailwind CSS. 기존 `getServiceAccountAuth()`, `BUILDING_CONFIG`, `getAllSurveyConfigs()` 패턴 재사용.

---

## 파일 맵

| 파일 | 상태 | 역할 |
|------|------|------|
| `web/.env.local` | 수정 | OWNER_SPREADSHEET_ID, SINSONG_SPREADSHEET_ID 추가 |
| `web/vercel.json` | 수정 | sync-unified cron 추가 |
| `web/src/lib/unified-types.ts` | 신규 | 공통 타입 정의 |
| `web/src/lib/unified-utils.ts` | 신규 | applyFilter 공유 유틸 |
| `web/src/lib/owner-sheets.ts` | 신규 | 소유자 원본 읽기 + 마스터 시트 R/W |
| `web/src/lib/sinsong-sheets.ts` | 신규 | 신통기획접수 동별 시트 읽기 |
| `web/src/lib/sheets.ts` | 수정 | getConsentKeyset() 추가 |
| `web/src/lib/survey-sheets.ts` | 수정 | getSurveyKeyset() 추가 |
| `web/src/lib/notifier.ts` | 신규 | SyncNotifier 인터페이스 + WebToastNotifier |
| `web/src/lib/unified-sync.ts` | 신규 | join 로직 + 마스터 시트 upsert |
| `web/src/app/api/unified/route.ts` | 신규 | GET /api/unified |
| `web/src/app/api/unified/sync/route.ts` | 신규 | POST /api/unified/sync |
| `web/src/app/api/unified/memo/route.ts` | 신규 | PATCH /api/unified/memo |
| `web/src/app/api/cron/sync-unified/route.ts` | 신규 | GET /api/cron/sync-unified |
| `web/src/components/unified/UnifiedSidebar.tsx` | 신규 | 전체/동 선택 사이드바 |
| `web/src/components/unified/UnifiedSummary.tsx` | 신규 | 항목별 완료율 요약 카드 |
| `web/src/components/unified/UnifiedFilters.tsx` | 신규 | 필터 탭 (전체/미완료/신통미완료 등) |
| `web/src/components/unified/UnifiedTable.tsx` | 신규 | 세대 목록 테이블 |
| `web/src/components/unified/MemoCell.tsx` | 신규 | 인라인 메모 편집 셀 |
| `web/src/components/unified/SyncButton.tsx` | 신규 | 동기화 버튼 + 마지막 동기화 시간 |
| `web/src/app/unified/page.tsx` | 신규 | /unified (전체 뷰) |
| `web/src/app/unified/[dong]/page.tsx` | 신규 | /unified/901동 (동별 뷰) |
| `web/src/components/AdminNav.tsx` | 수정 | "통합현황" 탭 추가 |

---

## 사전 준비 (코드 작업 전 사용자가 할 일)

- [ ] Google Sheets `1XEzLst8e-NVxakcC4dbzZvq2WykRul2oRG084SHhVic` 에서:
  - "원본" 시트: Excel 파일 임포트 (헤더 행 포함)
  - "통합현황" 시트: 빈 시트 추가
- [ ] 서비스 계정에 편집자 권한: `rebuild@rebuild-492516.iam.gserviceaccount.com`
- [ ] 신통기획접수 스프레드시트 ID 확인
- [ ] 신통기획접수 시트에서 호수 컬럼명 확인 (기본값 `호수` 가정)

---

## Task 1: 환경변수 + 공통 타입

**Files:**
- Modify: `web/.env.local`
- Create: `web/src/lib/unified-types.ts`

- [ ] **Step 1: .env.local에 env 변수 추가**

```bash
# web/.env.local 에 아래 두 줄 추가
OWNER_SPREADSHEET_ID=1XEzLst8e-NVxakcC4dbzZvq2WykRul2oRG084SHhVic
SINSONG_SPREADSHEET_ID=<신통기획접수_스프레드시트_ID>
```

- [ ] **Step 2: unified-types.ts 생성**

```typescript
// web/src/lib/unified-types.ts

export interface OwnerRow {
  dong: string      // "901" (동 숫자만, "동" 접미사 없음)
  ho: string        // "101"
  ownerName: string
  residency: string // "실거주" | "임대"
}

export interface UnifiedRow extends OwnerRow {
  sinsong: boolean
  consent: boolean
  surveys: Record<string, boolean>  // { 'survey-001': true }
  memo: string
  lastSynced: string
}

export interface SyncResult {
  syncedAt: string
  totalRows: number
  updatedRows: number
  durationMs: number
}

export interface SyncNotifier {
  notify(result: SyncResult): Promise<void>
}

export type FilterType = 'all' | 'incomplete' | 'no-sinsong' | 'no-consent' | string
```

- [ ] **Step 3: TypeScript 타입 오류 없는지 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: 새 파일 관련 오류 없음 (파일이 아직 import되지 않았으므로)

- [ ] **Step 4: 커밋**

```bash
git add web/src/lib/unified-types.ts
git commit -m "feat: unified-types 공통 타입 정의"
```

---

## Task 2: owner-sheets.ts — 소유자 원본 읽기 + 마스터 시트 R/W

**Files:**
- Create: `web/src/lib/owner-sheets.ts`

> 소유자 원본 시트 컬럼명: `동`(숫자값 "901"), `호수`, `소유자1 (성명)`, `실거주여부`
> 마스터 시트명: `통합현황`
> 두 시트 모두 OWNER_SPREADSHEET_ID 스프레드시트 안에 있음

- [ ] **Step 1: owner-sheets.ts 생성**

```typescript
// web/src/lib/owner-sheets.ts
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import type { OwnerRow, UnifiedRow } from './unified-types';

let ownerDocCache: GoogleSpreadsheet | null = null;

async function getOwnerDoc(): Promise<GoogleSpreadsheet> {
  if (ownerDocCache) return ownerDocCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  ownerDocCache = doc;
  return doc;
}

// 소유자 원본 시트("원본")에서 2,830행 읽기
export async function getOwners(): Promise<OwnerRow[]> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['원본'];
  if (!sheet) throw new Error('원본 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  return rows
    .map((row) => ({
      dong: String(row.get('동') || '').trim(),
      ho: String(row.get('호수') || '').trim(),
      ownerName: String(row.get('소유자1 (성명)') || '').trim(),
      residency: String(row.get('실거주여부') || '').trim(),
    }))
    .filter((r) => r.dong && r.ho);
}

// 마스터 시트("통합현황")에서 현재 메모 맵 읽기 (sync 전 보존용)
export async function getMemoMap(): Promise<Map<string, string>> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return new Map();
  const rows = await sheet.getRows();
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = `${row.get('동')}-${row.get('호수')}`;
    const memo = String(row.get('메모') || '');
    if (memo) map.set(key, memo);
  }
  return map;
}

// 마스터 시트("통합현황") 전체 overwrite
export async function writeMasterRows(
  rows: UnifiedRow[],
  surveyIds: string[],
): Promise<void> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) throw new Error('통합현황 시트를 찾을 수 없습니다.');

  const headers = [
    '동', '호수', '소유자명', '실거주여부',
    '신통접수_완료', '사전동의_완료',
    ...surveyIds.map((id) => `${id}_완료`),
    '메모', '마지막_동기화',
  ];

  // 헤더 설정 (변경됐을 때만)
  await sheet.setHeaderRow(headers);

  // 기존 데이터 행 전체 삭제
  const existingRows = await sheet.getRows();
  for (let i = existingRows.length - 1; i >= 0; i--) {
    await existingRows[i].delete();
  }

  // 새 데이터 500행씩 배치 추가
  const data = rows.map((r) => ({
    동: r.dong,
    호수: r.ho,
    소유자명: r.ownerName,
    실거주여부: r.residency,
    신통접수_완료: r.sinsong ? 'TRUE' : 'FALSE',
    사전동의_완료: r.consent ? 'TRUE' : 'FALSE',
    ...Object.fromEntries(
      surveyIds.map((id) => [`${id}_완료`, r.surveys[id] ? 'TRUE' : 'FALSE']),
    ),
    메모: r.memo,
    마지막_동기화: r.lastSynced,
  }));

  for (let i = 0; i < data.length; i += 500) {
    await sheet.addRows(data.slice(i, i + 500));
  }
}

// 특정 세대 메모만 업데이트
export async function updateMemo(dong: string, ho: string, memo: string): Promise<void> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) throw new Error('통합현황 시트를 찾을 수 없습니다.');
  const rows = await sheet.getRows();
  const row = rows.find(
    (r) => String(r.get('동')) === dong && String(r.get('호수')) === ho,
  );
  if (!row) throw new Error(`${dong}동 ${ho}호를 찾을 수 없습니다.`);
  row.set('메모', memo);
  await row.save();
}

// 마스터 시트 전체 읽기 (API에서 사용)
export async function getMasterRows(): Promise<{ rows: UnifiedRow[]; surveyIds: string[] }> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle['통합현황'];
  if (!sheet) return { rows: [], surveyIds: [] };

  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const surveyIds = headers
    .filter((h) => h.endsWith('_완료') && h.startsWith('survey-'))
    .map((h) => h.replace('_완료', ''));

  const sheetRows = await sheet.getRows();
  const rows: UnifiedRow[] = sheetRows.map((row) => ({
    dong: String(row.get('동') || ''),
    ho: String(row.get('호수') || ''),
    ownerName: String(row.get('소유자명') || ''),
    residency: String(row.get('실거주여부') || ''),
    sinsong: row.get('신통접수_완료') === 'TRUE',
    consent: row.get('사전동의_완료') === 'TRUE',
    surveys: Object.fromEntries(
      surveyIds.map((id) => [id, row.get(`${id}_완료`) === 'TRUE']),
    ),
    memo: String(row.get('메모') || ''),
    lastSynced: String(row.get('마지막_동기화') || ''),
  }));

  return { rows, surveyIds };
}
```

- [ ] **Step 2: 타입 오류 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | grep owner-sheets
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add web/src/lib/owner-sheets.ts
git commit -m "feat: owner-sheets - 소유자 원본 읽기 및 마스터 시트 R/W"
```

---

## Task 3: sinsong-sheets.ts — 신통기획접수 읽기

**Files:**
- Create: `web/src/lib/sinsong-sheets.ts`

> 신통기획접수 시트: 동별로 시트 분리. 시트명 형식은 v2와 동일하게 "901동" 가정.
> 호수 컬럼명: "호수" 가정. 실제 시트 확인 후 다를 경우 수정 필요.

- [ ] **Step 1: sinsong-sheets.ts 생성**

```typescript
// web/src/lib/sinsong-sheets.ts
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import { BUILDING_CONFIG } from './buildings';

let sinsongDocCache: GoogleSpreadsheet | null = null;

async function getSinsongDoc(): Promise<GoogleSpreadsheet> {
  if (sinsongDocCache) return sinsongDocCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.SINSONG_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  sinsongDocCache = doc;
  return doc;
}

// 신통기획접수 완료 세대 키셋 반환: Set<"901-101">
// 시트명: "901동", 호수 컬럼: "호수"
export async function getSinsongKeyset(): Promise<Set<string>> {
  const doc = await getSinsongDoc();
  const dongs = Object.keys(BUILDING_CONFIG); // ["901동", "902동", ...]
  const result = new Set<string>();

  for (const dongKey of dongs) {
    const dongNum = dongKey.replace('동', ''); // "901동" → "901"
    const sheet = doc.sheetsByTitle[dongKey];
    if (!sheet) continue;
    const rows = await sheet.getRows();
    for (const row of rows) {
      const ho = String(row.get('호수') || '').trim();
      if (ho) result.add(`${dongNum}-${ho}`);
    }
  }

  return result;
}
```

- [ ] **Step 2: 타입 오류 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | grep sinsong-sheets
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add web/src/lib/sinsong-sheets.ts
git commit -m "feat: sinsong-sheets - 신통기획접수 완료 키셋 읽기"
```

---

## Task 4: 기존 lib 확장 — 사전동의 + 설문 키셋 추가

**Files:**
- Modify: `web/src/lib/sheets.ts`
- Modify: `web/src/lib/survey-sheets.ts`

> v2 동별 시트명: "901동" (BUILDING_CONFIG 키와 동일, 기존 getBuildingData 패턴 참고)
> survey 통합응답 시트: 동 컬럼명 "동" (값: "901동"), 호 컬럼명 "호"

- [ ] **Step 1: sheets.ts 하단에 getConsentKeyset 추가**

```typescript
// web/src/lib/sheets.ts 하단에 추가

// 사전동의 완료 세대 키셋 반환: Set<"901-101">
export async function getConsentKeyset(): Promise<Set<string>> {
  const doc = await getDoc();
  const dongs = Object.keys(BUILDING_CONFIG); // ["901동", "902동", ...]
  const result = new Set<string>();

  for (const dongKey of dongs) {
    const dongNum = dongKey.replace('동', ''); // "901동" → "901"
    const sheet = doc.sheetsByTitle[dongKey];
    if (!sheet) continue;
    const rows = await sheet.getRows();
    for (const row of rows) {
      const ho = String(row.get('호수') || '').trim();
      if (ho) result.add(`${dongNum}-${ho}`);
    }
  }

  return result;
}
```

- [ ] **Step 2: survey-sheets.ts 하단에 getSurveyKeyset 추가**

```typescript
// web/src/lib/survey-sheets.ts 하단에 추가

// 특정 설문 완료 세대 키셋 반환: Set<"901-101">
// 통합응답 시트: 동 컬럼 "동" (값: "901동"), 호 컬럼 "호"
export async function getSurveyKeyset(config: SurveyConfig): Promise<Set<string>> {
  const doc = await getSurveyDoc(config);
  const sheet = getUnifiedSheet(doc);
  const rows = await sheet.getRows();
  const result = new Set<string>();
  for (const row of rows) {
    const dongRaw = String(row.get('동') || '').trim();
    const dongNum = dongRaw.replace('동', ''); // "901동" → "901", "901" → "901"
    const ho = String(row.get('호') || '').trim();
    if (dongNum && ho) result.add(`${dongNum}-${ho}`);
  }
  return result;
}
```

- [ ] **Step 3: 타입 오류 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -E "sheets.ts|survey-sheets"
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add web/src/lib/sheets.ts web/src/lib/survey-sheets.ts
git commit -m "feat: getConsentKeyset, getSurveyKeyset 추가"
```

---

## Task 5: notifier.ts + unified-sync.ts

**Files:**
- Create: `web/src/lib/notifier.ts`
- Create: `web/src/lib/unified-sync.ts`

- [ ] **Step 1: notifier.ts 생성**

```typescript
// web/src/lib/notifier.ts
import type { SyncNotifier, SyncResult } from './unified-types';

// 기본 구현: API 응답에 결과 포함 (프론트에서 토스트 표시)
export class WebToastNotifier implements SyncNotifier {
  async notify(_result: SyncResult): Promise<void> {
    // 결과는 API 응답 body로 반환되므로 별도 동작 없음
  }
}

// 플러그인 자리 — 외부 알림 수단 확정 시 추가
// export class KakaoNotifier implements SyncNotifier { ... }
// export class EmailNotifier implements SyncNotifier { ... }
// export class SlackNotifier implements SyncNotifier { ... }

export const notifiers: SyncNotifier[] = [new WebToastNotifier()];
```

- [ ] **Step 2: unified-sync.ts 생성**

```typescript
// web/src/lib/unified-sync.ts
import { getOwners, getMemoMap, writeMasterRows } from './owner-sheets';
import { getSinsongKeyset } from './sinsong-sheets';
import { getConsentKeyset } from './sheets';
import { getSurveyKeyset } from './survey-sheets';
import { getAllSurveyConfigs } from './surveys/registry';
import { notifiers } from './notifier';
import type { UnifiedRow, SyncResult } from './unified-types';

export async function syncMasterSheet(): Promise<SyncResult> {
  const startedAt = Date.now();
  const syncedAt = new Date().toISOString();

  // 1. 소스 시트들 병렬 읽기
  const surveyConfigs = getAllSurveyConfigs();
  const [owners, memoMap, sinsongKeys, consentKeys, ...surveyKeysets] =
    await Promise.all([
      getOwners(),
      getMemoMap(),
      getSinsongKeyset(),
      getConsentKeyset(),
      ...surveyConfigs.map((c) => getSurveyKeyset(c)),
    ]);

  const surveyIds = surveyConfigs.map((c) => c.id);

  // 2. Join
  const rows: UnifiedRow[] = owners.map((owner) => {
    const key = `${owner.dong}-${owner.ho}`;
    const surveys: Record<string, boolean> = {};
    surveyIds.forEach((id, i) => {
      surveys[id] = surveyKeysets[i].has(key);
    });
    return {
      ...owner,
      sinsong: sinsongKeys.has(key),
      consent: consentKeys.has(key),
      surveys,
      memo: memoMap.get(key) || '',
      lastSynced: syncedAt,
    };
  });

  // 3. 마스터 시트 overwrite
  await writeMasterRows(rows, surveyIds);

  const result: SyncResult = {
    syncedAt,
    totalRows: rows.length,
    updatedRows: rows.length,
    durationMs: Date.now() - startedAt,
  };

  // 4. 알림
  await Promise.all(notifiers.map((n) => n.notify(result)));

  return result;
}
```

- [ ] **Step 3: 타입 오류 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -E "notifier|unified-sync"
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add web/src/lib/notifier.ts web/src/lib/unified-sync.ts
git commit -m "feat: unified-sync - join 로직 및 마스터 시트 upsert"
```

---

## Task 6: API 라우트 4개

**Files:**
- Create: `web/src/app/api/unified/route.ts`
- Create: `web/src/app/api/unified/sync/route.ts`
- Create: `web/src/app/api/unified/memo/route.ts`
- Create: `web/src/app/api/cron/sync-unified/route.ts`

- [ ] **Step 1: GET /api/unified 생성**

```typescript
// web/src/app/api/unified/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMasterRows } from '@/lib/owner-sheets';

export async function GET(req: NextRequest) {
  const dong = req.nextUrl.searchParams.get('dong'); // "901" or null
  const { rows, surveyIds } = await getMasterRows();
  const filtered = dong ? rows.filter((r) => r.dong === dong) : rows;
  return NextResponse.json({ rows: filtered, surveyIds });
}
```

- [ ] **Step 2: POST /api/unified/sync 생성**

```typescript
// web/src/app/api/unified/sync/route.ts
import { NextResponse } from 'next/server';
import { syncMasterSheet } from '@/lib/unified-sync';

export async function POST() {
  const result = await syncMasterSheet();
  return NextResponse.json({ success: true, result });
}
```

- [ ] **Step 3: PATCH /api/unified/memo 생성**

```typescript
// web/src/app/api/unified/memo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateMemo } from '@/lib/owner-sheets';

export async function PATCH(req: NextRequest) {
  const { dong, ho, memo } = await req.json();
  if (!dong || !ho || memo === undefined) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  await updateMemo(String(dong), String(ho), String(memo));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: GET /api/cron/sync-unified 생성**

```typescript
// web/src/app/api/cron/sync-unified/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncMasterSheet } from '@/lib/unified-sync';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await syncMasterSheet();
  console.log(`[cron] 통합현황 동기화 완료: ${result.updatedRows}건`, result);
  return NextResponse.json({ success: true, result });
}
```

- [ ] **Step 5: 타입 오류 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "api/unified"
```

Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add web/src/app/api/unified/ web/src/app/api/cron/sync-unified/
git commit -m "feat: unified API 라우트 4개 추가"
```

---

## Task 7: UI 컴포넌트 6개

**Files:**
- Create: `web/src/components/unified/` 하위 6개 파일

> 기존 AdminNav 스타일: Tailwind, `text-[#2F5496]` 액티브 컬러.
> 기존 survey 컴포넌트 구조 참고 (SurveyDetailTabs.tsx 등).

- [ ] **Step 1: UnifiedSidebar.tsx 생성**

```typescript
// web/src/components/unified/UnifiedSidebar.tsx
'use client';

import Link from 'next/link';
import { BUILDING_CONFIG } from '@/lib/buildings';

interface Props {
  selectedDong: string | null; // null = 전체
}

export default function UnifiedSidebar({ selectedDong }: Props) {
  const dongs = Object.keys(BUILDING_CONFIG); // ["901동", ...]

  return (
    <aside className="w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-2 text-xs text-gray-400 text-center pt-4">동 선택</div>
      <Link
        href="/unified"
        className={`mx-2 mb-1 py-2 text-center text-xs font-medium rounded-md transition-colors ${
          !selectedDong
            ? 'bg-[#2F5496] text-white'
            : 'bg-white text-gray-500 hover:bg-gray-100'
        }`}
      >
        전체
      </Link>
      {dongs.map((dongKey) => {
        const dongNum = dongKey.replace('동', '');
        return (
          <Link
            key={dongKey}
            href={`/unified/${dongNum}`}
            className={`mx-2 mb-1 py-2 text-center text-xs font-medium rounded-md transition-colors ${
              selectedDong === dongNum
                ? 'bg-[#2F5496] text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            {dongNum}동
          </Link>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 2: UnifiedSummary.tsx 생성**

```typescript
// web/src/components/unified/UnifiedSummary.tsx
import type { UnifiedRow } from '@/lib/unified-types';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
}

export default function UnifiedSummary({ rows, surveyIds }: Props) {
  const total = rows.length;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

  const sinsongCount = rows.filter((r) => r.sinsong).length;
  const consentCount = rows.filter((r) => r.consent).length;
  const surveyCounts = surveyIds.map((id) => ({
    id,
    count: rows.filter((r) => r.surveys[id]).length,
  }));

  return (
    <div className="flex gap-3 flex-wrap mb-4">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
        <div className="text-xs text-gray-400">전체</div>
        <div className="text-lg font-bold text-gray-800">{total.toLocaleString()}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
        <div className="text-xs text-gray-400">신통접수</div>
        <div className="text-lg font-bold text-green-600">
          {sinsongCount.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">{pct(sinsongCount)}%</span>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
        <div className="text-xs text-gray-400">사전동의</div>
        <div className="text-lg font-bold text-amber-500">
          {consentCount.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">{pct(consentCount)}%</span>
        </div>
      </div>
      {surveyCounts.map(({ id, count }) => (
        <div key={id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
          <div className="text-xs text-gray-400">{id}</div>
          <div className="text-lg font-bold text-blue-500">
            {count.toLocaleString()}
            <span className="text-xs text-gray-400 ml-1">{pct(count)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: UnifiedFilters.tsx 생성**

```typescript
// web/src/components/unified/UnifiedFilters.tsx
'use client';

import type { FilterType } from '@/lib/unified-types';

interface Props {
  active: FilterType;
  surveyIds: string[];
  onChange: (f: FilterType) => void;
}

export default function UnifiedFilters({ active, surveyIds, onChange }: Props) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'incomplete', label: '미완료' },
    { key: 'no-sinsong', label: '신통 미완료' },
    { key: 'no-consent', label: '동의 미완료' },
    ...surveyIds.map((id) => ({ key: `no-${id}` as FilterType, label: `${id} 미완료` })),
  ];

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
            active === key
              ? 'bg-[#2F5496] text-white border-[#2F5496]'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: MemoCell.tsx 생성**

```typescript
// web/src/components/unified/MemoCell.tsx
'use client';

import { useState } from 'react';

interface Props {
  dong: string;
  ho: string;
  initialMemo: string;
}

export default function MemoCell({ dong, ho, initialMemo }: Props) {
  const [memo, setMemo] = useState(initialMemo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveMemo(value: string) {
    setSaving(true);
    await fetch('/api/unified/memo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dong, ho, memo: value }),
    });
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 outline-none"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => saveMemo(memo)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveMemo(memo);
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded px-1 py-0.5 min-h-[20px]"
    >
      {memo || <span className="text-gray-300">메모 추가</span>}
    </button>
  );
}
```

- [ ] **Step 5: SyncButton.tsx 생성**

```typescript
// web/src/components/unified/SyncButton.tsx
'use client';

import { useState } from 'react';

interface Props {
  lastSynced: string | null;
  onSynced: () => void;
}

export default function SyncButton({ lastSynced, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');

  async function handleSync() {
    setSyncing(true);
    const res = await fetch('/api/unified/sync', { method: 'POST' });
    const data = await res.json();
    setSyncing(false);
    if (data.success) {
      setToast(`동기화 완료: ${data.result.updatedRows}건 (${data.result.durationMs}ms)`);
      setTimeout(() => setToast(''), 4000);
      onSynced();
    }
  }

  const formattedTime = lastSynced
    ? new Date(lastSynced).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '없음';

  return (
    <div className="flex items-center gap-3">
      {toast && (
        <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">{toast}</span>
      )}
      <span className="text-xs text-gray-400">마지막 동기화: {formattedTime}</span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 text-xs bg-[#2F5496] text-white rounded-lg hover:bg-[#243f73] disabled:opacity-50 transition-colors"
      >
        {syncing ? '동기화 중...' : '동기화'}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: UnifiedTable.tsx 생성**

```typescript
// web/src/components/unified/UnifiedTable.tsx
import type { UnifiedRow } from '@/lib/unified-types';
import MemoCell from './MemoCell';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
  showDong: boolean; // 전체 뷰: true, 동별 뷰: false
}

const Check = ({ value }: { value: boolean }) =>
  value ? (
    <span className="text-green-600 font-bold">✓</span>
  ) : (
    <span className="text-gray-200">—</span>
  );

export default function UnifiedTable({ rows, surveyIds, showDong }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400">
            {showDong && <th className="text-left py-2 px-3 font-medium">동</th>}
            <th className="text-left py-2 px-3 font-medium">호수</th>
            <th className="text-left py-2 px-3 font-medium">소유자</th>
            <th className="text-center py-2 px-3 font-medium">실거주</th>
            <th className="text-center py-2 px-3 font-medium">신통</th>
            <th className="text-center py-2 px-3 font-medium">동의</th>
            {surveyIds.map((id) => (
              <th key={id} className="text-center py-2 px-3 font-medium">
                {id}
              </th>
            ))}
            <th className="text-left py-2 px-3 font-medium">메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const allDone =
              row.sinsong && row.consent && surveyIds.every((id) => row.surveys[id]);
            return (
              <tr
                key={`${row.dong}-${row.ho}`}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  !allDone && !row.sinsong && !row.consent ? 'bg-red-50' : ''
                }`}
              >
                {showDong && (
                  <td className="py-2 px-3 text-gray-400 text-xs">{row.dong}</td>
                )}
                <td className="py-2 px-3 font-medium">{row.ho}</td>
                <td className="py-2 px-3 text-gray-700">{row.ownerName}</td>
                <td className="py-2 px-3 text-center text-xs text-gray-400">
                  {row.residency}
                </td>
                <td className="py-2 px-3 text-center">
                  <Check value={row.sinsong} />
                </td>
                <td className="py-2 px-3 text-center">
                  <Check value={row.consent} />
                </td>
                {surveyIds.map((id) => (
                  <td key={id} className="py-2 px-3 text-center">
                    <Check value={row.surveys[id] ?? false} />
                  </td>
                ))}
                <td className="py-2 px-3 min-w-[120px]">
                  <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">해당 조건의 세대가 없습니다.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: 타입 오류 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "components/unified"
```

Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add web/src/components/unified/
git commit -m "feat: unified UI 컴포넌트 6개 추가"
```

---

## Task 8: 페이지 2개 + AdminNav 수정

**Files:**
- Create: `web/src/app/unified/page.tsx`
- Create: `web/src/app/unified/[dong]/page.tsx`
- Modify: `web/src/components/AdminNav.tsx`

- [ ] **Step 0: unified-utils.ts 생성 (applyFilter 공유)**

```typescript
// web/src/lib/unified-utils.ts
import type { UnifiedRow, FilterType } from './unified-types';

export function applyFilter(
  rows: UnifiedRow[],
  filter: FilterType,
  surveyIds: string[],
): UnifiedRow[] {
  if (filter === 'all') return rows;
  if (filter === 'incomplete')
    return rows.filter(
      (r) => !r.sinsong || !r.consent || surveyIds.some((id) => !r.surveys[id]),
    );
  if (filter === 'no-sinsong') return rows.filter((r) => !r.sinsong);
  if (filter === 'no-consent') return rows.filter((r) => !r.consent);
  // 설문 필터: "no-{surveyId}" 형식. surveyIds 목록으로 매핑하여 임의 ID 형식에 대응
  const matchedSurveyId = surveyIds.find((id) => filter === `no-${id}`);
  if (matchedSurveyId) return rows.filter((r) => !r.surveys[matchedSurveyId]);
  return rows;
}
```

- [ ] **Step 1: /unified/page.tsx 생성 (전체 뷰)**

```typescript
// web/src/app/unified/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import UnifiedSidebar from '@/components/unified/UnifiedSidebar';
import UnifiedSummary from '@/components/unified/UnifiedSummary';
import UnifiedFilters from '@/components/unified/UnifiedFilters';
import UnifiedTable from '@/components/unified/UnifiedTable';
import SyncButton from '@/components/unified/SyncButton';
import { applyFilter } from '@/lib/unified-utils';
import type { UnifiedRow, FilterType } from '@/lib/unified-types';

export default function UnifiedPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/unified');
    const data = await res.json();
    setRows(data.rows);
    setSurveyIds(data.surveyIds);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lastSynced = rows[0]?.lastSynced ?? null;
  const filtered = applyFilter(rows, filter, surveyIds);

  return (
    <AdminLayout>
      <div className="flex h-full">
        <UnifiedSidebar selectedDong={null} />
        <div className="flex-1 min-w-0 p-4 overflow-y-auto pb-20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">통합 현황</h1>
            <SyncButton lastSynced={lastSynced} onSynced={fetchData} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : (
            <>
              <UnifiedSummary rows={rows} surveyIds={surveyIds} />
              <UnifiedFilters active={filter} surveyIds={surveyIds} onChange={setFilter} />
              <UnifiedTable rows={filtered} surveyIds={surveyIds} showDong={true} />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: /unified/[dong]/page.tsx 생성 (동별 뷰)**

```typescript
// web/src/app/unified/[dong]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import UnifiedSidebar from '@/components/unified/UnifiedSidebar';
import UnifiedSummary from '@/components/unified/UnifiedSummary';
import UnifiedFilters from '@/components/unified/UnifiedFilters';
import UnifiedTable from '@/components/unified/UnifiedTable';
import SyncButton from '@/components/unified/SyncButton';
import { applyFilter } from '@/lib/unified-utils';
import type { UnifiedRow, FilterType } from '@/lib/unified-types';

export default function UnifiedDongPage() {
  const params = useParams();
  const dong = String(params.dong); // "901"
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/unified?dong=${dong}`);
    const data = await res.json();
    setRows(data.rows);
    setSurveyIds(data.surveyIds);
    setLoading(false);
  }, [dong]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lastSynced = rows[0]?.lastSynced ?? null;
  const filtered = applyFilter(rows, filter, surveyIds);

  return (
    <AdminLayout>
      <div className="flex h-full">
        <UnifiedSidebar selectedDong={dong} />
        <div className="flex-1 min-w-0 p-4 overflow-y-auto pb-20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">{dong}동 현황</h1>
            <SyncButton lastSynced={lastSynced} onSynced={fetchData} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : (
            <>
              <UnifiedSummary rows={rows} surveyIds={surveyIds} />
              <UnifiedFilters active={filter} surveyIds={surveyIds} onChange={setFilter} />
              <UnifiedTable rows={filtered} surveyIds={surveyIds} showDong={false} />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 3: AdminNav에 "통합현황" 탭 추가**

`web/src/components/AdminNav.tsx` 에서 설문 Link 뒤에 추가:

```typescript
      <Link
        href="/unified"
        className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
          pathname.startsWith('/unified') ? 'text-[#2F5496]' : 'text-gray-400'
        }`}
      >
        통합현황
      </Link>
```

- [ ] **Step 4: 타입 오류 + 빌드 확인**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add web/src/app/unified/ web/src/components/AdminNav.tsx
git commit -m "feat: 통합현황 페이지 및 AdminNav 탭 추가"
```

---

## Task 9: Vercel Cron 설정

**Files:**
- Modify: `web/vercel.json`

- [ ] **Step 1: vercel.json cron 추가**

기존 vercel.json의 `crons` 배열에 항목 추가:

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-pdfs",
      "schedule": "0 15 * * *"
    },
    {
      "path": "/api/cron/sync-unified",
      "schedule": "0 0,12 * * *"
    }
  ]
}
```

> `0 0,12 * * *` = 매일 00:00 UTC(09:00 KST)와 12:00 UTC(21:00 KST) 실행

- [ ] **Step 2: 최종 빌드 확인**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` 또는 `Route ... compiled`

- [ ] **Step 3: 커밋**

```bash
git add web/vercel.json
git commit -m "feat: sync-unified Vercel cron 스케쥴 추가"
```

---

## 구현 완료 후 수동 검증

- [ ] `npm run dev` 로 개발 서버 시작
- [ ] 브라우저에서 `/unified` 접속 → 로딩 확인
- [ ] "동기화" 버튼 클릭 → 토스트 메시지 확인
- [ ] AdminNav "통합현황" 탭 클릭 동작 확인
- [ ] 901동 클릭 → `/unified/901` URL 변경 확인
- [ ] "미완료만" 필터 동작 확인
- [ ] 메모 셀 클릭 → 입력 → blur → Sheets 반영 확인

---

## 알려진 주의사항

1. **신통기획접수 시트명 확인 필요**: 기본값 `"901동"` 형식 가정. 다를 경우 `sinsong-sheets.ts`의 `dongKey` 사용 방식 조정.
2. **신통접수 호수 컬럼명 확인 필요**: `row.get('호수')` 가정. 다를 경우 수정.
3. **소유자 원본 시트 컬럼명**: Excel 임포트 후 실제 헤더명 확인 (`동`, `호수`, `소유자1 (성명)`, `실거주여부`).
4. **writeMasterRows 성능**: 2,830행 delete 반복이 느릴 수 있음. 초기 sync 1~2분 예상. 이후 read는 빠름.
5. **설문 동 컬럼값 형식**: `getSurveyKeyset`에서 `"901동"` → `"901"` 정규화 처리함. 실제 값이 다르면 조정 필요.
