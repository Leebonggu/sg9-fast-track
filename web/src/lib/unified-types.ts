// web/src/lib/unified-types.ts

export interface OwnerRow {
  dong: string      // "901" (동 숫자만, "동" 접미사 없음)
  ho: string        // "101"
  ownerName: string
  postalCode: string // 소유자1(우편번호)
  address: string    // 소유자1(주소)
  residency: string // "실거주" | "임대"
}

export interface UnifiedRow extends OwnerRow {
  consent: boolean
  surveys: Record<string, boolean>  // { 'survey-001': true }
  memo: string
  lastSynced: string
  idUploaded?: number  // 신분증 사본 업로드 장수 (파기 제외) — /api/unified에서 병합
  donationTotal?: number  // 후원금 누적 납부액 (취소 제외) — /api/unified에서 병합
  donationCount?: number  // 후원금 납부 횟수 (취소 제외) — /api/unified에서 병합
  opposition?: boolean  // 재건축 반대 의사 (통합현황 시트 재건축반대 컬럼)
  kakaoGroup?: boolean  // 단톡방 참여 여부 (통합현황 시트 단톡방참여 컬럼, 위원 수동 토글)
  planConsent?: boolean  // 정비계획입안 제안 동의서 수령 (오프라인, 통합현황 시트)
  privacyConsent?: boolean  // 재건축 과정 개인정보 수집·제공 동의 (오프라인 체크, 정비계획입안과 무관한 독립 항목)
  idReceived?: boolean  // 신분증 사본 오프라인 수동 수령 체크 (온라인은 idUploaded로 별도 인정)
  consentName?: string  // 동의서에 기재된 이름 (sync 시 기록)
  nameMismatch?: boolean  // 소유자명 vs 동의서이름 불일치 여부 (포맷 정규화 후 비교)
  phone?: string  // 세대 연락처 (동별 시트에서 sync 시 채움, 폼 제출 세대만 값 있음)
  phoneOverride?: string  // 위원이 통합현황에서 직접 수정한 연락처 (연락처_수정 컬럼, sync에도 보존·우선)
  ageGroup?: string  // 세대 연령대 (통합현황 시트 연령대 컬럼, survey-001 시드 + 위원 수정)
  // ↓ 서울시 전자동의 명부(전자동의원본 시트) 파생값 — 매 sync 재계산되므로 보존 대상이 아니다
  econsentSinto?: '완전' | '일부' | ''  // 신속통합 전자동의 세대 판정 (소유자 전원 제출=완전, 일부만=일부, 미제출=빈칸)
  econsentPlan?: '완전' | '일부' | ''  // 정비계획입안 전자동의 세대 판정 (판정 규칙은 econsentSinto와 동일)
  coOwnerCount?: number  // 공유 세대의 소유자수 (2~5). 단독 소유 세대는 undefined
  representative?: string  // 공유 세대 대표자 이름 (명부 대표자여부='대표'인 소유자). 미선임이면 ''
  planChoice?: string  // 정비계획입안 동의자가 고른 추진 방식 ('추진위원회 구성' | '직접조합설립')
  // 명부의 생년월일에서 파생한 연령대. 기존 ageGroup(연령대 컬럼)을 덮지 않고 별도로 두는 이유는,
  // 그 칸에 survey-001 시드값과 위원이 손으로 고친 값이 섞여 있어 둘을 구분할 방법이 없기 때문이다.
  // 덮어쓰면 위원 입력이 통째로 사라지므로, 표시할 때 `ageGroup || ageGroupRoster`로 합친다.
  ageGroupRoster?: string
  rosterName?: string  // 전자동의 명부에 기재된 소유자 이름들 (세대 단위, 쉼표 구분)
  // 원본 소유자명과 명부 이름이 실질 불일치 — 소유권 이전 의심. 동명이인 접미사(윤지영 vs 윤지영A)는 제외한 판정.
  // 원본을 자동으로 고치지 않는다. 목록만 뽑아 위원이 등기부로 확인하고 판단한다.
  rosterNameMismatch?: boolean
}

// 위원이 모달에서 수정하는 4필드 — 원본 시트에 직접 적용 + 변경로그 기록
export interface UnifiedRowOverrides {
  ownerName?: string
  postalCode?: string
  address?: string
  residency?: string
  phone?: string
}

export interface SyncDuplicate {
  dong: string
  ho: string
  count: number
}

export interface SyncResult {
  syncedAt: string
  totalRows: number
  updatedRows: number
  durationMs: number
  duplicates: SyncDuplicate[]
}

export interface SyncNotifier {
  notify(result: SyncResult): Promise<void>
}

export type FilterType = 'all' | 'incomplete' | 'no-consent' | 'opposition' | string
