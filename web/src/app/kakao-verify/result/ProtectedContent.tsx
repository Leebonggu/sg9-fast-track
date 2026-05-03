'use client';

import { useEffect } from 'react';

interface Props {
  password: string;
  link: string;
  dong: string;
  ho: string;
}

export function ProtectedContent({ password, link, dong, ho }: Props) {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('contextmenu', prevent);
    return () => {
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
      document.removeEventListener('contextmenu', prevent);
    };
  }, []);

  return (
    <div
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <div className="text-5xl mb-3 select-none">✓</div>
      <h2 className="text-xl font-bold text-[#2F5496] mb-1 select-none">소유자 인증 완료</h2>
      <p className="text-sm text-gray-500 mb-6 select-none">
        {dong}동 {ho}호 소유자로 확인되었습니다.
      </p>

      {password && (
        /* 검정화면 보호: mix-blend-mode를 이용해 일부 Android 브라우저 캡쳐 시 검정으로 표시 */
        <div className="relative mb-4 rounded-xl overflow-hidden">
          <div className="bg-gray-50 p-4 text-left">
            <p className="text-xs text-gray-400 mb-1">단톡방 입장 비밀번호</p>
            <p className="text-3xl font-bold tracking-widest text-[#2F5496]">
              {password}
            </p>
          </div>
          {/* 스크린샷 방해 오버레이 */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ mixBlendMode: 'difference', background: 'transparent' }}
          />
        </div>
      )}

      {link ? (
        <a
          href={link}
          className="block w-full py-4 bg-[#FEE500] text-[#3C1E1E] rounded-2xl text-base font-bold active:opacity-80 select-none"
          onCopy={(e) => e.preventDefault()}
        >
          카카오톡 단톡방 입장하기
        </a>
      ) : (
        <p className="text-sm text-gray-400 select-none">링크가 아직 설정되지 않았습니다.</p>
      )}

      <p className="text-xs text-gray-400 mt-4 select-none">이 페이지는 30분간 유효합니다.</p>
    </div>
  );
}
