'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useBuildingSelector } from '@/hooks/useBuildingSelector';
import { BuildingSelector } from '@/components/survey/BuildingSelector';
import type { VerifyLogRow } from '@/lib/kakao-verify-log';

function formatTs(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function todayCounts(logs: VerifyLogRow[]) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const today = logs.filter((l) => l.timestamp.slice(0, 10) === todayStr);
  return {
    success: today.filter((l) => l.result === '성공').length,
    fail: today.filter((l) => l.result === '실패').length,
    admin: today.filter((l) => l.result === '어드민발급').length,
  };
}

function resultBadge(result: string) {
  if (result === '성공') return <span className="text-green-600 font-medium">성공</span>;
  if (result === '실패') return <span className="text-red-500 font-medium">실패</span>;
  if (result === '어드민발급') return <span className="text-blue-500 font-medium">어드민발급</span>;
  return <span className="text-gray-400">{result}</span>;
}

function rowBg(result: string) {
  if (result === '성공') return 'bg-green-50/40 border-b border-gray-50';
  if (result === '실패') return 'bg-red-50/40 border-b border-gray-50';
  if (result === '어드민발급') return 'bg-blue-50/40 border-b border-gray-50';
  return 'border-b border-gray-50';
}

export default function KakaoVerifyLogsPage() {
  const [logs, setLogs] = useState<VerifyLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [basicInfo, setBasicInfo] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    selectedDong, selectedFloor, dongList, floorList, hoList,
    handleDongChange, handleFloorChange, handleHoChange, reset,
  } = useBuildingSelector(setBasicInfo);

  function fetchLogs() {
    setLoading(true);
    fetch('/api/kakao-verify-logs')
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setLogs(d.logs ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchLogs(); }, []);

  async function handleGenerate() {
    if (!basicInfo.dong || !basicInfo.ho) return;
    setGenerating(true);
    setGeneratedUrl('');
    setCopied(false);
    try {
      const res = await fetch('/api/admin/kakao-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: basicInfo.dong, ho: basicInfo.ho }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedUrl(`${window.location.origin}/kakao-verify/result?t=${encodeURIComponent(data.token)}`);
      reset();
      setBasicInfo({});
      fetchLogs();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const counts = todayCounts(logs);

  return (
    <AdminLayout>
      <div className="p-4 max-w-5xl mx-auto pb-16 space-y-5">
        <h1 className="text-xl font-bold text-[#2F5496] pt-2">카카오톡 인증 관리</h1>

        {/* 링크 생성 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">세대별 링크 직접 생성 (30분 유효)</h2>
          <BuildingSelector
            selectedDong={selectedDong} selectedFloor={selectedFloor} selectedHo={basicInfo.ho || ''}
            dongList={dongList} floorList={floorList} hoList={hoList}
            onDongChange={handleDongChange} onFloorChange={handleFloorChange} onHoChange={handleHoChange}
          />
          <button
            onClick={handleGenerate}
            disabled={!basicInfo.dong || !basicInfo.ho || generating}
            className="mt-3 w-full py-3 bg-[#2F5496] text-white rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {generating ? '생성 중...' : '링크 생성'}
          </button>
          {generatedUrl && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">생성된 링크</p>
              <p className="text-xs text-gray-700 break-all mb-2">{generatedUrl}</p>
              <button
                onClick={handleCopy}
                className="w-full py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
              >
                {copied ? '✓ 복사됨' : '링크 복사'}
              </button>
            </div>
          )}
        </div>

        {/* 오늘 요약 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">오늘 성공</p>
            <p className="text-3xl font-bold text-green-600">{counts.success}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">오늘 실패</p>
            <p className="text-3xl font-bold text-red-500">{counts.fail}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">어드민발급</p>
            <p className="text-3xl font-bold text-blue-500">{counts.admin}</p>
          </div>
        </div>

        {/* 로그 테이블 */}
        {loading && <p className="text-gray-400 text-center py-10">로딩 중...</p>}
        {error && <p className="text-red-500 text-center py-4">{error}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="py-3 px-3 text-left">시각</th>
                  <th className="py-3 px-3 text-left">동</th>
                  <th className="py-3 px-3 text-left">호수</th>
                  <th className="py-3 px-3 text-left">이름</th>
                  <th className="py-3 px-3 text-left">결과</th>
                  <th className="py-3 px-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-gray-400">기록이 없습니다.</td></tr>
                )}
                {logs.map((log, i) => (
                  <tr key={i} className={rowBg(log.result)}>
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatTs(log.timestamp)}</td>
                    <td className="py-2 px-3 text-gray-700">{log.dong}</td>
                    <td className="py-2 px-3 text-gray-700">{log.ho}</td>
                    <td className="py-2 px-3 text-gray-700">{log.name || '-'}</td>
                    <td className="py-2 px-3">{resultBadge(log.result)}</td>
                    <td className="py-2 px-3 text-gray-400 text-xs font-mono">{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
