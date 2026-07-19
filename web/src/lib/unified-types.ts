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
