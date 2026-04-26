// web/src/lib/unified-types.ts

export interface OwnerRow {
  dong: string      // "901" (동 숫자만, "동" 접미사 없음)
  ho: string        // "101"
  ownerName: string
  residency: string // "실거주" | "임대"
}

export interface UnifiedRow extends OwnerRow {
  consent: boolean
  surveys: Record<string, boolean>  // { 'survey-001': true }
  memo: string
  lastSynced: string
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
