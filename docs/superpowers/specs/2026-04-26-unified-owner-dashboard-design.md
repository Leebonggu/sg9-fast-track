# 통합 소유자 현황 대시보드 설계

**날짜:** 2026-04-26  
**상태:** 설계 완료, 구현 대기

## 개요

상계주공9단지 전체 2,830세대 소유자 목록을 기준으로, 진행 중인 모든 프로젝트(신통기획접수, 사전동의, 설문 등)의 참여 현황을 한눈에 파악하고 미완료자를 컨택하기 위한 통합 관리 페이지.

---

## 문제

- 신통기획접수 / 사전동의 / 설문 데이터가 각자 별도 시트에 분산
- 특정 소유자가 어떤 항목을 했고 안 했는지 확인이 어려움
- 미완료자 목록 추출 → 컨택이 번거로움
- 설문이 늘어날수록 관리 복잡도 증가

---

## 아키텍처

```
[소스 시트들]                          [마스터 시트 - 통합현황]
  소유자 원본 시트 ──┐                   동 | 호수 | 소유자 | 실거주
  신통접수 시트 ─────┤  sync()  →→→     신통 | 동의 | 설문-001 | 설문-N
  v2 사전동의 시트 ──┤                   메모 | 마지막_동기화
  survey-N 시트 ─────┘
                                              ↓ 읽기 (빠름)
                                    웹앱 /unified (사이드바+테이블)
```

**핵심 원칙:** 소스 시트들을 매 요청마다 join하지 않고, sync 시점에 마스터 시트에 결과를 materialize. 웹앱은 마스터 시트 하나만 읽음.

---

## 데이터 소스

| 소스 | 스프레드시트 | 구조 | env 변수 |
|------|------------|------|---------|
| 소유자 원본 | `1XEzLst8e-NVxakcC4dbzZvq2WykRul2oRG084SHhVic` | "원본" 시트, 동/호수/소유자/실거주 | `OWNER_SPREADSHEET_ID` |
| 마스터(통합현황) | 동일 스프레드시트 | "통합현황" 시트 (sync가 생성) | `OWNER_SPREADSHEET_ID` |
| v2 사전동의 | 기존 | 동별 시트 + 호수 컬럼 | `SPREADSHEET_ID` |
| 신통기획접수 | 기존 | 동별 시트 + 호수 컬럼 | `SINSONG_SPREADSHEET_ID` |
| survey-001+ | 기존 | "통합응답" 시트, 동+호 컬럼 | `SURVEY_001_SPREADSHEET_ID` |

---

## 마스터 시트(통합현황) 컬럼 구조

| 컬럼 | 타입 | 설명 |
|------|------|------|
| 동 | string | 901~923 |
| 호수 | string | 호수 |
| 소유자명 | string | 소유자1 성명 |
| 실거주여부 | string | 실거주/임대 |
| 신통접수_완료 | TRUE/FALSE | 신통기획접수 참여 여부 |
| 사전동의_완료 | TRUE/FALSE | v2 사전동의 참여 여부 |
| survey-001_완료 | TRUE/FALSE | 설문-001 참여 여부 |
| survey-N_완료 | TRUE/FALSE | 설문 추가 시 자동 컬럼 추가 |
| 메모 | string | 추진위원 메모 (sync 시 보존) |
| 마지막_동기화 | string | ISO 타임스탬프 |

> 첫 sync 실행 시 코드가 헤더를 자동 생성함. 빈 시트로 준비해두면 됨.

---

## 신규 파일 목록

### lib

| 파일 | 역할 |
|------|------|
| `src/lib/owner-sheets.ts` | 마스터 시트 읽기 / 메모 쓰기 / 헤더 초기화 |
| `src/lib/sinsong-sheets.ts` | 신통접수 동별 시트 읽기 → Map<"동-호", boolean> |
| `src/lib/unified-sync.ts` | 4개 소스 join → 마스터 시트 upsert |
| `src/lib/notifier.ts` | 알림 인터페이스 + WebToast 구현체 |

### API 라우트

| 경로 | 메서드 | 역할 |
|------|--------|------|
| `/api/unified` | GET | 마스터 시트 전체 조회 (`?dong=901` 필터 가능) |
| `/api/unified/sync` | POST | 수동 동기화 트리거 |
| `/api/unified/memo` | PATCH | 메모 저장 `{ dong, ho, memo }` |
| `/api/cron/sync-unified` | GET | Vercel Cron 스케쥴러 (하루 1~2회) |

### 페이지 / 컴포넌트

| 경로 | 설명 |
|------|------|
| `/unified` | 전체 뷰 (2,830세대) |
| `/unified/[dong]` | 동별 뷰 (예: `/unified/901`) |
| `src/components/unified/UnifiedSidebar.tsx` | 전체/901~923동 사이드바 |
| `src/components/unified/UnifiedSummary.tsx` | 동기화 요약 카드 (항목별 %) |
| `src/components/unified/UnifiedFilters.tsx` | 전체/미완료/신통미완료/설문미완료 필터 |
| `src/components/unified/UnifiedTable.tsx` | 세대 목록 테이블 |
| `src/components/unified/MemoCell.tsx` | 인라인 메모 편집 |
| `src/components/unified/SyncButton.tsx` | 동기화 버튼 + 마지막 동기화 시간 |

---

## Sync 로직 (`unified-sync.ts`)

```
syncMasterSheet():
  1. 소유자 원본 시트 읽기 → 2,830행 기준
  2. 신통접수 23개 동 시트 읽기 → Map<"동-호", boolean>
  3. v2 사전동의 23개 동 시트 읽기 → Map<"동-호", boolean>
  4. getAllSurveyConfigs() 순회 → 설문별 Map<"동-호", boolean>
  5. 마스터 시트 메모 컬럼 읽기 → Map<"동-호", string> (보존용)
  6. join → 마스터 시트 전체 overwrite (메모 값 유지)
  7. 마지막_동기화 타임스탬프 기록
  8. SyncResult 반환 → notifiers 일괄 호출
```

### 설문 자동 확장

`getAllSurveyConfigs()`가 `SURVEY_REGISTRY`를 순회하므로, 새 설문 추가 시:
1. `surveys/survey-002.ts` 생성 + registry 등록
2. `.env.local`에 `SURVEY_002_SPREADSHEET_ID` 추가
3. 다음 sync 실행 시 마스터 시트에 `survey-002_완료` 컬럼 자동 추가

---

## 알림 인터페이스 (`notifier.ts`)

```typescript
interface SyncResult {
  syncedAt: string
  totalRows: number
  updatedRows: number
  durationMs: number
}

interface SyncNotifier {
  notify(result: SyncResult): Promise<void>
}

// 기본 구현 (항상 포함) — API 응답에 결과 포함, 프론트에서 토스트 표시
class WebToastNotifier implements SyncNotifier

// 플러그인 자리 (외부 알림 수단 결정 후 추가)
class KakaoNotifier implements SyncNotifier   // KAKAO_* env 필요
class EmailNotifier implements SyncNotifier   // SMTP_* env 필요
class SlackNotifier implements SyncNotifier   // SLACK_WEBHOOK_URL env 필요
```

외부 알림 추가 시: 해당 Notifier 구현 + env 변수 추가 + notifiers 배열에 등록만 하면 됨.

---

## 동기화 트리거

| 방식 | 구현 |
|------|------|
| 수동 버튼 | 웹앱 `/unified` 상단 "동기화" 버튼 → POST `/api/unified/sync` |
| 자동 스케쥴 | `vercel.json` cron 설정 → `/api/cron/sync-unified` (하루 1~2회) |
| 결과 표시 | 완료 시 토스트 + "마지막 동기화: YYYY-MM-DD HH:mm" 상시 표시 |

---

## UI 동작

- **`/unified`**: 사이드바 "전체" 선택 상태, 2,830세대 전체 테이블
- **`/unified/901`**: 사이드바 "901동" 선택, 해당 동만 표시, 동 컬럼 숨김
- **미완료 행**: 빨간 배경 강조
- **메모 편집**: 셀 클릭 → 인라인 입력 → blur/Enter 시 PATCH 저장
- **필터**: 전체 / 미완료만 / 신통 미완료 / 설문 미완료

---

## 개발 전 준비 (사용자 액션)

- [x] 스프레드시트 준비: `1XEzLst8e-NVxakcC4dbzZvq2WykRul2oRG084SHhVic`
- [ ] "원본" 시트: Excel 파일 임포트
- [ ] "통합현황" 시트: 빈 시트 추가 (헤더는 sync가 자동 생성)
- [ ] 서비스 계정 편집자 권한 부여: `rebuild@rebuild-492516.iam.gserviceaccount.com`
- [ ] `.env.local` 추가:
  ```
  OWNER_SPREADSHEET_ID=1XEzLst8e-NVxakcC4dbzZvq2WykRul2oRG084SHhVic
  SINSONG_SPREADSHEET_ID=<신통기획접수 시트 ID>
  ```

---

## 건드리지 않는 것

- `setup_v2.gs` — 절대 수정 없음
- 기존 사전동의 / 설문 API 라우트 — 그대로 유지
- v2 시트 컬럼 구조 — 읽기만, 수정 없음
