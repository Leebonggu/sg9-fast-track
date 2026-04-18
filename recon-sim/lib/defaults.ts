import { ProjectData } from './types';

/**
 * 상계주공9단지 기본값
 * 재무 수치(종전자산, 분양가 등)는 관리자가 /setup 에서 직접 입력해야 합니다.
 */
export const SG9_DEFAULT: ProjectData = {
  name: '상계주공9단지',
  location: '서울시 노원구 상계동',
  totalUnits: 2830,
  totalBuildings: 23,
  completionYear: 1992,
  landAreaSqm: 0,
  currentFAR: 0,
  plannedFAR: 300,

  // 종전 평형 — 세대수·추정가는 관리자 입력 필요
  originalUnits: [
    { id: 'orig-1', name: '13평형', pyeong: 13, count: 0, valuePerUnit: 0 },
    { id: 'orig-2', name: '15평형', pyeong: 15, count: 0, valuePerUnit: 0 },
    { id: 'orig-3', name: '18평형', pyeong: 18, count: 0, valuePerUnit: 0 },
    { id: 'orig-4', name: '24평형', pyeong: 24, count: 0, valuePerUnit: 0 },
  ],
  commercialCount: 0,
  commercialValue: 0,

  // 신축 계획 — 세대수·분양가는 관리자 입력 필요
  newUnits: [
    {
      id: 'new-1', name: '17평형(39㎡)',
      sqm: 39, pyeong: 17,
      memberCount: 0, generalCount: 0, rentalCount: 0,
      generalPricePerPyeong: 3500, memberRatio: 0.9,
      rentalSalePricePerUnit: 0,
    },
    {
      id: 'new-2', name: '25평형(59㎡)',
      sqm: 59, pyeong: 25,
      memberCount: 0, generalCount: 0, rentalCount: 0,
      generalPricePerPyeong: 3500, memberRatio: 0.9,
      rentalSalePricePerUnit: 0,
    },
    {
      id: 'new-3', name: '35평형(84㎡)',
      sqm: 84, pyeong: 35,
      memberCount: 0, generalCount: 0, rentalCount: 0,
      generalPricePerPyeong: 3800, memberRatio: 0.9,
      rentalSalePricePerUnit: 0,
    },
  ],
  newCommercialRevenue: 0,

  expenses: {
    constructionCostPerPyeong: 800, // 800만원/평 (2026년 기준 조합방식)
    totalFloorAreaPyeong: 0,
    undergroundAreaRatio: 0.4,      // 통상 지하 비율 약 40% (주차장·기계실 등)
    designFee: 0,
    supervisionFee: 0,
    surveyFee: 0,
    trafficBurden: 0,
    schoolBurden: 0,
    waterBurden: 0,
    electricBurden: 0,
    registrationFee: 0,
    bondPurchase: 0,
    trustFee: 0,
    projectLoanFee: 0,
    moveoutFinancing: 0,
    additionalMoveoutFinancing: 0,
    midpaymentFinancing: 0,
    hugGuaranteeFee: 0,
    salesGuaranteeFee: 0,
    advertisingFee: 0,
    managementFee: 0,
    meetingFee: 0,
    contingency: 0,
    compensationFee: 0,
    otherOutsourcingFee: 0,
  },

  excessProfit: {
    enabled: false,
    baseHousePrice: 0,
    projectedHousePrice: 0,
    projectDurationYears: 10,
    normalRiseRate: 0.025,
  },
};
