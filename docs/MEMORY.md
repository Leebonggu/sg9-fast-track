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
