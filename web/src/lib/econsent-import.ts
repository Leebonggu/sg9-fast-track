// web/src/lib/econsent-import.ts
// 전자동의 xlsx 업로드 오케스트레이션 — 미리보기와 확정.
//
// 확정이 건드리는 시트는 「전자동의원본」과 「전자동의변경로그」 둘뿐이다.
// 통합현황에 반영되려면 이후 syncMasterSheet()를 한 번 돌려야 한다(파생값이므로).
import { parseEconsentFiles } from './econsent-parser';
import { readRawOwners, writeRawOwners, diffOwners, logEconsentBatch } from './econsent-sheets';
import type { EconsentChange } from './econsent-sheets';
import type { EconsentParseResult } from './econsent-types';

export interface EconsentSummary {
  owners: number;
  households: number;
  commercial: number;   // 상가 — 통합현황 모집단이 아니라 스킵된 행 수
  unnamed: number;      // 소유자 미확인 호실 (세대로는 살아있음)
  sinto: { full: number; part: number };
  plan: { full: number; part: number };
  shared: number;       // 공유 세대
  sharedWithRep: number;
  planChoice: Record<string, number>; // 세대 기준
}

export interface EconsentPreview {
  summary: EconsentSummary;
  isFirstUpload: boolean;
  changes: EconsentChange[];
  warnings: string[];
}

function summarize(parsed: EconsentParseResult): EconsentSummary {
  const hh = [...parsed.households.values()];
  const n = (fn: (h: (typeof hh)[number]) => boolean) => hh.filter(fn).length;
  const planChoice: Record<string, number> = {};
  for (const h of hh) {
    if (h.planChoice) planChoice[h.planChoice] = (planChoice[h.planChoice] ?? 0) + 1;
  }
  return {
    owners: parsed.owners.length,
    households: parsed.households.size,
    commercial: parsed.skipped.commercial,
    unnamed: parsed.unnamedOwners,
    sinto: { full: n((h) => h.sinto === '완전'), part: n((h) => h.sinto === '일부') },
    plan: { full: n((h) => h.plan === '완전'), part: n((h) => h.plan === '일부') },
    shared: n((h) => h.ownerCount > 1),
    sharedWithRep: n((h) => h.ownerCount > 1 && h.representative !== ''),
    planChoice,
  };
}

// 로그 배치 요약 1행에 들어갈 한 줄 문자열
export function formatSummary(s: EconsentSummary): string {
  return (
    `세대 ${s.households} / 신통 완전 ${s.sinto.full}·일부 ${s.sinto.part} / ` +
    `입안 완전 ${s.plan.full}·일부 ${s.plan.part} / ` +
    `공유 ${s.shared}(대표선임 ${s.sharedWithRep}) / 상가스킵 ${s.commercial}`
  );
}

/** 업로드 전 미리보기 — 시트에 아무것도 쓰지 않는다. */
export async function previewEconsentUpload(
  sintoBuf: Buffer,
  planBuf: Buffer,
): Promise<EconsentPreview> {
  const parsed = parseEconsentFiles(sintoBuf, planBuf);
  const prev = await readRawOwners();
  return {
    summary: summarize(parsed),
    isFirstUpload: prev === null,
    // 첫 업로드는 비교 대상이 없다. 전부를 "변경"으로 보여주면 3천 줄이 쏟아진다.
    changes: prev === null ? [] : diffOwners(prev, parsed.owners),
    warnings: parsed.warnings,
  };
}

export interface EconsentCommitResult extends EconsentPreview {
  batchId: string;
  uploadedAt: string;
}

/**
 * 확정 — 「전자동의원본」을 덮고 전이 이력을 남긴다.
 *
 * 순서가 중요하다. diff를 먼저 뜬 뒤에 덮어야 직전 스냅샷이 살아있다.
 */
export async function commitEconsentUpload(
  sintoBuf: Buffer,
  planBuf: Buffer,
  uploader: string,
): Promise<EconsentCommitResult> {
  const parsed = parseEconsentFiles(sintoBuf, planBuf);
  const prev = await readRawOwners();
  const changes = prev === null ? [] : diffOwners(prev, parsed.owners);

  const uploadedAt = new Date().toISOString();
  const batchId = uploadedAt;
  const summary = summarize(parsed);

  await writeRawOwners(parsed.owners, uploadedAt);
  await logEconsentBatch(
    changes,
    batchId,
    uploader,
    prev === null ? `최초 업로드 — ${formatSummary(summary)}` : formatSummary(summary),
  );

  return {
    summary,
    isFirstUpload: prev === null,
    changes,
    warnings: parsed.warnings,
    batchId,
    uploadedAt,
  };
}
