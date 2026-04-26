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
