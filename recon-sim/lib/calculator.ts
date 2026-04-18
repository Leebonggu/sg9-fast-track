/**
 * ════════════════════════════════════════════════════════════════
 * 재건축 분담금 계산 엔진
 *
 * 공식 출처: 중계주공5단지 재건축사업 주민설명회 자료 (2026.4.18)
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 핵심 공식                                                   │
 * │                                                             │
 * │ 비례율 = (총수입 - 총지출) / 종전자산 총액                  │
 * │                                                             │
 * │ 조합원 권리가액 = 세대당 종전자산 추정가 × 비례율           │
 * │                                                             │
 * │ 추정분담금 = 조합원 분양가 - 조합원 권리가액               │
 * │   (+) 납부 / (-) 환급                                       │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 수정 방법: 이 파일만 수정하면 모든 화면에 자동 반영됩니다.
 * ════════════════════════════════════════════════════════════════
 */

import {
  ProjectData,
  CalculationResult,
  ExpenseConfig,
  ExcessProfitConfig,
  ScenarioCell,
  FARScenarioResult,
  ExcessProfitResult,
} from './types';

// ──────────────────────────────────────────────
// 단위 변환 헬퍼
// ──────────────────────────────────────────────

/** 만원 → 천원 (내부 계산 단위는 천원) */
export const manToChun = (man: number): number => man * 10;

/** 억원 → 천원 */
export const eokToChun = (eok: number): number => eok * 100_000;

/** 천원 → 억원 */
export const chunToEok = (chun: number): number => chun / 100_000;

/** 천원 → 만원 */
export const chunToMan = (chun: number): number => chun / 10;

/** ㎡ → 평 */
export const sqmToPyeong = (sqm: number): number => sqm / 3.3058;

// ──────────────────────────────────────────────
// 수입 계산
// ──────────────────────────────────────────────

/**
 * [공식] 일반분양 수입 (천원)
 * = Σ (일반분양 세대수 × 평당 분양가(만원) × 평형)
 *
 * @param saleMult 분양가 변동 배수 (시나리오용, 기본 1)
 */
export function calcGeneralSalesRevenue(data: ProjectData, saleMult = 1): number {
  return data.newUnits.reduce((sum, unit) => {
    const pricePerUnit = manToChun(unit.generalPricePerPyeong * unit.pyeong) * saleMult;
    return sum + unit.generalCount * pricePerUnit;
  }, 0);
}

/**
 * [공식] 조합원분양 수입 (천원)
 * = Σ (조합원 세대수 × 일반분양가 × 조합원비율)
 *
 * 조합원비율: 통상 일반분양가의 90% 적용 (중계주공5단지 기준)
 */
export function calcMemberSalesRevenue(data: ProjectData, saleMult = 1): number {
  return data.newUnits.reduce((sum, unit) => {
    const generalPricePerUnit = manToChun(unit.generalPricePerPyeong * unit.pyeong) * saleMult;
    const memberPricePerUnit = generalPricePerUnit * unit.memberRatio;
    return sum + unit.memberCount * memberPricePerUnit;
  }, 0);
}

/**
 * [공식] 임대주택 매각 수입 (천원)
 * = Σ (임대 세대수 × 세대당 매각가)
 */
export function calcRentalRevenue(data: ProjectData, saleMult = 1): number {
  return data.newUnits.reduce((sum, unit) => {
    return sum + unit.rentalCount * unit.rentalSalePricePerUnit * saleMult;
  }, 0);
}

/**
 * [공식] 이주비 이자 환입 (천원)
 * = 기본이주비 금융비용 + 추가이주비 금융비용 + 중도금 대출 금융비용
 *
 * 이주비·중도금 이자는 조합원이 개별 부담하므로 수입으로 환입 처리
 * (지출에도 포함, 수입에도 포함 → 상쇄되어 비례율에 영향 없음)
 */
export function calcFinancingReturn(expenses: ExpenseConfig): number {
  return (
    expenses.moveoutFinancing +
    expenses.additionalMoveoutFinancing +
    expenses.midpaymentFinancing
  );
}

/**
 * [공식] 총수입 (천원)
 * = 일반분양 + 조합원분양 + 임대매각 + 상가분양 + 이주비이자환입
 */
export function calcTotalRevenue(data: ProjectData, saleMult = 1): number {
  return (
    calcGeneralSalesRevenue(data, saleMult) +
    calcMemberSalesRevenue(data, saleMult) +
    calcRentalRevenue(data, saleMult) +
    data.newCommercialRevenue * saleMult +
    calcFinancingReturn(data.expenses)
  );
}

// ──────────────────────────────────────────────
// 지출 계산
// ──────────────────────────────────────────────

/**
 * [공식] 건축 공사비 (천원)
 * = 총 연면적(평) × 평당 공사비(만원) × 10
 *
 * 참고값: 신탁방식 770만원/평, 조합방식 800만원/평 (2026년 기준)
 *
 * @param costMult 공사비 변동 배수 (시나리오용, 기본 1)
 */
export function calcConstructionCost(expenses: ExpenseConfig, costMult = 1): number {
  return manToChun(expenses.constructionCostPerPyeong * expenses.totalFloorAreaPyeong) * costMult;
}

/**
 * [공식] 공사비 외 기타 지출 합계 (천원)
 */
export function calcOtherExpenses(expenses: ExpenseConfig): number {
  return (
    expenses.designFee +
    expenses.supervisionFee +
    expenses.surveyFee +
    expenses.trafficBurden +
    expenses.schoolBurden +
    expenses.waterBurden +
    expenses.electricBurden +
    expenses.registrationFee +
    expenses.bondPurchase +
    expenses.trustFee +
    expenses.projectLoanFee +
    expenses.moveoutFinancing +
    expenses.additionalMoveoutFinancing +
    expenses.midpaymentFinancing +
    expenses.hugGuaranteeFee +
    expenses.salesGuaranteeFee +
    expenses.advertisingFee +
    expenses.managementFee +
    expenses.meetingFee +
    expenses.contingency +
    expenses.compensationFee +
    expenses.otherOutsourcingFee
  );
}

/**
 * [공식] 총지출 (천원) = 공사비 + 기타 지출
 */
export function calcTotalExpense(data: ProjectData, costMult = 1): number {
  return calcConstructionCost(data.expenses, costMult) + calcOtherExpenses(data.expenses);
}

// ──────────────────────────────────────────────
// 핵심 비례율 계산
// ──────────────────────────────────────────────

/**
 * [공식] 종전자산 총액 (천원)
 * = Σ(아파트 세대당 추정가 × 세대수) + 상가 자산
 */
export function calcTotalOriginalAsset(data: ProjectData): number {
  const aptTotal = data.originalUnits.reduce(
    (sum, u) => sum + u.count * u.valuePerUnit,
    0
  );
  return aptTotal + data.commercialValue;
}

/**
 * [핵심 공식] 비례율
 * = (총수입 - 총지출) / 종전자산 총액
 *
 * 100% 초과: 수입 > 지출 → 소형 평형은 환급 발생 가능
 * 100% 미만: 수입 < 지출 → 분담금 증가
 */
export function calcRatio(
  totalRevenue: number,
  totalExpense: number,
  totalOriginalAsset: number
): number {
  if (totalOriginalAsset === 0) return 0;
  return (totalRevenue - totalExpense) / totalOriginalAsset;
}

/**
 * [핵심 공식] 조합원 권리가액 (천원)
 * = 세대당 종전자산 추정가 × 비례율
 */
export function calcMemberRights(valuePerUnit: number, ratio: number): number {
  return valuePerUnit * ratio;
}

/**
 * [공식] 조합원 분양가 (천원/세대)
 * = 평당 일반분양가(만원) × 평형 × 조합원비율 × 10
 */
export function calcMemberPrice(
  generalPricePerPyeong: number,
  pyeong: number,
  memberRatio: number,
  saleMult = 1
): number {
  return manToChun(generalPricePerPyeong * pyeong) * memberRatio * saleMult;
}

/**
 * [핵심 공식] 추정분담(환급)금 (천원/세대)
 * = 조합원 분양가 - 조합원 권리가액
 *
 * 양수(+): 분담금 납부
 * 음수(-): 환급
 */
export function calcBurden(memberPrice: number, memberRights: number): number {
  return memberPrice - memberRights;
}

// ──────────────────────────────────────────────
// 전체 계산 (메인 진입점)
// ──────────────────────────────────────────────

/**
 * 프로젝트 전체 계산
 * @param saleMult 분양가 배수 (시나리오: 0.9~1.1)
 * @param costMult 공사비 배수 (시나리오: 0.9~1.1)
 */
export function calculateProject(
  data: ProjectData,
  saleMult = 1,
  costMult = 1
): CalculationResult {
  const totalOriginalAsset = calcTotalOriginalAsset(data);

  const generalSalesRevenue = calcGeneralSalesRevenue(data, saleMult);
  const memberSalesRevenue = calcMemberSalesRevenue(data, saleMult);
  const rentalRevenue = calcRentalRevenue(data, saleMult);
  const commercialRevenue = data.newCommercialRevenue * saleMult;
  const financingReturnRevenue = calcFinancingReturn(data.expenses);
  const totalRevenue =
    generalSalesRevenue +
    memberSalesRevenue +
    rentalRevenue +
    commercialRevenue +
    financingReturnRevenue;

  const constructionCost = calcConstructionCost(data.expenses, costMult);
  const otherExpenseTotal = calcOtherExpenses(data.expenses);
  const totalExpense = constructionCost + otherExpenseTotal;

  const ratio = calcRatio(totalRevenue, totalExpense, totalOriginalAsset);

  const memberRightsMap: Record<string, number> = {};
  const burdenMap: Record<string, Record<string, number>> = {};

  for (const original of data.originalUnits) {
    const rights = calcMemberRights(original.valuePerUnit, ratio);
    memberRightsMap[original.id] = rights;
    burdenMap[original.id] = {};

    for (const newUnit of data.newUnits) {
      const memberPrice = calcMemberPrice(
        newUnit.generalPricePerPyeong,
        newUnit.pyeong,
        newUnit.memberRatio,
        saleMult
      );
      burdenMap[original.id][newUnit.id] = calcBurden(memberPrice, rights);
    }
  }

  return {
    totalOriginalAsset,
    totalRevenue,
    generalSalesRevenue,
    memberSalesRevenue,
    rentalRevenue,
    commercialRevenue,
    financingReturnRevenue,
    totalExpense,
    constructionCost,
    otherExpenseTotal,
    ratio,
    memberRightsMap,
    burdenMap,
  };
}

// ──────────────────────────────────────────────
// 분양가 × 공사비 시나리오 (5×5 매트릭스)
// ──────────────────────────────────────────────

/** 분양가 변동 구간 (-10% ~ +10%) */
export const SALE_STEPS = [-0.10, -0.05, 0, 0.05, 0.10] as const;

/** 공사비 변동 구간 (-10% ~ +10%) */
export const COST_STEPS = [-0.10, -0.05, 0, 0.05, 0.10] as const;

/**
 * 분양가 × 공사비 5×5 시나리오 매트릭스 계산
 * 행: 분양가 변동, 열: 공사비 변동
 */
export function calculateScenarioMatrix(data: ProjectData): ScenarioCell[][] {
  return SALE_STEPS.map((sp) =>
    COST_STEPS.map((cc) => {
      const result = calculateProject(data, 1 + sp, 1 + cc);
      return {
        salePriceMult: 1 + sp,
        constructionCostMult: 1 + cc,
        ratio: result.ratio,
        burdenMap: result.burdenMap,
      };
    })
  );
}

// ──────────────────────────────────────────────
// 용적률 시나리오
// ──────────────────────────────────────────────

/**
 * [공식] 용적률 변화 시나리오
 *
 * 가정:
 *   - 조합원 배정 세대수: 고정
 *   - 일반분양 세대수: 용적률에 비례
 *   - 지상 연면적: 용적률에 비례 (지상 공사비 선형 변동)
 *   - 지하 연면적: 고정 (주차장·기계실 등은 용적률과 무관)
 *
 * 즉, 용적률이 2배가 돼도 공사비가 2배가 되는 것은 아니며,
 * 지상 부분(약 60%)만 비례하여 증가합니다.
 *
 * @param targetFARs 시뮬레이션할 용적률 배열 (%) ex: [250, 300, 350, 400]
 */
export function calculateFARScenarios(
  data: ProjectData,
  targetFARs: number[]
): FARScenarioResult[] {
  const baseFAR = data.plannedFAR;
  const totalArea = data.expenses.totalFloorAreaPyeong;
  const undergroundRatio = data.expenses.undergroundAreaRatio ?? 0.4;
  const baseAboveArea = totalArea * (1 - undergroundRatio);
  const baseUndergroundArea = totalArea * undergroundRatio;

  return targetFARs.map((far) => {
    const farRatio = baseFAR > 0 ? far / baseFAR : 1;

    // 지상만 비례 변동, 지하는 고정
    const newAboveArea = baseAboveArea * farRatio;
    const newTotalArea = newAboveArea + baseUndergroundArea;

    const adjustedData: ProjectData = {
      ...data,
      newUnits: data.newUnits.map((unit) => ({
        ...unit,
        // 일반분양 세대수만 용적률에 비례하여 변동
        generalCount: Math.round(unit.generalCount * farRatio),
      })),
      expenses: {
        ...data.expenses,
        totalFloorAreaPyeong: Math.round(newTotalArea),
      },
    };

    return { far, result: calculateProject(adjustedData) };
  });
}

/** 기본 용적률 시나리오 구간 */
export const DEFAULT_FAR_STEPS = [200, 250, 300, 350, 400] as const;

// ──────────────────────────────────────────────
// 재건축 초과이익 환수 계산
// ──────────────────────────────────────────────

/**
 * [공식] 재건축 초과이익 환수 (세대당)
 * 근거법: 재건축초과이익 환수에 관한 법률 (2024.3 개정 반영)
 *
 * 초과이익 = 종료시점 주택가액 - 개시시점 주택가액 - 정상상승분 - 개발비용
 *   - 개시시점 = 조합설립인가일 (2024.3 개정, 종전: 추진위원회 승인일)
 *   - 종료시점 = 준공인가일
 * 정상상승분 = 개시시점 주택가액 × ((1 + 연상승률)^기간 - 1)
 *   - 연상승률 = max(정기예금이자율, 시·군·구 평균 주택가격상승률)
 *
 * 누진세율 (2024.3 개정 — 면제 기준 8천만원으로 상향):
 *   8,000만원 이하:        0%   (면제)
 *   8,000만 ~ 1.3억:      10%
 *   1.3억 ~ 1.8억:        20%
 *   1.8억 ~ 2.3억:        30%
 *   2.3억 ~ 2.8억:        40%
 *   2.8억 초과:           50%
 *
 * ※ 정확한 구간 금액은 시행령 원문 확인 권장
 * ※ 1세대 1주택 장기보유 감면(최대 70%), 60세 이상 납부유예는 미반영
 *
 * @param devCostPerUnit 세대당 개발비용 (천원) - 선택사항, 미입력 시 0
 */
export function calcExcessProfitBurden(
  config: ExcessProfitConfig,
  devCostPerUnit = 0
): ExcessProfitResult {
  const { baseHousePrice, projectedHousePrice, projectDurationYears, normalRiseRate } = config;

  const normalRise = baseHousePrice * (Math.pow(1 + normalRiseRate, projectDurationYears) - 1);
  const rawExcess = projectedHousePrice - baseHousePrice - normalRise - devCostPerUnit;
  const excessProfit = Math.max(0, rawExcess);

  // 누진세율 계산 (단위: 천원, 2024.3 개정)
  let burden = 0;
  const EP = excessProfit;

  if (EP <= 80_000) {
    burden = 0;
  } else if (EP <= 130_000) {
    burden = (EP - 80_000) * 0.10;
  } else if (EP <= 180_000) {
    burden = 5_000 + (EP - 130_000) * 0.20;
  } else if (EP <= 230_000) {
    burden = 5_000 + 10_000 + (EP - 180_000) * 0.30;
  } else if (EP <= 280_000) {
    burden = 5_000 + 10_000 + 15_000 + (EP - 230_000) * 0.40;
  } else {
    burden = 5_000 + 10_000 + 15_000 + 20_000 + (EP - 280_000) * 0.50;
  }

  const effectiveRate = EP > 0 ? burden / EP : 0;

  return { normalRise, excessProfit: EP, burden, effectiveRate };
}
