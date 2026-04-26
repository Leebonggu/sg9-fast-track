# 통합 현황 대시보드 작업 내용 (2026-04-26)

## 개요

전체 2,830세대 소유자 기준으로 신속통합동의서 제출·설문 참여 현황을 한눈에 파악하는 통합 관리 페이지 구축.

---

## 구현한 것

### 아키텍처
- **Materialized view 패턴**: 소스 시트들을 매 요청마다 join하지 않고, sync 시 결과를 구글 시트 "통합현황"에 저장 → 웹앱은 마스터 시트만 읽음 (14초 sync / 빠른 조회)

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/lib/unified-types.ts` | 공통 타입 (UnifiedRow, SyncResult 등) |
| `src/lib/owner-sheets.ts` | 소유자 원본 읽기 + 마스터 시트 R/W |
| `src/lib/unified-sync.ts` | 소스 join → 마스터 시트 overwrite |
| `src/lib/unified-utils.ts` | applyFilter 공유 유틸 |
| `src/lib/notifier.ts` | SyncNotifier 인터페이스 + WebToastNotifier |
| `src/app/api/unified/route.ts` | GET /api/unified |
| `src/app/api/unified/sync/route.ts` | POST /api/unified/sync |
| `src/app/api/unified/memo/route.ts` | PATCH /api/unified/memo |
| `src/app/api/cron/sync-unified/route.ts` | GET /api/cron/sync-unified (Vercel cron) |
| `src/components/unified/` | UI 컴포넌트 6개 |
| `src/app/unified/page.tsx` | /unified 전체 뷰 |
| `src/app/unified/[dong]/page.tsx` | /unified/901 동별 뷰 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/sheets.ts` | getConsentKeyset() 추가 |
| `src/lib/survey-sheets.ts` | getSurveyKeyset() 추가 |
| `src/lib/surveys/types.ts` | SurveyConfig에 displayId 필드 추가 |
| `src/lib/surveys/survey-001.ts` | displayId: '2026_04_기본조사_제출' 추가 |
| `src/lib/surveys/registry.ts` | displayId 기반 컬럼명 사용 |
| `src/components/AdminNav.tsx` | 통합현황 탭 추가 |
| `src/app/page.tsx` | 홈에 통합현황 버튼 추가 (맨 위) |
| `web/vercel.json` | sync-unified cron 추가 (매일 00:00, 12:00 UTC) |

---

## 주요 설계 결정

### 신통기획접수 = 사전동의 통합
- 동일한 시스템임이 확인되어 별도 sinsong 컬럼 제거
- `getConsentKeyset()` 하나로 통합, **동의서수거여부 = TRUE**인 행만 완료로 인식

### 마스터 시트 컬럼명
| 컬럼 | 설명 |
|------|------|
| 동, 호수, 소유자명, 실거주여부 | 소유자 원본 |
| 신속통합동의서_제출_완료 | 동의서수거여부 TRUE |
| 2026_04_기본조사_제출_완료 | survey-001 응답 여부 |
| 메모, 마지막_동기화 | 관리용 |

### SurveyConfig.displayId 패턴
- `id`: URL 경로 (`/survey/survey-001`) 유지용
- `displayId`: 통합현황 마스터 시트 컬럼명 + UI 표시용
- 새 설문 추가 시 원하는 이름으로 표시 가능

### sheet.clear() 최적화
- 기존: 2,830행 × row.delete() = 2,830 API 호출 → 할당량 초과
- 변경: sheet.clear() 1회 → 14초 완료

### 소유자 이름 처리
- 소유자1~5 (성명) 컬럼 병합 → 콤마로 구분
- 컬럼명 줄바꿈(`\n`) 포함 형식 대응

### 행 색상 3단계
- 흰 배경: 전체 완료
- 노란 배경(amber): 부분 완료
- 빨간 배경: 아무것도 안 함

---

## 데이터 소스

| 소스 | 스프레드시트 ID | env 변수 |
|------|--------------|---------|
| 소유자 원본 + 마스터 | 1XEzLst8e-NVxakcC4dbzZvq2WykRul2oRG084SHhVic | OWNER_SPREADSHEET_ID |
| 신속통합동의서(=사전동의) | 1LIbCY8O915NCW01fFau01sPUYpBv0k4ZduAP7zFcX7Y | SPREADSHEET_ID |
| 2026_04_기본조사 | (SURVEY_001_SPREADSHEET_ID) | SURVEY_001_SPREADSHEET_ID |

---

## 배포 시 주의사항

- Vercel 환경변수에 `OWNER_SPREADSHEET_ID`, `SURVEY_001_SPREADSHEET_ID` 추가 필요
- cron: 매일 00:00 UTC(09:00 KST), 12:00 UTC(21:00 KST) 자동 sync
- 코드 변경 후 최초 배포 시 동기화 버튼 1회 클릭 필요 (마스터 시트 재작성)

---

## 후속 수정 (2026-04-26 세션 2)

### displayId 네이밍 정책 변경

`SurveyConfig.displayId`를 **시트 컬럼명 그대로** 사용하도록 변경.

| 항목 | 이전 | 이후 |
|------|------|------|
| `displayId` | `2026_04_기본조사_제출` | `2026_04_기본조사_제출_완료` |
| 시트 컬럼 | `2026_04_기본조사_제출_완료` | `2026_04_기본조사_제출_완료` (동일) |
| UI 헤더 | `2026_04_기본조사_제출` | `2026_04_기본조사_제출_완료` |

**연동된 코드 변경:**
- `writeMasterRows`: 설문 컬럼에 `_완료` 더 이상 추가하지 않음 (displayId 그대로 헤더로 사용)
- `getMasterRows`: 설문 컬럼 감지 방식을 `endsWith('_완료')` → **고정 컬럼 제외(exclusion)** 방식으로 변경 (더 견고)
- 필터 레이블에서는 `_완료` 접미사를 제거해 표시 (`2026_04_기본조사_제출 미완료`)

### 필터 레이블 명확화

| 필터 | 이전 | 이후 |
|------|------|------|
| incomplete | 미완료 | 하나라도 미완료 |
| no-consent | 동의 미완료 → 동의서 미제출 | 신속통합동의서 미제출 |
| no-{surveyId} | `{displayId} 미완료` | `{displayId에서 _완료 제거} 미완료` |
