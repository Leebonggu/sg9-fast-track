'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import UnifiedSidebar from '@/components/unified/UnifiedSidebar';
import UnifiedSummary from '@/components/unified/UnifiedSummary';
import UnifiedFilters from '@/components/unified/UnifiedFilters';
import UnifiedTable from '@/components/unified/UnifiedTable';
import SyncButton from '@/components/unified/SyncButton';
import EditRowModal from '@/components/unified/EditRowModal';
import { applyFilter } from '@/lib/unified-utils';
import type { UnifiedRow, FilterType } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';

export default function UnifiedDongPage() {
  const params = useParams();
  const dong = String(params.dong);
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UnifiedRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/unified?dong=${dong}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setRows(data.rows ?? []);
        setSurveyIds(data.surveyIds ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [dong]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const patchKakaoGroup = useCallback((d: string, ho: string, value: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === d && r.ho === ho ? { ...r, kakaoGroup: value } : r,
      ),
    );
  }, []);

  const lastSynced = rows[0]?.lastSynced ?? null;
  const filtered = applyFilter(rows, filter, surveyIds);

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row h-full">
        <UnifiedSidebar selectedDong={dong} />
        <div className="flex-1 min-w-0 p-4 overflow-y-auto pb-20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">{dong}동 현황</h1>
            <SyncButton lastSynced={lastSynced} onSynced={fetchData} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : (
            <>
              <UnifiedSummary rows={rows} surveyIds={surveyIds} />
              <UnifiedFilters active={filter} rows={rows} surveyIds={surveyIds} onChange={setFilter} />
              <div className="text-xs text-gray-400 mb-2">
                {filtered.length.toLocaleString()}세대 표시 중 / 전체 {rows.length.toLocaleString()}세대
              </div>
              <UnifiedTable
                rows={filtered}
                surveyIds={surveyIds}
                showDong={false}
                onRowClick={setEditing}
                onKakaoToggled={patchKakaoGroup}
              />
            </>
          )}
        </div>
      </div>
      {editing && (
        <EditRowModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchData}
          onKakaoToggled={patchKakaoGroup}
        />
      )}
    </AdminLayout>
  );
}
