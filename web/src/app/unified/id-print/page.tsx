'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  fileId: string;
  link: string;
  timestamp: string;
}

function getPw(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('adminPw') || '';
}

function IdPrintInner() {
  const sp = useSearchParams();
  const dong = sp.get('dong') || '';
  const ho = sp.get('ho') || '';
  const t = sp.get('t') || '';

  const [items, setItems] = useState<UploadedItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('불러오는 중…');

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      // t(동/호 스코프 토큰, IdUploadAdmin이 발급)가 있으면 그걸 우선 사용 — 새 탭에서
      // sessionStorage의 관리자 비밀번호를 못 읽는 경우에도 동작하도록.
      // 없으면 기존처럼 이 탭의 세션스토리지 pw로 폴백(직접 URL을 다시 연 경우 등).
      const pw = t ? '' : getPw();
      if (!t && !pw) {
        setStatus('관리자 로그인이 필요합니다. 통합현황에서 로그인 후 다시 시도해 주세요.');
        return;
      }
      try {
        const listQs = t
          ? `t=${encodeURIComponent(t)}`
          : `dong=${encodeURIComponent(dong)}&ho=${encodeURIComponent(ho)}&pw=${encodeURIComponent(pw)}`;
        const res = await fetch(`/api/upload-id?${listQs}`);
        const data = await res.json();
        if (!res.ok) {
          setStatus(data.error || '조회 실패');
          return;
        }
        const ups: UploadedItem[] = data.uploaded || [];
        if (ups.length === 0) {
          setStatus('업로드된 신분증이 없습니다.');
          return;
        }
        if (cancelled) return;
        setItems(ups);

        const map: Record<string, string> = {};
        for (const u of ups) {
          const r = await fetch('/api/upload-id/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t ? { fileId: u.fileId, t } : { fileId: u.fileId, pw }),
          });
          if (!r.ok) continue;
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          created.push(url);
          map[u.fileId] = url;
        }
        if (cancelled) {
          created.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        setUrls(map);
        setStatus('');
        setTimeout(() => window.print(), 600);
      } catch {
        setStatus('이미지를 불러오지 못했습니다.');
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [dong, ho, t]);

  if (status) {
    return <div className="p-8 text-sm text-gray-600">{status}</div>;
  }

  return (
    <div className="p-4 print:p-0">
      <div className="mb-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="text-sm px-4 py-2 bg-[#2F5496] text-white rounded"
        >
          인쇄
        </button>
        <span className="ml-3 text-xs text-gray-500">
          {dong}동 {ho}호 · 신분증 {items.length}건
        </span>
      </div>
      <div className="space-y-6">
        {items.map((u) => (
          <div key={u.fileId} className="break-inside-avoid">
            <div className="text-sm font-semibold mb-1">
              {dong}동 {ho}호 · {u.ownerName}
            </div>
            {urls[u.fileId] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[u.fileId]}
                alt={`${u.ownerName} 신분증`}
                className="max-w-full border border-gray-300"
              />
            ) : (
              <div className="text-xs text-gray-400">이미지 로드 실패</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IdPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-600">불러오는 중…</div>}>
      <IdPrintInner />
    </Suspense>
  );
}
