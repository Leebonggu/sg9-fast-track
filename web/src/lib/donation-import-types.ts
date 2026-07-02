import type { ParseSource } from './donation-parser';

export type ImportClassification = 'new' | 'duplicate' | 'review';

export interface ParsedImportRow {
  rowIdx: number;
  iso: string;       // 원본 송금시각 KST ISO, 예: "2026-07-02T13:48:51+09:00"
  dateOnly: string;  // "2026-07-02"
  amount: number;
  sender: string;
  memo: string;
  dong: string;
  ho: string;
  source: ParseSource;
}

export interface ClassifiedImportRow extends ParsedImportRow {
  classification: ImportClassification;
  existingDong?: string;
  existingHo?: string;
}
