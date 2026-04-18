/**
 * 회귀 테스트 — 중계주공5단지 PDF 케이스
 *
 * 출처: 중계주공5단지 재건축사업 주민설명회 자료 (2026.4.18) p.21~38
 *
 * PDF의 입력값을 그대로 calculator.ts에 흘려보내, PDF가 명시한 결과치
 * (비례율 108.79%, 평형별 권리가액·분담금)와 일치하는지 검증.
 *
 * 누군가 calculator.ts를 잘못 수정하면 이 테스트로 즉시 잡힌다.
 *
 * 실행: npm test
 */
import { calculateProject } from '../lib/calculator';
import { ProjectData } from '../lib/types';

// ────────────────────────────────────────────────
// PDF 입력값 (중계주공5단지, 신탁방식 가정)
// ────────────────────────────────────────────────

const JG5_CASE: ProjectData = {
  name: '중계주공5단지',
  location: '서울시 노원구 중계동 359-1',
  totalUnits: 2328,
  totalBuildings: 18,
  completionYear: 1992,
  landAreaSqm: 95461.1,
  currentFAR: 182,
  plannedFAR: 344.87,

  // 종전자산 (PDF p.30) — 단위 천원
  originalUnits: [
    { id: 'orig-15', name: '15평형', pyeong: 15.25, count: 360, valuePerUnit: 413_330 },
    { id: 'orig-17a', name: '17평형(소)', pyeong: 17.73, count: 180, valuePerUnit: 485_830 },
    { id: 'orig-17b', name: '17평형(대)', pyeong: 17.91, count: 540, valuePerUnit: 485_830 },
    { id: 'orig-24', name: '24평형', pyeong: 24.29, count: 528, valuePerUnit: 728_000 },
    { id: 'orig-28', name: '28평형', pyeong: 28.51, count: 360, valuePerUnit: 957_080 },
    { id: 'orig-31', name: '31평형', pyeong: 31.60, count: 360, valuePerUnit: 1_091_660 },
  ],
  commercialCount: 3,
  commercialValue: 29_077_400, // 상가 3개동, 단가 12,100천원 기준

  // 신축계획 (PDF p.21, 31, 32) — 평당가는 만원/평
  newUnits: [
    {
      id: 'new-17', name: '17평형(39㎡)', sqm: 39.98, pyeong: 17.04,
      memberCount: 300, generalCount: 97, rentalCount: 0,
      generalPricePerPyeong: 4145.4, // 41,454천원/평 = 4,145.4만원/평
      memberRatio: 37308 / 41454, // PDF 평균 0.9 정확히
      rentalSalePricePerUnit: 0,
    },
    {
      id: 'new-22', name: '22평형(51㎡)', sqm: 51.99, pyeong: 21.83,
      memberCount: 394, generalCount: 65, rentalCount: 0,
      generalPricePerPyeong: 4187.7,
      memberRatio: 37689 / 41877,
      rentalSalePricePerUnit: 0,
    },
    {
      id: 'new-25', name: '25평형(59㎡)', sqm: 59.99, pyeong: 25.19,
      memberCount: 700, generalCount: 146, rentalCount: 200,
      generalPricePerPyeong: 4145.4,
      memberRatio: 37308 / 41454,
      rentalSalePricePerUnit: 258_645, // PDF 임대 25평 세대당
    },
    {
      id: 'new-31', name: '31평형(74㎡)', sqm: 74.99, pyeong: 30.89,
      memberCount: 230, generalCount: 37, rentalCount: 0,
      generalPricePerPyeong: 4060.8,
      memberRatio: 36547 / 40608,
      rentalSalePricePerUnit: 0,
    },
    {
      id: 'new-35', name: '35평형(84㎡)', sqm: 84.99, pyeong: 35.31,
      memberCount: 700, generalCount: 174, rentalCount: 116,
      generalPricePerPyeong: 4230.0,
      memberRatio: 38070 / 42300,
      rentalSalePricePerUnit: 336_841,
    },
    {
      id: 'new-55', name: '55평형(129㎡, 펜트)', sqm: 129.99, pyeong: 54.06,
      memberCount: 4, generalCount: 0, rentalCount: 0,
      generalPricePerPyeong: 5076.0,
      memberRatio: 45684 / 50760,
      rentalSalePricePerUnit: 0,
    },
  ],
  newCommercialRevenue: 33_870_000, // 상가 분양 PDF p.32

  // 지출 (PDF p.33-34) — 신탁방식 기준
  expenses: {
    constructionCostPerPyeong: 770, // 신탁방식 평당 770만원
    totalFloorAreaPyeong: Math.round(498_045.71 / 3.3058), // 150,654평
    undergroundAreaRatio: 203_621 / 498_045, // PDF 정확히 0.4088

    // 설계·감리·측량
    surveyFee: 1_540_000,
    designFee: 7_468_474,
    supervisionFee: 11_507_100,

    // 부담금
    trafficBurden: 2_846_680,
    schoolBurden: 0,
    waterBurden: 2_000_000,
    electricBurden: 3_000_000,

    // 제세공과금
    registrationFee: 7_959_596,
    bondPurchase: 303_126,

    // 보수료/금융비용
    trustFee: 37_137_055,
    projectLoanFee: 9_030_000,
    moveoutFinancing: 52_787_565,
    additionalMoveoutFinancing: 3_600_000,
    midpaymentFinancing: 12_340_283,
    hugGuaranteeFee: 2_965_366,

    // 기타
    salesGuaranteeFee: 3_593_354,
    advertisingFee: 1_330_000,
    managementFee: 4_260_000,
    meetingFee: 2_200_000,
    contingency: 10_000_000,
    compensationFee: 0,
    otherOutsourcingFee:
      6_270_000 + 6_580_653 + 2_310_000 + 2_200_000 + 1_650_000 + 3_193_000 + 1_375_000
      + 7_700_000, // 외주비 + 기타공사비
  },

  excessProfit: {
    enabled: false,
    baseHousePrice: 0,
    projectedHousePrice: 0,
    projectDurationYears: 11,
    normalRiseRate: 0.025,
  },
};

// ────────────────────────────────────────────────
// PDF 명시 결과치 (검증 대상)
// ────────────────────────────────────────────────

const EXPECTED = {
  totalRevenue: 3_163_482_300,
  totalExpense: 1_368_841_322,
  totalOriginalAsset: 1_649_611_400,
  ratio: 1.0879,
  rights: {
    'orig-15': 449_672,
    'orig-17a': 528_546,
    'orig-17b': 528_546,
    'orig-24': 792_003,
    'orig-28': 1_041_227,
    'orig-31': 1_187_643,
  },
  // PDF p.36-38 분담금 표 (15평형 → 신축평형별)
  burden_15: {
    'new-17': 186_327,
    'new-22': 373_327,
    'new-25': 490_327,
    'new-31': 679_327,
    'new-35': 894_327,
  },
  // 17평형 분담금
  burden_17a: {
    'new-17': 107_453,
    'new-22': 294_453,
    'new-25': 411_453,
    'new-31': 600_453,
    'new-35': 815_453,
  },
  // 24평형 (환급 케이스 포함)
  burden_24: {
    'new-17': -156_003,
    'new-22': 30_996,
    'new-25': 147_996,
    'new-31': 336_996,
    'new-35': 551_996,
  },
};

// ────────────────────────────────────────────────
// 검증 헬퍼
// ────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function assertClose(label: string, actual: number, expected: number, tolerancePct = 1.0): void {
  const diff = Math.abs(actual - expected);
  const denom = Math.abs(expected) || 1;
  const pct = (diff / denom) * 100;
  if (pct <= tolerancePct) {
    console.log(`  ✓ ${label}: ${actual.toLocaleString()} ≈ ${expected.toLocaleString()} (Δ ${pct.toFixed(2)}%)`);
    pass++;
  } else {
    console.log(`  ✗ ${label}: ${actual.toLocaleString()} vs ${expected.toLocaleString()} (Δ ${pct.toFixed(2)}% > ${tolerancePct}%)`);
    fail++;
  }
}

// ────────────────────────────────────────────────
// 실행
// ────────────────────────────────────────────────

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 회귀 테스트: 중계주공5단지 PDF 케이스');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const result = calculateProject(JG5_CASE);

console.log('\n[1] 총수입·총지출·종전자산 (천원)');
assertClose('총수입', result.totalRevenue, EXPECTED.totalRevenue, 2.0);
assertClose('총지출', result.totalExpense, EXPECTED.totalExpense, 2.0);
assertClose('종전자산', result.totalOriginalAsset, EXPECTED.totalOriginalAsset, 0.1);

console.log('\n[2] 비례율');
assertClose('비례율', result.ratio, EXPECTED.ratio, 2.0);

console.log('\n[3] 조합원 권리가액 (천원)');
for (const [origId, expected] of Object.entries(EXPECTED.rights)) {
  assertClose(origId, result.memberRightsMap[origId], expected, 2.0);
}

console.log('\n[4] 분담금 — 15평형 → 신축평형별 (천원)');
for (const [newId, expected] of Object.entries(EXPECTED.burden_15)) {
  assertClose(`15→${newId}`, result.burdenMap['orig-15']?.[newId] ?? 0, expected, 5.0);
}

console.log('\n[5] 분담금 — 17평형(소) → 신축평형별 (천원)');
for (const [newId, expected] of Object.entries(EXPECTED.burden_17a)) {
  assertClose(`17a→${newId}`, result.burdenMap['orig-17a']?.[newId] ?? 0, expected, 5.0);
}

console.log('\n[6] 분담금 — 24평형 → 신축평형별 (환급 케이스 포함)');
for (const [newId, expected] of Object.entries(EXPECTED.burden_24)) {
  assertClose(`24→${newId}`, result.burdenMap['orig-24']?.[newId] ?? 0, expected, 5.0);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` 결과: ${pass} pass / ${fail} fail`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (fail > 0) process.exit(1);
