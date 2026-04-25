'use client';

import { useState, useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    setAuthed(sessionStorage.getItem('auth') === '1');
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
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl">
          <h1 className="text-xl font-bold text-[#2F5496]">상계주공 9단지</h1>
          <p className="text-sm text-gray-400 mb-6">관리 시스템</p>
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
          <a href="/guide" className="inline-block mt-5 text-sm text-gray-400 underline underline-offset-2">
            사용 가이드 보기
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
