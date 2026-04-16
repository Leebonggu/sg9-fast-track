# 범용 설문 시스템

## 개요

설문을 여러 개 운영할 수 있는 범용 구조. 설문 추가 시 코드 변경을 최소화하고, 런타임 코드(PDF 생성 웹앱, Next.js API/UI)는 모든 설문이 공유한다.

## 구조

```
web/src/lib/surveys/
  types.ts           # 공통 타입 (SurveyConfig, SurveyResponse 등)
  registry.ts        # 설문 레지스트리 (getSurveyConfig, getAllSurveyConfigs)
  survey-001.ts      # 1차 간단 설문 config
  survey-002.ts      # 기존 상세 설문 config

web/src/lib/
  survey-sheets.ts   # Google Sheets 연동 (config 기반 범용)
  survey-pdf.ts      # PDF 생성 요청 (config 기반 범용)

web/src/app/
  survey/page.tsx                    # 설문 목록 페이지
  survey/[surveyId]/page.tsx         # 개별 설문 관리 페이지
  api/survey/route.ts                # GET: 설문 목록
  api/survey/[surveyId]/route.ts     # GET: 설문 상세 (stats + responses)
  api/survey/[surveyId]/generate/route.ts  # POST: PDF 생성

src/apps-script/
  survey_generic_webapp.gs           # 범용 PDF 생성 웹앱 (1개로 모든 설문 처리)
  survey_001_form.gs                 # 1차 설문 Form 생성 (1회 실행)
  survey_001_template.gs             # 1차 설문 Docs 템플릿 생성 (1회 실행)
```

## 새 설문 추가 절차

### 1. config 파일 생성

`web/src/lib/surveys/survey-NNN.ts` 파일 생성:

```typescript
import type { SurveyConfig } from './types';

export const SURVEY_NNN_CONFIG: SurveyConfig = {
  id: 'survey-NNN',
  title: '설문 제목',
  organizer: '주최',
  intro: '안내문',
  notice: '하단 안내',
  basicInfoFields: [
    { key: 'dong', sheetColumn: '동', label: '동', type: 'select', options: [...], required: true },
    { key: 'ho', sheetColumn: '호', label: '호수', type: 'text', required: true },
    { key: 'name', sheetColumn: '성명', label: '성명', type: 'text', required: true },
    { key: 'phone', sheetColumn: '연락처', label: '연락처', type: 'text', required: true },
    // 추가 필드 (연령대 등)
  ],
  questions: [
    { id: 'Q1', label: '질문 내용', options: ['옵션1', '옵션2'] },
    // ...
  ],
  envKeys: {
    spreadsheetId: 'SURVEY_NNN_SPREADSHEET_ID',
    templateDocId: 'SURVEY_NNN_TEMPLATE_DOC_ID',
    pdfFolderId: 'SURVEY_NNN_PDF_FOLDER_ID',
  },
};
```

### 2. registry에 등록

`web/src/lib/surveys/registry.ts`에 import + 등록:

```typescript
import { SURVEY_NNN_CONFIG } from './survey-NNN';

const SURVEY_REGISTRY: Record<string, SurveyConfig> = {
  // ...기존
  'survey-NNN': SURVEY_NNN_CONFIG,
};
```

### 3. Google Form 생성 스크립트 작성 & 실행

`src/apps-script/survey_NNN_form.gs` — 기존 form.gs를 복사 후 질문 수정, 실행하면:
- Google Form 생성
- 응답 시트 자동 연결
- PDF생성여부/PDF링크 컬럼 추가
- 출력되는 시트 ID를 `.env.local`에 추가

### 4. Google Docs 템플릿 생성 스크립트 작성 & 실행

`src/apps-script/survey_NNN_template.gs` — 기존 template.gs를 복사 후 질문 수정, 실행하면:
- Google Docs 템플릿 생성 (플레이스홀더 포함)
- 출력되는 문서 ID를 `.env.local`에 추가

### 5. 환경변수 추가

`.env.local`에 추가:

```
SURVEY_NNN_SPREADSHEET_ID=<Form 생성 후 출력된 시트 ID>
SURVEY_NNN_TEMPLATE_DOC_ID=<템플릿 생성 후 출력된 문서 ID>
SURVEY_NNN_PDF_FOLDER_ID=<PDF 저장할 Drive 폴더 ID>
```

### 6. 완료

- `/survey` 접속 → 새 설문이 목록에 표시됨
- `/survey/survey-NNN` → 관리 페이지 사용 가능

## 환경변수 목록

| 변수 | 용도 |
|------|------|
| `SURVEY_WEBAPP_URL` | 범용 PDF 웹앱 URL (전체 공유) |
| `SURVEY_NNN_SPREADSHEET_ID` | 설문별 응답 시트 ID |
| `SURVEY_NNN_TEMPLATE_DOC_ID` | 설문별 Docs 템플릿 ID |
| `SURVEY_NNN_PDF_FOLDER_ID` | 설문별 PDF 저장 폴더 ID |

## Apps Script 배포 순서

1. `survey_NNN_template.gs` 실행 → Docs 템플릿 생성, 문서 ID 기록
2. `survey_NNN_form.gs` 실행 → Form + 응답 시트 생성, 시트 ID 기록
3. `survey_generic_webapp.gs` 배포 (최초 1회만, 이후 설문 추가 시 재배포 불필요)
4. `.env.local`에 ID들 추가
5. 서버 재시작

## 기존 설문 코드

- `survey-config.ts` — survey-002를 re-export하는 호환 레이어
- `survey_pdf_webapp.gs` — survey-002 전용 (기존 배포 유지)
- `survey_form.gs`, `survey_template.gs` — survey-002 생성용 (실행 완료)
