// 서울시 전자동의 시스템에서 받은 「전자 동의서 대상자 관리 내역」 xlsx 2종
// (신속통합 / 정비계획입안)의 공유 타입.
//
// 원본 행 단위는 세대가 아니라 **소유자**다. 공유 세대는 소유자마다 1행이라
// 통합현황(세대 단위)에 붙이려면 반드시 세대로 접어야 한다. 그래서 파서는
// 소유자 행(raw 시트에 그대로 적재)과 세대 집계를 둘 다 돌려준다.

// 원본 `제출상태` 값 (2026-08-10 실측: 이 4가지가 전부, 2026-08-27 '미제출(대표자제출)' 추가 확인)
// '미제출(대표자제출)' — 공유 세대에서 대표자에게 위임한 소유자의 몫. 대표자가 전자동의를
// 이미 제출했어도 완비여부는 '미비'로 남아(2026-08-27 실측), 위임만으로는 개인 제출을
// 대신하지 못한다. 그래서 '미제출'과 동일하게 미제출로 취급한다(아래 isSubmitted).
export type SubmitStatus = '미제출' | '미제출(대표자제출)' | '전자동의' | '서면동의(직접)' | '';

// 원본 `대표자여부` — 공유 세대만 값이 있고 단독 세대는 빈 문자열
export type RepStatus = '' | '대표' | '위임' | '미선임';

// 정비계획입안 파일에만 있는 `선택 항목` (동의자가 고른 추진 방식).
// 원본의 '-'(선택 안 함)는 빈 문자열로 정규화한다.
export type PlanChoice = '' | '추진위원회 구성' | '직접조합설립';

// 세대 단위 동의 판정. 빈 문자열 = 미제출(제출한 소유자 0명).
// '일부'는 공유 세대에서 일부 소유자만 서명한 상태로, 대표를 세우거나
// 나머지를 독려하면 완결되는 세대라 별도로 구분한다.
export type HouseholdConsent = '완전' | '일부' | '';

// 소유자 1명 = 1행. 「전자동의원본」 시트에 그대로 적재된다.
export interface EconsentOwnerRow {
  dong: string;
  ho: string;
  seq: string;
  name: string;
  birth: string;
  phone: string;
  ownership: string;
  repStatus: RepStatus;
  sintoStatus: SubmitStatus;
  sintoSubmittedAt: string;
  planStatus: SubmitStatus;
  planSubmittedAt: string;
  planChoice: PlanChoice;
}

// 세대 단위 집계 — 통합현황 신규 컬럼의 원천
export interface EconsentHousehold {
  dong: string;
  ho: string;
  ownerCount: number;
  ownerNames: string[];
  sinto: HouseholdConsent;
  plan: HouseholdConsent;
  representative: string; // 대표자 이름, 미선임이면 ''
  planChoice: PlanChoice;
  firstSubmittedAt: string; // 신통·입안 통틀어 가장 이른 제출일시, 없으면 ''
  ageGroup: string; // 생년월일 파생 구간값 (세대 내 최연장자 기준)
  phone: string;
}

export interface EconsentParseResult {
  owners: EconsentOwnerRow[];
  households: Map<string, EconsentHousehold>; // key = `${dong}-${ho}`
  // 종합상가(지번 670-2) 45행 — 소유자원본에 없어 통합현황 2,830 스키마에 못 들어간다.
  skipped: { commercial: number };
  // 이름이 빈 행(소유자 미확인 호실) 수. 스킵하지 않고 미제출 소유자로 포함시킨다:
  // (1) 세대 키가 통합현황 2,830과 1:1로 맞아야 하고,
  // (2) 무명 행이 공유 세대에 섞이면 ownerCount가 줄어 '일부'가 '완전'으로 둔갑한다.
  unnamedOwners: number;
  warnings: string[];
}
