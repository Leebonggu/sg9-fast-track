# 프로젝트 누적 학습 (MEMORY)

Claude가 세션 간 기억해야 할 프로젝트 상태 및 세션 특이사항.
새 세션 온보딩: `CLAUDE.md` → 이 파일 → `skills/`
행동 규칙은 `CLAUDE.md`에 있음 — 여기엔 project 상태·세션 특이사항만 기록.

---

## Project (프로젝트 상태)

### 통합현황 대시보드 (2026-04-26 완료)
전체 2,830세대 동의·설문 참여 현황 통합 관리 페이지.
- **아키텍처:** Materialized view — sync 시 결과를 `통합현황` 마스터 시트에 저장, 웹앱은 그것만 읽음
- **displayId 패턴:** `SurveyConfig.id`는 URL용, `displayId`는 시트 컬럼명 = UI 표시명 (그대로 일치)
  - 예: `id: 'survey-001'`, `displayId: '2026_04_기본조사_제출_완료'`
- **신속통합동의서 = 사전동의** — 동일 시스템, `동의서수거여부 === 'TRUE'`인 행만 완료
- **getMasterRows 설문 컬럼 감지:** 고정 컬럼 제외(exclusion) 방식 사용
- **코드 변경 후** 동기화 버튼 1회 클릭 필요 (마스터 시트 재작성)
- 관련 문서: `docs/2026-04-26-unified-dashboard-작업내용.md`

### 통합현황 표 · 사전동의 수거 토글 (2026-07-25 버그 2건 수정)

**1) 가상 스크롤 리셋 — `rows`를 effect 의존성으로 쓰지 말 것**
`UnifiedTable`의 스크롤 리셋 `useEffect`가 `rows`를 의존성으로 삼고 있어, 토글을 누를 때마다
(낙관적 업데이트가 `map()`으로 새 배열을 만들므로) 스크롤이 맨 위로 튀었다.
→ `resetKey` prop(`filter` / `${dong}:${filter}`)으로 교체. **목록 자체가 바뀔 때만** 리셋한다.
회귀 테스트: `web/tests/unified-table-scroll.test.mts` (jsdom + React act, `npm test`에 포함)

**2) 사전동의 수거 토글은 "행이 있어야" 동작한다**
`toggleCollected()`는 v2 동별 시트의 **기존 행**만 뒤집는다. 그런데 `/unified` 모달은 2,830세대 전부에
토글을 노출 → 라이브 데이터 확인 결과 **1,713세대는 v2에 행 자체가 없어** 항상 "해당 호수 데이터 없음".
→ 정책 결정: 토글 ON 시 **성명·연락처 확인 폼**을 띄우고 `addConsent`로 `수동입력(웹)` 행을 새로 만든다.
   (자동 생성 안 함 — 소유자명이 "홍길동,김철수"처럼 복수일 수 있고 오클릭이 라이브 시트에 바로 쓰이므로)
   서버 계약: 행 없으면 `toggleCollected` → `null`, `/api/consent/toggle` → `404 {code:'NO_ROW'}`
**3) 고아 `중복(이전 응답)` 마킹 (원인규명 완료, 시트 정리는 미실행)**
v2 중복 마킹 48건 중 **12건은 "고아"** — 그 세대의 유일한 행인데 중복으로 마킹돼 있다.
원인: `deleteConsent`는 삭제 후 남은 마킹을 해제하지만, **시트에서 사람이 직접 행을 지우면 그 로직이 안 돈다.**
비대칭이 생기는 이유 — sync(`getConsentKeyset`)는 비고를 안 보고, 편집·연락처 경로는 중복 행을 스킵한다:
  - 통합현황 동의여부: 정상 / 수거 토글·성명수정·삭제: 불가 / **연락처: 통합현황에서 유실(12건)**
현재 조치: 시트는 안 건드리고, `toggleCollected`가 `'NO_ROW'`(이력없음) vs `'DUP_ONLY'`(중복마킹만)를
구분해 `DUP_ONLY`는 409로 거절 → **생성 폼이 뜨지 않아 진짜 중복이 쌓이는 것을 차단**.
명단 재추출: **`npm run orphans`** (`web/scripts/find-orphan-duplicates.mts`, 읽기 전용)
→ `docs/raw/YYYY-MM-DD_고아-중복마킹-목록.md` 생성. `docs/raw/`는 gitignore이므로 명단은 커밋 금지.
⚠️ 라이브 시트는 계속 갱신된다(조사 중 904동 1003호가 7분 사이 자연 해소, 마킹 48→47건).
   행번호도 새 제출이 들어오면 밀리므로 **정리 직전에 반드시 재실행할 것.**

### survey 관리 시스템 (2026-04-25 개편)
- `/survey/[id]` 응답 목록 / `/missing` 미응답 / `/analytics` 통계 / `/form` 설문폼
- `SurveyDetailTabs.tsx` — `sticky top-[64px]` (헤더 64px 오프셋 필수)
- "신통기획접수" = UI 레이블, sheets.ts 컬럼명은 기존 유지
- 관련 문서: `docs/2026-04-25_survey-dashboard-확장.md`

### recon-sim 검증 필요 가정값
분담금 시뮬레이터(`recon-sim/`)의 미검증 가정값들 — 발표·추천 전 단지·법령 원문 대조 필요.
- 재초환 구간 (외부 AI 리뷰 출처, 시행령 원문 미확인) ⚠️
- 정상상승률 계산 방식 ⚠️
- 회귀 테스트: `recon-sim/tests/regression.ts` (`npm test`) — 중계주공5단지 PDF 25개 항목, 마지막 결과 25/25 pass

### SG9 사전동의 시스템 상태 (2026-04-04)
P1 완료, 팀 리뷰 후 수정 예정. 핵심 파일: `src/setup.gs`, `src/setup_v2.gs`.

### 라이브 수치는 라이브 시트에서 읽어라 (2026-08-12)
전자동의 병합 설계 중, Downloads의 `통합현황_all_20260514.xlsx`(3개월 전 export)로
종이 동의 세대수를 계산해 "순증 223세대"라고 보고했다. 라이브 시트 실측은 **87세대**.
- 원인: 종이 동의가 479→1,022세대로 늘어난 만큼 전자와의 겹침도 283→419로 늘었는데,
  낡은 스냅샷으로 교집합을 재서 순증을 2.5배 과대평가했다.
- 교훈: **집합 연산(겹침·순증·합집합)은 한쪽만 낡아도 결과가 크게 틀어진다.**
  단순 개수보다 훨씬 민감하다. 두 항이 같은 시점인지 먼저 확인할 것.
- 방법: `web/.env.local` + `google-spreadsheet`로 라이브 시트를 읽는 read-only 스크립트를
  `web/` 안에 두고 실행(ESM이 node_modules를 파일 위치 기준으로 찾아 scratchpad에서는 실패), 실행 후 삭제.
- 관련 문서: `docs/superpowers/specs/2026-08-12-전자동의-통합현황-병합-design.md`

### 통합현황 2,830행 소실 사고 (2026-08-13)
sync 실행 중 Sheets 읽기 쿼터(429)에 걸려 **통합현황 시트가 통째로 비었다.** 백업에서 복원.
- 직접 원인: `writeMasterRows`가 `clear()` → `setHeaderRow()` → `addRows()×6` 순서였다.
  **지우기가 먼저 성공하고 쓰기가 중간에 끊기면 빈 시트만 남는다.** 파괴적·비원자적 쓰기.
- 쿼터 원인: `getConsentKeyset`과 `getPhoneMap`이 같은 23개 동 시트를 각각 getRows()로 훑어
  46회를 호출했다. 사용자당 분당 60회 제한이라 sync 한 번에 대부분을 소진.
  여기에 전자동의 읽기가 하나 더 얹히면서 넘겼다.
- 교훈 1: **"읽기 실패는 throw" 만으로는 부족하다.** 읽기를 다 끝낸 뒤 쓰기가 시작되므로
  쓰기 단계 실패 경로가 그대로 남아 있었다. 파괴적 연산은 순서를 뒤집어야 한다 —
  **먼저 쓰고, 남는 꼬리를 나중에 지운다.**
- 교훈 2: 같은 시트를 여러 함수가 각자 읽으면 쿼터가 곱해진다. `values.batchGet`으로 합칠 것.
- 수정: values.update 1회로 전체 덮어쓰기(호출 8회→1~2회), batchGet으로 46회→1회.
- 관련: `feedback_live_numbers_from_live_sheet`, `project_unified_sync_overwrite_risk`
