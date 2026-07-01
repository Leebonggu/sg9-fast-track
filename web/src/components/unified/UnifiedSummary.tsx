import type { UnifiedRow } from '@/lib/unified-types';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
}

export default function UnifiedSummary({ rows, surveyIds }: Props) {
  const total = rows.length;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

  const consentCount = rows.filter((r) => r.consent).length;
  // 신분증: 사전동의 완료 세대 중 1장 이상 제출한 세대 수
  const idDoneCount = rows.filter((r) => r.consent && (r.idUploaded ?? 0) > 0).length;
  // 후원금: 납부 세대 수 및 전체 누적 총액
  const donationDoneCount = rows.filter((r) => (r.donationTotal ?? 0) > 0).length;
  const donationTotalSum = rows.reduce((sum, r) => sum + (r.donationTotal ?? 0), 0);
  const consentPct = (n: number) =>
    consentCount > 0 ? Math.round((n / consentCount) * 1000) / 10 : 0;
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
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="text-xs text-gray-400">신속통합동의서_제출</div>
        <div className="text-lg font-bold text-amber-500">
          {consentCount.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">{pct(consentCount)}%</span>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="text-xs text-gray-400">후원금</div>
        <div className="text-lg font-bold text-emerald-600">
          {donationTotalSum.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">원 · {donationDoneCount.toLocaleString()}세대</span>
        </div>
      </div>
      {surveyCounts.map(({ id, count }) => (
        <div key={id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400">{id}</div>
          <div className="text-lg font-bold text-blue-500">
            {count.toLocaleString()}
            <span className="text-xs text-gray-400 ml-1">{pct(count)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
