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
import { applyFilter, searchRows, downloadAsXlsx, downloadByDongAsXlsx } from '@/lib/unified-utils';
import type { UnifiedRow, FilterType } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';

export default function UnifiedPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');
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

  const patchAge = useCallback((dong: string, ho: string, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === dong && r.ho === ho ? { ...r, ageGroup: value } : r,
      ),
    );
  }, []);

  const patchConsent = useCallback((dong: string, ho: string, value: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === dong && r.ho === ho ? { ...r, consent: value } : r,
      ),
    );
  }, []);

  const patchPlan = useCallback((dong: string, ho: string, field: 'consent' | 'privacy' | 'id', value: boolean) => {
    setRows((prev) => prev.map((r) => {
      if (r.dong === dong && r.ho === ho) {
        if (field === 'consent') return { ...r, planConsent: value };
        if (field === 'privacy') return { ...r, privacyConsent: value };
        return { ...r, idReceived: value };
      }
      return r;
    }));
  }, []);

  const patchSurvey = useCallback((dong: string, ho: string, displayId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === dong && r.ho === ho ? { ...r, surveys: { ...r.surveys, [displayId]: true } } : r,
      ),
    );
  }, []);

  const patchPhone = useCallback((dong: string, ho: string, phone: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.dong === dong && r.ho === ho ? { ...r, phone } : r,
      ),
    );
  }, []);

  const lastSynced = rows[0]?.lastSynced ?? null;
  const filtered = searchRows(applyFilter(rows, filter, surveyIds), query);

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
              {/* 가상 스크롤이라 브라우저 Ctrl+F가 렌더된 30여 행만 훑는다. 이 검색은 2,830세대
                  전부를 데이터로 뒤지고, 화면에 없는 필드(명부이름·대표자·주소)까지 걸린다. */}
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="동·호수·이름·연락처·메모 검색 (예: 901 김, 010-1234)"
                  className="w-full pl-9 pr-20 py-2 text-sm rounded-lg border border-gray-300 focus:border-[#2F5496] focus:outline-none focus:ring-1 focus:ring-[#2F5496]"
                />
                {query && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">{filtered.length.toLocaleString()}건</span>
                    <button
                      onClick={() => setQuery('')}
                      className="text-gray-400 hover:text-gray-600 text-sm px-1"
                      aria-label="검색어 지우기"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
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
                </div>
              </div>
              {/* resetKey에 query를 넣는 이유: 검색어가 바뀌면 목록 자체가 달라지므로
                  필터 변경과 똑같이 스크롤을 맨 위로 되돌려야 한다. */}
              <UnifiedTable
                rows={filtered}
                resetKey={`${filter} ${query}`}
                surveyIds={surveyIds}
                showDong={true}
                onRowClick={setEditing}
                onKakaoToggled={patchKakaoGroup}
                onAgeChanged={patchAge}
                onPlanToggled={patchPlan}
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
          onAgeChanged={patchAge}
          onPlanToggled={patchPlan}
          onConsentToggled={patchConsent}
          onSurveyCompleted={patchSurvey}
          onPhoneChanged={patchPhone}
        />
      )}
    </AdminLayout>
  );
}
