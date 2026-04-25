'use client';

import { useState, useEffect } from 'react';

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

function sortHoNum(ho: string) {
  return parseInt(ho.replace(/[^0-9]/g, ''), 10) || 0;
}

export default function MissingRespondents({ surveyId }: MissingRespondentsProps) {
  const [data, setData] = useState<MissingByDong[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'by-dong' | 'unified'>('by-dong');
  const [dotMode, setDotMode] = useState<'missing' | 'all'>('missing');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/survey/${surveyId}/missing`)
      .then((res) => {
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        return res.json();
      })
      .then((json: { missing: MissingByDong[] }) => {
        const sorted = [...json.missing].sort(
          (a, b) =>
            parseInt(a.dong.replace(/[^0-9]/g, ''), 10) -
            parseInt(b.dong.replace(/[^0-9]/g, ''), 10),
        );
        setData(sorted);
      })
      .catch((err: Error) => {
        setError(err.message || '데이터를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [surveyId]);

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

  const totalMissing = data.reduce((sum, d) => sum + d.missing.length, 0);
  const totalResponded = data.reduce((sum, d) => sum + d.responded, 0);
  const totalUnits = data.reduce((sum, d) => sum + d.total, 0);
  const overallPct = totalUnits > 0 ? Math.round((totalResponded / totalUnits) * 100) : 0;

  const allMissing = data.flatMap((d) =>
    d.missing.map((ho) => ({ dong: d.dong, ho }))
  );

  return (
    <div className="space-y-3">
      {/* 전체 요약 */}
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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 메인 뷰 토글 */}
        <div className="flex border-b border-gray-100 p-2 gap-2">
          <button
            onClick={() => setMainView('by-dong')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mainView === 'by-dong' ? 'bg-[#2F5496] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            동별 현황
          </button>
          <button
            onClick={() => setMainView('unified')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mainView === 'unified' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            미응답 목록 {totalMissing > 0 && <span className="ml-1 opacity-80">{totalMissing}</span>}
          </button>
        </div>

        {/* 동별 현황 */}
        {mainView === 'by-dong' && (
          <>
            <div className="flex border-b border-gray-100 px-3 py-2 gap-2">
              <button
                onClick={() => setDotMode('missing')}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                  dotMode === 'missing' ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                미응답만
              </button>
              <button
                onClick={() => setDotMode('all')}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                  dotMode === 'all' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                전체 보기
              </button>
            </div>

            <ul>
              {data.map((item) => {
                const pct = item.total > 0 ? Math.round((item.responded / item.total) * 100) : 0;
                const missingCount = item.missing.length;

                const sortedMissing = [...item.missing].sort((a, b) => sortHoNum(a) - sortHoNum(b));
                const allHos = [
                  ...item.respondedHos.map((ho) => ({ ho, responded: true })),
                  ...item.missing.map((ho) => ({ ho, responded: false })),
                ].sort((a, b) => sortHoNum(a.ho) - sortHoNum(b.ho));

                return (
                  <li key={item.dong} className="border-b border-gray-100 last:border-b-0 px-3 py-3">
                    {/* 동 헤더 */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-14 shrink-0 text-sm font-semibold text-gray-800">
                        {item.dong}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-[#2F5496] rounded text-xs font-medium">
                          {item.responded}
                        </span>
                        <span className="text-gray-300 text-xs">/</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            missingCount === 0
                              ? 'bg-gray-100 text-gray-400'
                              : 'bg-red-50 text-red-500'
                          }`}
                        >
                          {missingCount === 0 ? '완료' : `미${missingCount}`}
                        </span>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>

                    {/* 인라인 호수 셀 */}
                    {dotMode === 'missing' ? (
                      missingCount === 0 ? (
                        <p className="text-xs text-green-600">✓ 모두 응답 완료</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {sortedMissing.map((ho) => (
                            <span
                              key={ho}
                              className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs border border-red-100"
                            >
                              {ho}
                            </span>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {allHos.map(({ ho, responded: r }) => (
                          <span
                            key={ho}
                            className={`px-1.5 py-0.5 rounded text-xs ${
                              r
                                ? 'bg-[#2F5496] text-white'
                                : 'bg-red-50 text-red-500 border border-red-200'
                            }`}
                          >
                            {ho}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* 미응답 목록 (통합) */}
        {mainView === 'unified' && (
          <div className="p-3">
            {allMissing.length === 0 ? (
              <p className="text-sm text-green-600 text-center py-8">모든 세대가 응답했습니다 ✓</p>
            ) : (
              <div className="space-y-4">
                {data
                  .filter((d) => d.missing.length > 0)
                  .map((d) => (
                    <div key={d.dong}>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">
                        {d.dong}{' '}
                        <span className="text-red-400 font-normal">{d.total}세대 중 {d.missing.length}세대 미응답</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {[...d.missing]
                          .sort((a, b) => sortHoNum(a) - sortHoNum(b))
                          .map((ho) => (
                            <span
                              key={ho}
                              className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs border border-red-100"
                            >
                              {ho}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
