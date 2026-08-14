import type { UnifiedRow } from '@/lib/unified-types';
import {
  hasIdSubmitted, hasSintoConsent, hasPlanConsent, hasIdVerified, hasPrivacyConsent,
  isPartialConsent, needsRepresentative,
} from '@/lib/unified-utils';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
}

// "제출수 / 모수 · %" 공통 카드. 모수는 항목마다 다르다(대부분 전체 세대, 신분증만 동의세대).
function RatioCard({
  label, count, of, color,
}: {
  label: string; count: number; of: number; color: string;
}) {
  const pct = of > 0 ? Math.round((count / of) * 1000) / 10 : 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-bold ${color}`}>
        {count.toLocaleString()}
        <span className="text-gray-300 font-normal"> / </span>
        <span className="text-gray-500">{of.toLocaleString()}</span>
        <span className="text-xs text-gray-400 ml-1">{pct}%</span>
      </div>
    </div>
  );
}

// 종이·전자 합산 카드. 큰 숫자는 합집합이고, 아래에 경로별 내역과 중복을 적는다.
// 위원회가 보는 수치는 "몇 세대 동의했나"지만, 수거 독려 대상을 고르려면 출처가 필요하다.
function MergedCard({
  label, paper, electronic, both, of, color,
}: {
  label: string; paper: number; electronic: number; both: number; of: number; color: string;
}) {
  const union = paper + electronic - both;
  const pct = of > 0 ? Math.round((union / of) * 1000) / 10 : 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-bold ${color}`}>
        {union.toLocaleString()}
        <span className="text-gray-300 font-normal"> / </span>
        <span className="text-gray-500">{of.toLocaleString()}</span>
        <span className="text-xs text-gray-400 ml-1">{pct}%</span>
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">
        종이 {paper.toLocaleString()} · 전자 {electronic.toLocaleString()}
        {both > 0 && <span className="text-gray-400"> (중복 {both.toLocaleString()})</span>}
      </div>
    </div>
  );
}

export default function UnifiedSummary({ rows, surveyIds }: Props) {
  const total = rows.length;

  const consentCount = rows.filter((r) => r.consent).length;
  // 정비계획입안 2종 — 전 세대 대상 오프라인 수령 체크 (모수 = 전체 세대)
  const planConsentCount = rows.filter((r) => r.planConsent).length;
  const privacyCount = rows.filter((r) => r.privacyConsent).length;

  // 전자동의는 '완전'만 동의로 센다. '일부'(공유자 부분 서명)는 따로 표시한다.
  const eSinto = rows.filter((r) => r.econsentSinto === '완전').length;
  const ePlan = rows.filter((r) => r.econsentPlan === '완전').length;
  const bothSinto = rows.filter((r) => r.consent && r.econsentSinto === '완전').length;
  const bothPlan = rows.filter((r) => r.planConsent && r.econsentPlan === '완전').length;

  const sintoAny = rows.filter(hasSintoConsent).length;
  const planAny = rows.filter(hasPlanConsent).length;
  const privacyAny = rows.filter(hasPrivacyConsent).length;
  const idAny = rows.filter((r) => hasSintoConsent(r) && hasIdVerified(r)).length;
  const ePrivacy = privacyAny - privacyCount;

  const partialCount = rows.filter(isPartialConsent).length;
  const noRepCount = rows.filter(needsRepresentative).length;
  const promotion = rows.filter((r) => r.planChoice === '추진위원회 구성').length;
  const direct = rows.filter((r) => r.planChoice === '직접조합설립').length;
  // 후원금: 납부 세대 수 및 전체 누적 총액
  const donationDoneCount = rows.filter((r) => (r.donationTotal ?? 0) > 0).length;
  const donationTotalSum = rows.reduce((sum, r) => sum + (r.donationTotal ?? 0), 0);
  const surveyCounts = surveyIds.map((id) => ({
    id,
    count: rows.filter((r) => r.surveys[id]).length,
  }));

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 mb-4">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="text-xs text-gray-400">전체</div>
        <div className="text-lg font-bold text-gray-800">{total.toLocaleString()}</div>
      </div>
      <MergedCard
        label="신속통합 동의" paper={consentCount} electronic={eSinto} both={bothSinto}
        of={total} color="text-amber-500"
      />
      <MergedCard
        label="정비입안 동의" paper={planConsentCount} electronic={ePlan} both={bothPlan}
        of={total} color="text-indigo-500"
      />
      <MergedCard
        label="개인정보 동의" paper={privacyCount} electronic={ePrivacy} both={0}
        of={total} color="text-indigo-500"
      />
      {(partialCount > 0 || noRepCount > 0) && (
        <div className="bg-white border border-orange-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400">독려 대상</div>
          <div className="text-lg font-bold text-orange-600">
            {partialCount.toLocaleString()}
            <span className="text-xs text-gray-400 ml-1">일부만 서명</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">대표 미선임 {noRepCount.toLocaleString()}</div>
        </div>
      )}
      {(promotion > 0 || direct > 0) && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400">추진방식 선택</div>
          <div className="text-lg font-bold text-gray-800">
            {promotion.toLocaleString()}
            <span className="text-xs text-gray-400 ml-1">추진위 구성</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">직접조합설립 {direct.toLocaleString()}</div>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="text-xs text-gray-400">후원금</div>
        <div className="text-lg font-bold text-emerald-600">
          {donationTotalSum.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">원 · {donationDoneCount.toLocaleString()}세대</span>
        </div>
      </div>
      {surveyCounts.map(({ id, count }) => (
        <RatioCard key={id} label={id} count={count} of={total} color="text-blue-500" />
      ))}
      {/* 모수는 종이·전자 합산 동의세대. 전자동의자는 본인인증 기반이라 신분증 인정으로 본다. */}
      <RatioCard
        label="신분증 인정 / 동의세대"
        count={idAny}
        of={sintoAny}
        color="text-emerald-600"
      />
    </div>
  );
}
