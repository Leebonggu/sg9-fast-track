import type { UnifiedRow } from '@/lib/unified-types';
import { hasIdSubmitted } from '@/lib/unified-utils';

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

export default function UnifiedSummary({ rows, surveyIds }: Props) {
  const total = rows.length;

  const consentCount = rows.filter((r) => r.consent).length;
  // 정비계획입안 2종 — 전 세대 대상 오프라인 수령 체크 (모수 = 전체 세대)
  const planConsentCount = rows.filter((r) => r.planConsent).length;
  const privacyCount = rows.filter((r) => r.privacyConsent).length;
  // 신분증: 사전동의 완료 세대 중 제출한 세대 수 (온라인 업로드 + 종이 수령 — 필터와 동일 기준)
  const idDoneCount = rows.filter((r) => r.consent && hasIdSubmitted(r)).length;
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
      <RatioCard label="신속통합동의서_제출" count={consentCount} of={total} color="text-amber-500" />
      <RatioCard label="정비입안 동의서" count={planConsentCount} of={total} color="text-indigo-500" />
      <RatioCard label="개인정보 동의" count={privacyCount} of={total} color="text-indigo-500" />
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
      <RatioCard
        label="신분증 제출 / 동의세대"
        count={idDoneCount}
        of={consentCount}
        color="text-emerald-600"
      />
    </div>
  );
}
