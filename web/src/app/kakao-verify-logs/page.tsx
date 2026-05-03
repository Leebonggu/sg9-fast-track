'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
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
  };
}

export default function KakaoVerifyLogsPage() {
  const [logs, setLogs] = useState<VerifyLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/kakao-verify-logs')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setLogs(d.logs ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = todayCounts(logs);

  return (
    <AdminLayout>
      <div className="p-4 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-[#2F5496] mb-4">카카오톡 인증 로그</h1>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">오늘 인증 성공</p>
            <p className="text-3xl font-bold text-green-600">{counts.success}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">오늘 인증 실패</p>
            <p className="text-3xl font-bold text-red-500">{counts.fail}</p>
          </div>
        </div>

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
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      기록이 없습니다.
                    </td>
                  </tr>
                )}
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    className={
                      log.result === '성공'
                        ? 'bg-green-50/40 border-b border-gray-50'
                        : 'bg-red-50/40 border-b border-gray-50'
                    }
                  >
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                      {formatTs(log.timestamp)}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{log.dong}</td>
                    <td className="py-2 px-3 text-gray-700">{log.ho}</td>
                    <td className="py-2 px-3 text-gray-700">{log.name}</td>
                    <td className="py-2 px-3">
                      <span
                        className={
                          log.result === '성공'
                            ? 'text-green-600 font-medium'
                            : 'text-red-500 font-medium'
                        }
                      >
                        {log.result}
                      </span>
                    </td>
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
