'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type SurveySummary = {
  id: string;
  title: string;
  organizer: string;
};

export default function SurveyListPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth') === '1') {
      setAuthed(true);
      loadSurveys();
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
      loadSurveys();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  }

  async function loadSurveys() {
    setLoading(true);
    try {
      const res = await fetch('/api/survey');
      const data = await res.json();
      setSurveys(data.surveys || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }

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
      <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
        <Link
          href="/"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 mr-2 text-lg"
        >
          ←
        </Link>
        <span className="font-semibold flex-1">설문 관리</span>
      </header>

      <div className="p-4 space-y-3">
        {loading && <p className="text-center text-gray-400 py-8">로딩 중...</p>}

        {!loading && surveys.length === 0 && (
          <p className="text-center text-gray-400 py-8">등록된 설문이 없습니다.</p>
        )}

        {surveys.map((s) => (
          <Link
            key={s.id}
            href={`/survey/${s.id}`}
            className="block bg-white rounded-xl p-5 shadow-sm active:bg-gray-50 border border-gray-100"
          >
            <h2 className="font-semibold text-[#2F5496] text-lg">{s.title}</h2>
            <p className="text-sm text-gray-400 mt-1">{s.organizer}</p>
            <p className="text-xs text-gray-300 mt-2">{s.id}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
