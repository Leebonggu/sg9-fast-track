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
  opposition?: boolean  // 재건축 반대 의사 (통합현황 시트 재건축반대 컬럼)
  consentName?: string  // 동의서에 기재된 이름 (sync 시 기록)
  nameMismatch?: boolean  // 소유자명 vs 동의서이름 불일치 여부 (포맷 정규화 후 비교)
}

// 위원이 모달에서 수정하는 4필드 — 원본 시트에 직접 적용 + 변경로그 기록
export interface UnifiedRowOverrides {
  ownerName?: string
  postalCode?: string
  address?: string
  residency?: string
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
