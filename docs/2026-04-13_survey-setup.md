# 재건축 추진 의향 설문 — 셋업 가이드

## 개요

구글폼으로 온라인 설문 → 응답 기반 실물 설문지(PDF) 자동 생성 → 구글 드라이브 저장.
오프라인용 빈 설문지도 같은 시스템에서 PDF로 생성 가능.

---

## 사전 준비

### 1. GCP 콘솔 — API 활성화

기존 서비스 계정(`rebuild@rebuild-492516.iam.gserviceaccount.com`)에 API 2개 추가 활성화 필요.

1. [GCP 콘솔](https://console.cloud.google.com) 접속
2. 프로젝트: `rebuild-492516` 선택
3. **API 및 서비스 > 라이브러리**에서 검색 후 활성화:
   - `Google Docs API`
   - `Google Drive API`

> Sheets API는 이미 활성화되어 있음.

### 2. 구글 드라이브 — PDF 저장 폴더 생성

1. 구글 드라이브에서 새 폴더 생성 (예: `설문지_PDF`)
2. 해당 폴더 → 공유 → `rebuild@rebuild-492516.iam.gserviceaccount.com` 을 **편집자**로 추가
3. 폴더 URL에서 ID 복사 (`https://drive.google.com/drive/folders/XXXXXX` → `XXXXXX` 부분)

---

## 실행 순서

### Step 1: Google Docs 설문지 템플릿 생성

1. [Apps Script](https://script.google.com) 접속
2. 새 프로젝트 생성
3. `src/apps-script/survey_template.gs` 내용 복사 붙여넣기
4. `createSurveyTemplate()` 함수 실행
5. 실행 로그에서 **문서 ID** 복사
6. 생성된 Docs를 열어 레이아웃 확인/수정
   - 위원회와 소통하며 양식 조정 가능 (Google Docs에서 직접 편집)
   - 단, `{{동}}`, `☐{{Q2_매우 필요}}` 같은 **플레이스홀더 태그는 유지해야 함**
7. 서비스 계정에도 Docs 공유: `rebuild@rebuild-492516.iam.gserviceaccount.com` → **편집자**

### Step 2: Google Form + 응답 시트 생성

1. 같은 Apps Script 프로젝트 (또는 새 프로젝트)
2. `src/apps-script/survey_form.gs` 내용 복사 붙여넣기
3. `createSurveyForm()` 함수 실행
4. 실행 로그에서 확인:
   - **폼 URL (응답)** → 주민에게 배포할 링크
   - **폼 URL (수정)** → 관리용
   - **시트 ID** → 환경변수에 사용

### Step 3: 환경변수 설정

`web/.env.local` 파일에 다음 3줄 추가:

```
SURVEY_SPREADSHEET_ID=Step2에서_복사한_시트ID
SURVEY_TEMPLATE_DOC_ID=Step1에서_복사한_문서ID
SURVEY_DRIVE_FOLDER_ID=사전준비2에서_복사한_폴더ID
```

### Step 4: 확인

```bash
cd web
npm run dev
```

1. `http://localhost:3000/survey` 접속
2. 비밀번호 입력 (기존 APP_PASSWORD와 동일)
3. 현황 확인 — 응답 0건이면 정상
4. 구글폼에서 테스트 응답 1~2건 제출
5. 새로고침 → 응답 목록 표시 확인
6. "개별 생성" 버튼 → 드라이브에 PDF 생성 확인
7. 생성된 PDF 열어서 체크 표시가 정확한지 확인
8. "빈 설문지" 버튼 → 오프라인 프린트용 PDF 확인

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `src/apps-script/survey_template.gs` | Docs 설문지 템플릿 생성 스크립트 |
| `src/apps-script/survey_form.gs` | 구글폼 + 응답 시트 생성 스크립트 |
| `web/src/lib/survey-config.ts` | 질문/선택지 설정 (변경 시 여기만 수정) |
| `web/src/lib/survey-sheets.ts` | 응답 시트 읽기/쓰기 |
| `web/src/lib/survey-pdf.ts` | PDF 생성 (Docs 복사+치환+export) |
| `web/src/app/survey/page.tsx` | 관리 페이지 UI |
| `web/src/app/api/survey/route.ts` | 현황/목록 API |
| `web/src/app/api/survey/generate/route.ts` | PDF 생성 API |

## 질문/선택지 변경 시

설문 내용이 바뀌면:

1. `web/src/lib/survey-config.ts` 수정 (질문 추가/삭제/변경)
2. Docs 템플릿에도 동일하게 반영 (플레이스홀더 태그 맞추기)
3. 구글폼은 `survey_form.gs` 수정 후 재실행 (또는 폼에서 직접 수정)

## 공통 모듈 (이번에 분리됨)

| 파일 | 내용 | 사용처 |
|------|------|--------|
| `web/src/lib/buildings.ts` | BUILDING_CONFIG, BUILDINGS, getTotalUnits | 사전동의 + 설문 |
| `web/src/lib/google-auth.ts` | 서비스 계정 JWT 인증 | 사전동의 + 설문 |
