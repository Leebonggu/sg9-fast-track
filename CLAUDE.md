# 상계주공 9단지 사전동의 시스템

## 이 프로젝트의 AI 작동 방식

이 프로젝트는 **하네스-컴파운드 프레임워크**로 운영된다. 하네스(Harness)는 Claude가 안전하게 행동하도록 제어하는 구조이고, 컴파운드(Compound)는 세션마다 학습이 누적되어 다음 세션이 더 잘 작동하도록 하는 구조다.

**새 Claude 세션 온보딩 순서**: CLAUDE.md(규칙 파악) → memory(누적 학습 확인) → skills(사용 가능한 워크플로우 확인)

각 레이어의 역할:
- `CLAUDE.md` — 행동 규칙 허브 (무엇을 해도 되고 안 되는지)
- `.claude/settings.json` — hooks (v2 가드레일 + 세션 종료 피드백 트리거)
- `memory/` — 누적 학습 (feedback, project, user 타입)
- `skills/` — 재사용 워크플로우 (`add-survey` 등)
- `docs/superpowers/specs/2026-04-18-harness-compound-framework.md` — 철학/멘탈모델 전체 문서

## Harness Rules (행동 규칙)

### 절대 금지 (가드레일 — hooks가 자동 차단)
- `setup_v2.gs`, `setup_v2_master.gs` 구조 변경 — 라이브 운영 중, 장애로 이어짐
- v2 스프레드시트 시트 구조(컬럼 순서, 시트명) 변경
- `.env.local` 커밋

### 행동 전 자문 체크리스트
- v2 관련 파일 편집 시: "이게 hook 추가(허용)인가, 구조 변경(금지)인가?"
- 새 설문 추가: `add-survey` skill 사용
- memory 내용 인용 시: 현재 코드와 일치하는지 먼저 확인

## 품질 제일 원칙

- 확신 없으면 코드/시트를 직접 읽고 확인 후 응답한다
- memory 내용이 현재 코드와 다르면 → memory를 즉시 교정
- 틀린 추천을 했다면 → 원인을 feedback memory에 기록
- 추측으로 답변하지 않는다

## Compound Loop

```
Plan → Work → Review → Compound
                          ↑
              세션 종료 전 반드시 실행:
              1. 이번 세션에서 새로 배운 패턴/규칙이 있는가?
              2. memory에 없는 내용이면 → 기록
              3. memory의 틀린 내용을 발견했으면 → 교정
              4. 반복되는 작업 패턴이면 → skill 후보로 표시 (비고: ~)
```

---


## 프로젝트 구조

```
sg9/
  src/apps-script/       # Google Apps Script 코드 (시트 바인딩용)
    setup.gs             # v1 (미사용)
    setup_v2.gs          # v2 라이브 시스템 (절대 수정 금지, hook 1줄만 추가 가능)
    setup_v3.gs          # v3 (실거주 분기 추가, 미배포)
    setup_v2_master.gs   # 그리드 시트용 (웹 UI 전환으로 불필요해질 수 있음)
    webapp.gs            # Apps Script 웹앱 (느려서 Next.js로 전환)
    webapp.html          # Apps Script 웹앱 HTML
    building_data.js     # 동별 호수 데이터 (참고용)
  web/                   # Next.js 웹 UI (메인 개발)
    src/app/             # 페이지 및 API 라우트
    src/lib/sheets.ts    # Google Sheets 연동 로직
    .env.local           # 환경변수 (서비스 계정 키, 시트 ID, 비밀번호)
  docs/                  # 기획서, 스펙 문서
```

## 문서 컨벤션

- `docs/` 폴더에 문서 저장 시 파일명에 날짜 접두사: `YYYY-MM-DD_파일명.md`
- "문서저장", "문서업데이트" 키워드 시 별도 확인 없이 `docs/`에 해당 작업 내용 정리

## 핵심 원칙

- **v2 시스템(setup_v2.gs)은 라이브 운영 중 — 기존 시트/폼 절대 수정 금지**
- v2 스프레드시트에 새 기능 추가 시 별도 파일로, 기존 함수에는 hook 1줄만 추가
- 웹 UI(Next.js)는 원본 리스트 시트를 직접 읽기/쓰기 (그리드 시트 불필요)

## 기술 스택

- **v2 시스템**: Google Forms + Google Sheets + Apps Script
- **웹 UI**: Next.js (TypeScript, Tailwind) + Google Sheets API (google-spreadsheet 패키지)
- **인증**: 서비스 계정 (rebuild@rebuild-492516.iam.gserviceaccount.com)
- **배포**: 로컬 개발 중, Vercel 배포 예정

## 데이터 흐름

```
구글폼 제출 → v2 onFormSubmit → 동별 리스트 시트에 저장
웹 UI 접속 → Next.js API → Google Sheets API → 동별 리스트 시트 읽기/쓰기
```

## 동별 구조 (2,830세대)

- 901~923동, 동마다 층수(12~15층)와 호수(6~14호/층)가 다름
- 903, 904, 910, 911동: 1층 103, 104호 없음 (필로티)
- 상세 구조는 `src/lib/sheets.ts`의 `BUILDING_CONFIG` 참조

## 환경변수 (.env.local)

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=서비스계정이메일
GOOGLE_PRIVATE_KEY=서비스계정키
SPREADSHEET_ID=v2스프레드시트ID
APP_PASSWORD=웹접속비밀번호
```

## v2 시트 컬럼 구조 (동별 시트)

| 인덱스 | 컬럼명 |
|--------|--------|
| 0 | 타임스탬프 |
| 1 | 성명 |
| 2 | 연락처 |
| 3 | 호수 |
| 4 | 주민등록상주소 |
| 5 | 사전동의여부 |
| 6 | 개인정보동의여부 |
| 7 | 입력경로 (온라인/수동/수동입력(웹)) |
| 8 | 동의서수거여부 (TRUE/FALSE) |
| 9 | 수거일 |
| 10 | 수거자 |
| 11 | 비고 |
