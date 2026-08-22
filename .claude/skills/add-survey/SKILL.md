---
name: add-survey
description: 새 설문을 웹 UI에 추가하고 통합현황에 컬럼을 연결. "설문 추가", "2차 설문", "새 조사" 요청 시 사용.
---

# 새 설문 추가

설문 1개 = `SurveyConfig` 1개. 구글폼이 아니라 우리 웹 UI(/survey/[id])로 받는다.

## 절차 (`web/`에서)

1. **응답 저장용 구글 시트 준비** — 서비스 계정(rebuild@rebuild-492516.iam.gserviceaccount.com)에
   편집자 공유. 시트 ID를 `.env.local`에 `SURVEY_00N_SPREADSHEET_ID`로 추가 (Vercel 환경변수에도)
2. **config 작성**: `src/lib/surveys/survey-00N.ts` — `survey-001.ts`를 본떠 작성
   - `id: 'survey-00N'` (URL 경로용) / `displayId: 'YYYY_MM_이름_제출_완료'` (시트 컬럼명 = UI 표시명, 그대로 일치)
   - `basicInfoFields`의 `sheetColumn`이 응답 시트 헤더와 정확히 일치해야 한다
   - `envKeys.spreadsheetId`에 1번의 env 키 이름을 넣는다
3. **등록**: `src/lib/surveys/registry.ts`의 `SURVEY_REGISTRY`에 추가
4. **동기화**: safe-sync 스킬 절차로 sync 1회 → 통합현황에 `displayId` 컬럼 자동 생성
5. **확인**: `/survey/survey-00N` 접속, `/unified`에 새 컬럼·현황판 카드가 뜨는지

## 함정

- `displayId`는 한 번 정하면 바꾸지 않는다 — 시트 컬럼명이자 UI 표시명이라 바꾸면 데이터가 갈린다
- v2 스프레드시트(신속통합동의서)는 건드리지 않는다 — 설문은 별도 시트
- 마감은 config의 `closedAt: 'YYYY-MM-DD'`로 처리 (코드 삭제 아님)
