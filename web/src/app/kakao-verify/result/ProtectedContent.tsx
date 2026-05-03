'use client';

import { useEffect, useRef } from 'react';

interface PasswordDisplayProps {
  password: string;
}

function PasswordDisplay({ password }: PasswordDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !password) return;

    const W = canvas.offsetWidth || 300;
    const H = 88;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.fillText('단톡방 입장 비밀번호', 16, 24);

    ctx.fillStyle = '#2F5496';
    ctx.font = 'bold 36px monospace';
    ctx.letterSpacing = '4px';
    ctx.fillText(password, 16, 68);

    // captureStream: Android Chrome에서 video 레이어로 렌더링 → 스크린샷 검정
    if (typeof (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream === 'function') {
      try {
        const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(0);
        video.srcObject = stream;
        video.play().catch(() => {});
        video.style.display = 'block';
        canvas.style.display = 'none';
      } catch {
        // captureStream 실패 시 canvas 그대로 표시
        video.style.display = 'none';
      }
    } else {
      // iOS 등 미지원 브라우저: canvas fallback
      video.style.display = 'none';
    }
  }, [password]);

  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden mb-4">
      <canvas ref={canvasRef} className="w-full block" style={{ height: '88px' }} />
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full absolute inset-0"
        style={{ display: 'none', height: '88px', objectFit: 'fill' }}
      />
    </div>
  );
}

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
      <div className="text-5xl mb-3">✓</div>
      <h2 className="text-xl font-bold text-[#2F5496] mb-1">소유자 인증 완료</h2>
      <p className="text-sm text-gray-500 mb-6">
        {dong}동 {ho}호 소유자로 확인되었습니다.
      </p>

      {password && <PasswordDisplay password={password} />}

      {link ? (
        <a
          href={link}
          className="block w-full py-4 bg-[#FEE500] text-[#3C1E1E] rounded-2xl text-base font-bold active:opacity-80"
          onCopy={(e) => e.preventDefault()}
        >
          카카오톡 단톡방 입장하기
        </a>
      ) : (
        <p className="text-sm text-gray-400">링크가 아직 설정되지 않았습니다.</p>
      )}

      <p className="text-xs text-gray-400 mt-4">이 페이지는 30분간 유효합니다.</p>
    </div>
  );
}
