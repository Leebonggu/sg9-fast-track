/**
 * 위원 공유용 동의 현황 요약 (읽기 전용 — 통합현황·신분증업로드 시트만 읽는다).
 *
 * 실행: npm run status-report
 *
 * /unified 현황판과 같은 판정 함수(unified-utils)를 그대로 써서 숫자가 화면과 어긋나지 않게 한다.
 * 출력은 집계뿐(개인정보 없음)이라 그대로 단톡방에 공유해도 된다.
 * 주의: 통합현황은 sync 시점의 스냅샷 — 최신이 필요하면 safe-sync 먼저.
 */
import { getMasterRows } from '../src/lib/owner-sheets';
import { getAllIdUploads } from '../src/lib/id-upload';
import {
  hasSintoConsent, hasPlanConsent, hasPrivacyConsent, hasIdVerified,
  hasIdSubmitted, isElectronicDone, isPartialConsent, needsRepresentative,
} from '../src/lib/unified-utils';
import type { UnifiedRow } from '../src/lib/unified-types';

const [{ rows }, uploads] = await Promise.all([getMasterRows(), getAllIdUploads()]);

// idUploaded는 /api/unified에서 병합되는 값이라 여기서 직접 병합 (파기 제외, /api와 동일 기준)
const uploadCount = new Map<string, number>();
for (const u of uploads) {
  if (u.status === '파기') continue;
  const k = `${u.dong}-${u.ho}`;
  uploadCount.set(k, (uploadCount.get(k) ?? 0) + 1);
}
for (const r of rows as UnifiedRow[]) {
  r.idUploaded = uploadCount.get(`${r.dong}-${r.ho}`) ?? 0;
}

const total = rows.length;
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
const cnt = (f: (r: UnifiedRow) => boolean) => rows.filter(f).length;

const breakdown = (paper: (r: UnifiedRow) => boolean, elec: (r: UnifiedRow) => string | undefined) => {
  let paperOnly = 0, elecOnly = 0, both = 0, partial = 0;
  for (const r of rows) {
    const p = paper(r), e = isElectronicDone(elec(r));
    if (p && e) both++;
    else if (p) paperOnly++;
    else if (e) elecOnly++;
    if (elec(r) === '일부') partial++;
  }
  return { paperOnly, elecOnly, both, partial, sum: paperOnly + elecOnly + both };
};
const sinto = breakdown((r) => r.consent, (r) => r.econsentSinto);
const plan = breakdown((r) => Boolean(r.planConsent), (r) => r.econsentPlan);

const idUp = cnt((r) => (r.idUploaded ?? 0) > 0);
const idPaper = cnt((r) => Boolean(r.idReceived));
const surveyKeys = Object.keys(rows.find((r) => Object.keys(r.surveys).length)?.surveys ?? {});
const synced = rows.map((r) => r.lastSynced).filter(Boolean).sort().at(-1) ?? '';

const L: string[] = [];
L.push(`📊 상계주공9단지 동의 현황 (${synced.slice(0, 16).replace('T', ' ')} 동기화 기준)`);
L.push(`전체 ${total.toLocaleString()}세대`);
L.push('');
L.push(`■ 사전동의(신속통합기획): ${sinto.sum.toLocaleString()}세대 (${pct(sinto.sum)})`);
L.push(`   종이만 ${sinto.paperOnly} · 전자만 ${sinto.elecOnly} · 둘 다 ${sinto.both} / 전자 일부서명 ${sinto.partial}세대`);
L.push(`■ 정비계획입안 동의: ${plan.sum.toLocaleString()}세대 (${pct(plan.sum)})`);
L.push(`   종이만 ${plan.paperOnly} · 전자만 ${plan.elecOnly} · 둘 다 ${plan.both} / 전자 일부서명 ${plan.partial}세대`);
L.push(`■ 개인정보 동의: ${cnt(hasPrivacyConsent).toLocaleString()}세대 (${pct(cnt(hasPrivacyConsent))})`);
L.push(`■ 신분증 인정: ${cnt(hasIdVerified).toLocaleString()}세대 (${pct(cnt(hasIdVerified))}) — 사본 확보 ${cnt(hasIdSubmitted)}세대(업로드 ${idUp}·종이 ${idPaper}), 나머지는 전자동의 인정`);
for (const k of surveyKeys) {
  const n = cnt((r) => Boolean(r.surveys[k]));
  L.push(`■ 설문 ${k}: ${n.toLocaleString()}세대 (${pct(n)})`);
}
L.push(`■ 단톡방 참여: ${cnt((r) => Boolean(r.kakaoGroup))}세대 / 재건축 반대: ${cnt((r) => Boolean(r.opposition))}세대`);
L.push(`■ 실거주 ${cnt((r) => r.residency === '실거주')} · 임대 ${cnt((r) => r.residency === '임대')}`);
L.push('');
L.push(`(참고·내부용) 독려 1순위 — 전자 일부서명 세대: ${cnt(isPartialConsent)} / 공유인데 대표 미선임: ${cnt(needsRepresentative)}`);

console.log(L.join('\n'));
