'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import UnifiedSidebar from '@/components/unified/UnifiedSidebar';
import UnifiedSummary from '@/components/unified/UnifiedSummary';
import UnifiedFilters from '@/components/unified/UnifiedFilters';
import UnifiedTable from '@/components/unified/UnifiedTable';
import SyncButton from '@/components/unified/SyncButton';
import { applyFilter, downloadAsCsv } from '@/lib/unified-utils';
import type { UnifiedRow, FilterType } from '@/lib/unified-types';

export default function UnifiedPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/unified');
    const data = await res.json();
    setRows(data.rows);
    setSurveyIds(data.surveyIds);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lastSynced = rows[0]?.lastSynced ?? null;
  const filtered = applyFilter(rows, filter, surveyIds);

  return (
    <AdminLayout>
      <div className="flex h-full">
        <UnifiedSidebar selectedDong={null} />
        <div className="flex-1 min-w-0 p-4 overflow-y-auto pb-20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">통합 현황</h1>
            <SyncButton lastSynced={lastSynced} onSynced={fetchData} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : (
            <>
              <UnifiedSummary rows={rows} surveyIds={surveyIds} />
              <UnifiedFilters active={filter} rows={rows} surveyIds={surveyIds} onChange={setFilter} />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {filtered.length.toLocaleString()}세대 표시 중 / 전체 {rows.length.toLocaleString()}세대
                </span>
                <button
                  onClick={() => {
                    const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace('.', '');
                    downloadAsCsv(filtered, surveyIds, `통합현황_${filter}_${date}.csv`);
                  }}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  엑셀 다운로드 ({filtered.length.toLocaleString()})
                </button>
              </div>
              <UnifiedTable rows={filtered} surveyIds={surveyIds} showDong={true} />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
