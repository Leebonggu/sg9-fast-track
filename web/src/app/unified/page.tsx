'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import UnifiedSidebar from '@/components/unified/UnifiedSidebar';
import UnifiedSummary from '@/components/unified/UnifiedSummary';
import UnifiedFilters from '@/components/unified/UnifiedFilters';
import UnifiedTable from '@/components/unified/UnifiedTable';
import SyncButton from '@/components/unified/SyncButton';
import EditRowModal from '@/components/unified/EditRowModal';
import { applyFilter, downloadAsXlsx, downloadByDongAsXlsx, downloadOwnerRegistryByDongAsXlsx } from '@/lib/unified-utils';
import type { UnifiedRow, FilterType } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';

export default function UnifiedPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UnifiedRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/unified');
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setRows(data.rows ?? []);
        setSurveyIds(data.surveyIds ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 후원금 추가/수정/취소는 세대 하나의 값만 바뀌므로 전체 재조회 없이 로컬 상태만 patch
  const patchDonation = useCallback((dong: string, ho: string, total: number, count: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === dong && r.ho === ho ? { ...r, donationTotal: total, donationCount: count } : r,
      ),
    );
  }, []);

  const patchKakaoGroup = useCallback((dong: string, ho: string, value: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === dong && r.ho === ho ? { ...r, kakaoGroup: value } : r,
      ),
    );
  }, []);

  const lastSynced = rows[0]?.lastSynced ?? null;
  const filtered = applyFilter(rows, filter, surveyIds);
  // 소유주 명부(업체용) 버튼 라벨 — 공동명의를 풀었을 때의 소유주 총 인원수
  const ownerCount = filtered.reduce(
    (n, r) => n + Math.max(1, r.ownerName.split(',').filter((s) => s.trim()).length),
    0,
  );

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row h-full">
        <UnifiedSidebar selectedDong={null} />
        <div className="flex-1 min-w-0 p-4 overflow-y-auto pb-20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">통합 현황</h1>
            <div className="flex items-center gap-2">
              <Link
                href="/unified/donations"
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                후원금 목록
              </Link>
              <Link
                href="/unified/donations-import"
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                후원금 일괄업로드
              </Link>
              <SyncButton lastSynced={lastSynced} onSynced={fetchData} />
            </div>
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : (
            <>
              <UnifiedSummary rows={rows} surveyIds={surveyIds} />
              <UnifiedFilters active={filter} rows={rows} surveyIds={surveyIds} onChange={setFilter} />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                <span className="text-xs text-gray-400">
                  {filtered.length.toLocaleString()}세대 표시 중 / 전체 {rows.length.toLocaleString()}세대
                </span>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      window.open(
                        `/unified/print?filter=${encodeURIComponent(filter)}`,
                        '_blank',
                      );
                    }}
                    className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded bg-[#2F5496] text-white font-semibold hover:bg-[#1e3a6e] transition-colors"
                  >
                    명단 인쇄 ({filtered.length.toLocaleString()})
                  </button>
                  <button
                    onClick={() => {
                      window.open(
                        `/unified/labels?filter=${encodeURIComponent(filter)}`,
                        '_blank',
                      );
                    }}
                    className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    라벨 인쇄 ({filtered.length.toLocaleString()})
                  </button>
                  <button
                    onClick={() => {
                      const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace('.', '');
                      downloadAsXlsx(filtered, surveyIds, `통합현황_${filter}_${date}.xlsx`);
                    }}
                    className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    엑셀 다운로드 ({filtered.length.toLocaleString()})
                  </button>
                  <button
                    onClick={() => {
                      const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace('.', '');
                      downloadByDongAsXlsx(filtered, surveyIds, `통합현황_동별_${filter}_${date}.xlsx`);
                    }}
                    className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    동별 분리 ({filtered.length.toLocaleString()})
                  </button>
                  <button
                    onClick={() => {
                      const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace('.', '');
                      downloadOwnerRegistryByDongAsXlsx(filtered, `소유주명부_업체용_${filter}_${date}.xlsx`);
                    }}
                    className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
                    title="공동명의를 소유주별 1행으로 풀고 전화번호를 매칭한 동별 명부 (업체 전달용)"
                  >
                    소유주 명부({ownerCount.toLocaleString()}인)
                  </button>
                </div>
              </div>
              <UnifiedTable
                rows={filtered}
                surveyIds={surveyIds}
                showDong={true}
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
          onDonationChanged={patchDonation}
          onKakaoToggled={patchKakaoGroup}
        />
      )}
    </AdminLayout>
  );
}
