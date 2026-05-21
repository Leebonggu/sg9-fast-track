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
}

// 위원이 모달에서 수정하는 4필드 — 원본 시트에 직접 적용 + 변경로그 기록
export interface UnifiedRowOverrides {
  ownerName?: string
  postalCode?: string
  address?: string
  residency?: string
}

export interface SyncResult {
  syncedAt: string
  totalRows: number
  updatedRows: number
  durationMs: number
}

export interface SyncNotifier {
  notify(result: SyncResult): Promise<void>
}

export type FilterType = 'all' | 'incomplete' | 'no-consent' | string
