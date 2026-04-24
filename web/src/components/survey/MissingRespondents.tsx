"use client";

import { useState, useEffect } from "react";

type MissingByDong = {
  dong: string;
  total: number;
  responded: number;
  missing: string[];
  respondedHos: string[];
};

interface MissingRespondentsProps {
  surveyId: string;
}

export default function MissingRespondents({ surveyId }: MissingRespondentsProps) {
  const [data, setData] = useState<MissingByDong[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDong, setExpandedDong] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'missing' | 'all'>('missing');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/survey/${surveyId}/missing`)
      .then((res) => {
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        return res.json();
      })
      .then((json: { missing: MissingByDong[] }) => {
        setData(json.missing);
      })
      .catch((err: Error) => {
        setError(err.message || "데이터를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [surveyId]);

  const totalMissing = data ? data.reduce((sum, d) => sum + d.missing.length, 0) : 0;
  const totalResponded = data ? data.reduce((sum, d) => sum + d.responded, 0) : 0;
  const totalUnits = data ? data.reduce((sum, d) => sum + d.total, 0) : 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-10 flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#2F5496] rounded-full animate-spin" />
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const overallPct = totalUnits > 0 ? Math.round((totalResponded / totalUnits) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 전체 요약 카드 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex gap-4 mb-3">
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-400">응답 완료</p>
            <p className="text-2xl font-bold text-[#2F5496]">{totalResponded.toLocaleString()}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-400">미응답</p>
            <p className="text-2xl font-bold text-red-500">{totalMissing.toLocaleString()}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-400">전체</p>
            <p className="text-2xl font-bold text-gray-600">{totalUnits.toLocaleString()}</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2F5496] rounded-full transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right mt-1">응답률 {overallPct}%</p>
      </div>

      {/* 보기 모드 토글 + 동 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 토글 */}
        <div className="flex border-b border-gray-100 p-2 gap-2">
          <button
            onClick={() => setViewMode('missing')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'missing'
                ? 'bg-red-50 text-red-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            미응답만
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-[#2F5496] text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            전체 보기
          </button>
        </div>

        {/* 동 목록 */}
        <ul>
          {data.map((item) => {
            const pct = item.total > 0 ? Math.round((item.responded / item.total) * 100) : 0;
            const isExpanded = expandedDong === item.dong;
            const missingCount = item.missing.length;

            return (
              <li key={item.dong} className="border-b border-gray-100 last:border-b-0">
                {/* 동 행 */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedDong(isExpanded ? null : item.dong)}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <span className="w-14 shrink-0 text-sm font-semibold text-gray-800">
                    {item.dong}
                  </span>

                  {/* 스택 프로그레스 바 (응답=파랑, 미응답=빨강) */}
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#2F5496] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    {missingCount > 0 && (
                      <div
                        className="h-full bg-red-300 transition-all"
                        style={{ width: `${100 - pct}%` }}
                      />
                    )}
                  </div>

                  {/* 배지 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 bg-blue-50 text-[#2F5496] rounded text-xs font-medium">
                      {item.responded}
                    </span>
                    <span className="text-gray-300 text-xs">/</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      missingCount === 0
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {missingCount === 0 ? '완료' : `미${missingCount}`}
                    </span>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                  </div>

                  <span className={`shrink-0 text-gray-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>

                {/* 아코디언: 호수 그리드 */}
                {isExpanded && (
                  <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
                    {viewMode === 'missing' ? (
                      /* 미응답만 */
                      <div className="pt-2">
                        {missingCount === 0 ? (
                          <p className="text-sm text-green-600 py-2 text-center">✓ 모두 응답 완료</p>
                        ) : (
                          <>
                            <p className="text-xs text-gray-400 mb-1.5">미응답 {missingCount}세대</p>
                            <div className="flex flex-wrap gap-1">
                              {item.missing.map((ho) => (
                                <span
                                  key={ho}
                                  className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs border border-red-100"
                                >
                                  {ho}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      /* 전체 보기: 응답+미응답 같이 */
                      <div className="pt-2">
                        <div className="flex gap-3 text-xs text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-[#2F5496] inline-block" />
                            응답 {item.responded}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block" />
                            미응답 {missingCount}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {/* 응답 완료 */}
                          {item.respondedHos.map((ho) => (
                            <span
                              key={ho}
                              className="px-2 py-0.5 bg-[#2F5496] text-white rounded text-xs"
                            >
                              {ho}
                            </span>
                          ))}
                          {/* 미응답 */}
                          {item.missing.map((ho) => (
                            <span
                              key={ho}
                              className="px-2 py-0.5 bg-red-50 text-red-500 rounded text-xs border border-red-200"
                            >
                              {ho}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
