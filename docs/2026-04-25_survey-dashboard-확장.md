# Survey 대시보드 확장: 미응답 현황 + 연령별 교차 분석

**작업일**: 2026-04-25
**브랜치**: main (직접 커밋 전 상태)

---

## 구현 내용

### 신규 파일

| 파일 | 역할 |
|------|------|
| `web/src/app/api/survey/[surveyId]/missing/route.ts` | 미응답 세대 API — BUILDING_CONFIG 전체 유닛 생성 후 응답자 집합과 비교, 동별 응답/미응답 반환 |
| `web/src/components/survey/CrossTabChart.tsx` | 재사용 스택 바 차트 — rows×cols 행렬, Tailwind CSS only, 호버 툴팁 |
| `web/src/components/survey/MissingRespondents.tsx` | 미응답 현황 컴포넌트 — 동별 아코디언, 응답/미응답 토글 뷰 |
| `web/src/components/survey/SurveyAnalytics.tsx` | 통계 분석 컴포넌트 — 연령대 분포 + 연령대×Q1/Q2/Q3/Q6 CrossTabChart, PDF 내보내기 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `web/src/app/survey/[surveyId]/page.tsx` | 3탭 UI 추가 (응답 목록 \| 미응답 \| 통계 분석) |

---

## API 스펙

### `GET /api/survey/[surveyId]/missing`

```typescript
type MissingByDong = {
  dong: string;
  total: number;        // 전체 세대수
  responded: number;    // 응답 세대수
  missing: string[];    // 미응답 호수 ["101호", ...]
  respondedHos: string[]; // 응답 호수 ["102호", ...]
}
// 응답률 낮은 순 정렬
{ missing: MissingByDong[] }
```

---

## 컴포넌트 인터페이스

### CrossTabChart
```typescript
interface CrossTabChartProps {
  title: string;
  rows: string[];       // e.g. ['20대', '30대', '40대', '50대', '60대 이상']
  cols: string[];       // e.g. ['10평대', '20평대', '30평대', '40평대 이상']
  data: number[][];     // rows × cols count matrix
  colors?: string[];
}
```

### SurveyAnalytics
```typescript
interface SurveyAnalyticsProps {
  config: SurveyConfigMeta;
  responses: SurveyResponse[];
}
```
- `useMemo`로 crossTab 계산, 추가 API 없음
- `html2canvas-pro` + `pdf-lib`로 A4 landscape PDF 내보내기

---

## 주요 설계 결정

- **연령대 데이터 없음 처리**: 기존 응답에 ageGroup 데이터가 없으면 amber 경고 배너 표시, 각 CrossTabChart는 `hasData()` 체크 후 "데이터 없음" 텍스트로 대체
- **탭 바 top 오프셋**: 헤더 실제 높이 64px (`p-3.5` × 2 + `h-9`) 기준으로 `top-[64px]` 설정 (기존 `top-[52px]`에서 수정)
- **미응답 뷰 토글**: "미응답만" / "전체 보기" 토글로 응답(파랑) + 미응답(빨강) 동시 표시 가능
- **CrossTabChart 재사용**: rows/cols/data 행렬만 주면 어떤 설문에서도 사용 가능

---

## 알려진 제약

- 연령대 교차 분석은 `basicInfo.ageGroup` 필드가 있는 응답에서만 작동 (survey-001 신규 응답 기준)
- PDF 내보내기는 전체 분석 영역을 한 번에 캡처해 A4 landscape로 타일링 (페이지 분할 최적화 미적용)
