'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type SurveyResponse = {
  rowIndex: number;
  timestamp: string;
  dong: string;
  ho: string;
  name: string;
  phone: string;
  answers: Record<string, string>;
  pdfGenerated: boolean;
  pdfLink: string;
};

type SurveyStats = {
  total: number;
  generated: number;
  pending: number;
};

export default function SurveyPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null); // 'all' | 'blank' | rowIndex
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth') === '1') {
      setAuthed(true);
      loadData();
    }
  }, []);

  async function doLogin() {
    if (!password) return;
    setLoginError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem('auth', '1');
      setAuthed(true);
      loadData();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/survey');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data.stats);
      setResponses(data.responses);
    } catch (e) {
      setMessage('데이터 로딩 실패: ' + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  async function doGenerate(mode: string, rowIndex?: number) {
    const key = mode === 'single' ? String(rowIndex) : mode;
    setGenerating(key);
    setMessage('');
    try {
      const res = await fetch('/api/survey/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, rowIndex }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (mode === 'blank') {
        setMessage(`빈 설문지 생성 완료`);
        if (data.links?.[0]) window.open(data.links[0], '_blank');
      } else {
        setMessage(`${data.count}건 생성 완료`);
      }

      await loadData();
    } catch (e) {
      setMessage('생성 실패: ' + (e instanceof Error ? e.message : String(e)));
    }
    setGenerating(null);
  }

  // ── 로그인 ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl">
          <h1 className="text-xl font-bold text-[#2F5496]">상계주공 9단지</h1>
          <p className="text-sm text-gray-400 mb-6">설문 관리 시스템</p>
          <input
            type="password"
            className="w-full p-3.5 border-2 border-gray-200 rounded-xl text-center text-lg outline-none focus:border-[#2F5496]"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          />
          <button
            onClick={doLogin}
            className="w-full mt-3 p-3.5 bg-[#2F5496] text-white rounded-xl text-lg font-semibold active:bg-[#1e3a6e]"
          >
            입장
          </button>
          {loginError && <p className="text-red-500 text-sm mt-2">{loginError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 로딩 오버레이 */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin mr-3" />
          <span className="text-gray-500">로딩 중...</span>
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 mr-2 text-lg">←</Link>
        <span className="font-semibold flex-1">설문 관리</span>
        <button onClick={() => loadData()} className="bg-white/20 px-3 py-1.5 rounded-lg text-sm">새로고침</button>
      </header>

      <div className="p-3 space-y-3">
        {/* 현황 카드 */}
        {stats && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">총 응답</p>
                <p className="text-2xl font-bold text-[#2F5496]">{stats.total}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">PDF 완료</p>
                <p className="text-2xl font-bold text-green-600">{stats.generated}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">미생성</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => doGenerate('all')}
            disabled={generating !== null || !stats?.pending}
            className="flex-1 p-3 bg-[#2F5496] text-white rounded-xl font-semibold text-sm disabled:opacity-50 active:bg-[#1e3a6e]"
          >
            {generating === 'all' ? '생성 중...' : `미생성분 일괄 생성 (${stats?.pending || 0}건)`}
          </button>
          <button
            onClick={() => doGenerate('blank')}
            disabled={generating !== null}
            className="p-3 bg-gray-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 active:bg-gray-700"
          >
            {generating === 'blank' ? '생성 중...' : '빈 설문지'}
          </button>
        </div>

        {/* 메시지 */}
        {message && (
          <div className={`p-3 rounded-xl text-sm ${message.includes('실패') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}

        {/* 응답 목록 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-xs text-gray-500">
                <th className="p-2 text-left">동/호</th>
                <th className="p-2 text-left">성명</th>
                <th className="p-2 text-left">시간</th>
                <th className="p-2 text-center">상태</th>
                <th className="p-2 text-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {responses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">응답이 없습니다</td>
                </tr>
              )}
              {responses.map((r) => (
                <tr key={r.rowIndex} className="border-t border-gray-100">
                  <td className="p-2 text-sm font-medium">{r.dong} {r.ho}호</td>
                  <td className="p-2 text-sm">{r.name}</td>
                  <td className="p-2 text-xs text-gray-400">{r.timestamp}</td>
                  <td className="p-2 text-center">
                    {r.pdfGenerated ? (
                      <a
                        href={r.pdfLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium"
                      >
                        완료
                      </a>
                    ) : (
                      <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">대기</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {!r.pdfGenerated && (
                      <button
                        onClick={() => doGenerate('single', r.rowIndex)}
                        disabled={generating !== null}
                        className="px-2.5 py-1 bg-[#2F5496] text-white rounded text-xs font-medium disabled:opacity-50 active:bg-[#1e3a6e]"
                      >
                        {generating === String(r.rowIndex) ? '...' : '생성'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
