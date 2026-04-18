// 재건축 분담금 시뮬레이터 타입 정의

export interface OriginalUnit {
  id: string;
  name: string;        // "13평형", "15평형" 등
  pyeong: number;      // 평형 크기
  count: number;       // 세대수
  valuePerUnit: number; // 세대당 종전자산 추정가 (천원)
}

export interface NewUnit {
  id: string;
  name: string;          // "17평형(39㎡)" 등
  sqm: number;           // 전용면적 m²
  pyeong: number;        // 평형 (전용 기준)
  memberCount: number;   // 조합원 세대수
  generalCount: number;  // 일반분양 세대수
  rentalCount: number;   // 임대 세대수
  generalPricePerPyeong: number; // 일반분양 평당가 (만원/평)
  memberRatio: number;   // 조합원분양가 = 일반분양가 × ratio (통상 0.9)
  rentalSalePricePerUnit: number; // 임대 세대당 매각가 (천원)
}

export interface ExpenseConfig {
  // 공사비
  constructionCostPerPyeong: number; // 평당 공사비 (만원/평), 기본 800
  totalFloorAreaPyeong: number;      // 총 연면적 (평) - 공사 대상
  undergroundAreaRatio: number;      // 지하 연면적 비율 (0~1, 기본 0.4) — 용적률 시나리오 시 지하는 고정

  // 설계·감리·측량
  designFee: number;       // 설계비 (천원)
  supervisionFee: number;  // 감리비 (천원)
  surveyFee: number;       // 측량조사비 (천원)

  // 부담금
  trafficBurden: number;   // 교통시설부담금 (천원)
  schoolBurden: number;    // 학교용지부담금 (천원)
  waterBurden: number;     // 상하수도부담금 (천원)
  electricBurden: number;  // 전기통신부담금 (천원)

  // 제세공과금
  registrationFee: number; // 보존등기비 (천원)
  bondPurchase: number;    // 채권매입·법인세 (천원)

  // 보수료 및 금융비용
  trustFee: number;                   // 신탁보수료 (천원)
  projectLoanFee: number;             // 사업비 대여금 금융비용 (천원)
  moveoutFinancing: number;           // 기본 이주비 금융비용 (천원)
  additionalMoveoutFinancing: number; // 추가 이주비 금융비용 (천원)
  midpaymentFinancing: number;        // 조합원 중도금 대출 금융비용 (천원)
  hugGuaranteeFee: number;            // HUG 보증수수료 (천원)

  // 기타 사업비
  salesGuaranteeFee: number;   // 분양보증수수료 (천원)
  advertisingFee: number;      // 광고선전비 (천원)
  managementFee: number;       // 추진위원회·조합운영비 (천원)
  meetingFee: number;          // 총회개최비 (천원)
  contingency: number;         // 예비비 (천원)
  compensationFee: number;     // 보상비(현금청산자) (천원)
  otherOutsourcingFee: number; // 기타 외주비 합계 (천원)
}

export interface ExcessProfitConfig {
  enabled: boolean;
  baseHousePrice: number;       // 개시시점(조합설립인가일) 세대당 주택가액 (천원) — 2024.3 개정
  projectedHousePrice: number;  // 종료시점(준공인가일) 예상 세대당 주택가액 (천원)
  projectDurationYears: number; // 사업 기간 (년)
  normalRiseRate: number;       // 정상주택가격상승률 연율 (e.g. 0.025)
}

export interface ProjectData {
  // 단지 기본정보
  name: string;
  location: string;
  totalUnits: number;      // 기존 아파트 총 세대수
  totalBuildings: number;  // 동수
  completionYear: number;  // 준공연도
  landAreaSqm: number;     // 대지면적 (m²)
  currentFAR: number;      // 현재 용적률 (%)
  plannedFAR: number;      // 계획 용적률 (%)

  // 종전자산
  originalUnits: OriginalUnit[];
  commercialCount: number;  // 종전 상가 개수
  commercialValue: number;  // 종전 상가 자산 추정가 (천원)

  // 신축 계획
  newUnits: NewUnit[];
  newCommercialRevenue: number; // 신축 상가 분양 수입 (천원)

  // 지출 항목
  expenses: ExpenseConfig;

  // 재건축 초과이익 환수
  excessProfit: ExcessProfitConfig;

  updatedAt?: string;
}

export interface CalculationResult {
  // 종전자산
  totalOriginalAsset: number;

  // 총수입 (단위: 천원)
  totalRevenue: number;
  generalSalesRevenue: number;
  memberSalesRevenue: number;
  rentalRevenue: number;
  commercialRevenue: number;
  financingReturnRevenue: number; // 이주비 이자 환입

  // 총지출 (단위: 천원)
  totalExpense: number;
  constructionCost: number;
  otherExpenseTotal: number;

  // 비례율
  ratio: number;

  // 평형별 결과 (단위: 천원)
  memberRightsMap: Record<string, number>; // originalUnit.id → 조합원 권리가액
  burdenMap: Record<string, Record<string, number>>; // originalUnit.id → newUnit.id → 분담금
}

export interface ScenarioCell {
  salePriceMult: number;
  constructionCostMult: number;
  ratio: number;
  burdenMap: Record<string, Record<string, number>>;
}

export interface FARScenarioResult {
  far: number;
  result: CalculationResult;
}

export interface ExcessProfitResult {
  normalRise: number;      // 정상상승분 (천원)
  excessProfit: number;    // 초과이익 (천원)
  burden: number;          // 부담금 (천원)
  effectiveRate: number;   // 실효세율
}
