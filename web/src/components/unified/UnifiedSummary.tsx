import type { UnifiedRow } from '@/lib/unified-types';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
}

export default function UnifiedSummary({ rows, surveyIds }: Props) {
  const total = rows.length;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

  const consentCount = rows.filter((r) => r.consent).length;
  const surveyCounts = surveyIds.map((id) => ({
    id,
    count: rows.filter((r) => r.surveys[id]).length,
  }));

  return (
    <div className="flex gap-3 flex-wrap mb-4">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
        <div className="text-xs text-gray-400">전체</div>
        <div className="text-lg font-bold text-gray-800">{total.toLocaleString()}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
        <div className="text-xs text-gray-400">사전동의</div>
        <div className="text-lg font-bold text-amber-500">
          {consentCount.toLocaleString()}
          <span className="text-xs text-gray-400 ml-1">{pct(consentCount)}%</span>
        </div>
      </div>
      {surveyCounts.map(({ id, count }) => (
        <div key={id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[90px]">
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
