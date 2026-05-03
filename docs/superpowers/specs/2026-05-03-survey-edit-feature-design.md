# Survey 응답 수정 기능 설계

## 개요

설문 관리 페이지(`/survey/[surveyId]`)에서 기존 응답을 수정할 수 있는 기능 추가.
삭제 기능과 동일한 모달 패턴을 사용하며, 수정 이력을 비고 컬럼에 누적 기록한다.

## 수정 가능 필드

- basicInfo 전체: 동, 호, 성명, 연락처, 연령대 등 설문 config의 basicInfoFields
- 설문 답변 전체: config의 questions 전체 (select UI)

## UI 흐름

1. 테이블 각 행 액션 영역에 `수정` 버튼 추가
2. 클릭 시 수정 모달 오픈 — 현재 값 pre-fill
3. 모달 구성:
   - basicInfo 필드 (type: select → `<select>`, type: text → `<input>`)
   - 설문 문항 6개 (select UI)
   - 수정자명 (text input, 필수)
4. 저장 클릭 → PATCH API 호출 → 성공 시 모달 닫고 데이터 reload

## API

`PATCH /api/survey/[surveyId]`

Request body:
```json
{
  "rowIndex": 3,
  "basicInfo": { "dong": "901동", "ho": "101", "name": "김영희", ... },
  "answers": { "Q1": "필요하다", ... },
  "editorName": "홍길동"
}
```

Response: `{ ok: true }`

## 데이터 레이어

`updateSurveyResponse(config, rowIndex, basicInfo, answers, editorName)` 함수 신규 추가 (`survey-sheets.ts`):

1. 시트에서 해당 행 읽기
2. 변경된 필드 감지 (이전값 vs 새값 비교)
3. 변경된 필드만 시트에 set
4. 비고 컬럼 append:
   - 기존 비고값 읽기
   - `[YYYY-MM-DD 수정자명] 필드1: 이전→이후, 필드2: 이전→이후` 포맷으로 생성
   - 기존값 있으면 ` | ` 구분자로 이어붙임
   - 비고 컬럼 set
5. `row.save()`

비고 예시:
```
[2026-05-03 홍길동] 성명: 김철수→김영희 | [2026-05-04 이순신] Q1: 필요하다→잘 모르겠다
```

## 주의사항

- **비고 컬럼 헤더 처리**: google-spreadsheet는 헤더 기반으로 동작. `비고`가 시트 헤더에 없으면 `row.set()` 무시됨.
  구현 시 `sheet.headerValues`로 확인 후 없으면 `sheet.setHeaderRow([...headers, '비고'])` 호출 후 rows 재로드
- 변경 없는 필드는 비고에 기록하지 않음 (diff만 기록)
- 수정자명 미입력 시 저장 불가 (클라이언트 validation)
