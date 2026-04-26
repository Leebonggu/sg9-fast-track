# 어드민 통합 진입점 설계

## Context

현재 `/`(사전동의 관리)와 `/survey`(설문 관리)가 독립적인 진입점으로 분산되어 있다.
로그인이 사실상 공유되지만 네비게이션이 없어 URL을 직접 입력해야 하며,
어드민/퍼블릭 경계가 코드 레벨에서 명시적이지 않다.

목표: 어드민 페이지를 하나의 auth + nav 레이어 아래로 통합하고,
퍼블릭 페이지(주민 설문폼)는 명확히 분리한다. 주민에게 공개된 URL은 변경하지 않는다.

---

## 라우트 구조

### 변경 후

| 경로 | 역할 | 변경 여부 |
|------|------|----------|
| `/` | 어드민 랜딩 (링크 2개, API 호출 없음) | 신규 |
| `/consent` | 동의서 관리 (기존 `/` 이동) | URL 변경 |
| `/guide` | 사용 가이드 | URL 유지, 어드민 그룹 편입 |
| `/survey` | 설문 목록 | 유지 |
| `/survey/[surveyId]` | 설문 상세 | 유지 |
| `/survey/[surveyId]/form` | 주민 설문폼 (퍼블릭) | 유지, 인증 없음 |

---

## 파일 구조

```
web/src/app/
  (admin)/                          ← route group (URL에 영향 없음)
    layout.tsx                      ← 신규: auth 체크 + AdminNav 렌더링
    page.tsx                        ← 신규: 어드민 랜딩 (링크 2개)
    consent/
      page.tsx                      ← 기존 app/page.tsx 이동
    guide/
      page.tsx                      ← 기존 app/guide/page.tsx 이동
    survey/
      page.tsx                      ← 기존 app/survey/page.tsx 이동
      [surveyId]/
        page.tsx                    ← 기존 app/survey/[surveyId]/page.tsx 이동

  survey/                           ← (admin) 바깥 - 퍼블릭
    [surveyId]/
      form/
        page.tsx                    ← 기존 위치 유지, 변경 없음

  api/                              ← 변경 없음
  layout.tsx                        ← 루트 레이아웃, 변경 없음
```

---

## 컴포넌트

### `(admin)/layout.tsx`
- sessionStorage `auth === '1'` 확인
- 미인증 시 로그인 폼 렌더링 (기존 로그인 로직 재사용)
- 인증 후 `<AdminNav />` + `{children}` 렌더링

### `components/AdminNav.tsx` (신규)
- 상단 고정 nav
- 링크: 홈(`/`), 사전동의(`/consent`), 설문(`/survey`)
- 현재 경로 활성화 표시

### `(admin)/page.tsx` (신규 랜딩)
- API 호출 없음 (부하 0)
- 카드 2개: "사전동의 관리" → `/consent`, "설문 관리" → `/survey`

---

## Auth 통합

기존: 각 페이지마다 개별 auth 체크 + 로그인 폼
변경: `(admin)/layout.tsx` 한 곳에서 처리, 하위 페이지들은 auth 로직 제거

sessionStorage `auth: '1'` 방식은 유지 (동일 도메인이므로 공유됨).

---

## 변경되지 않는 것

- 모든 `/api/*` 라우트 — 경로, 로직 모두 그대로
- `/survey/[surveyId]/form` — 주민 공개 URL, 코드 변경 없음
- Google Sheets 연동 로직 (`lib/sheets.ts`, `lib/survey-sheets.ts`)
- 기존 컴포넌트들 (`SurveyAnalytics`, `MissingRespondents`, `CrossTabChart`)

---

## 검증 방법

1. `/` 접속 → 로그인 폼 표시
2. 로그인 후 → 랜딩 페이지(링크 2개) 표시
3. "사전동의 관리" 클릭 → `/consent` 이동, 기존 동의서 화면 정상 동작
4. "설문 관리" 클릭 → `/survey` 이동, nav 유지
5. `/survey/[id]/form` 직접 접속 → 로그인 없이 설문폼 표시
6. `/consent`에서 새 탭으로 `/survey` 접속 → 재로그인 없이 접근 가능
