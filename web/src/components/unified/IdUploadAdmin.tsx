'use client';

import { useCallback, useEffect, useState } from 'react';

interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  fileId: string;
  link: string;
  timestamp: string;
}

interface Props {
  dong: string;
  ho: string;
}

function getPw(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('adminPw') || '';
}

export default function IdUploadAdmin({ dong, ho }: Props) {
  const [owners, setOwners] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<UploadedItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const pw = getPw();
      const res = await fetch(
        `/api/upload-id?dong=${encodeURIComponent(dong)}&ho=${encodeURIComponent(ho)}&pw=${encodeURIComponent(pw)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '조회 실패');
        return;
      }
      setOwners(data.owners || []);
      setUploaded(data.uploaded || []);
    } catch {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [dong, ho]);

  useEffect(() => {
    load();
  }, [load]);

  // 썸네일: 프록시(POST, pw)로 blob 받아 objectURL 생성
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const pw = getPw();
      for (const u of uploaded) {
        if (!u.fileId || urls[u.fileId]) continue;
        try {
          const res = await fetch('/api/upload-id/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: u.fileId, pw }),
          });
          if (!res.ok) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          created.push(url);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setUrls((prev) => ({ ...prev, [u.fileId]: url }));
        } catch {
          /* skip */
        }
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploaded]);

  async function remove(ownerIndex: number) {
    if (!confirm('이 신분증을 폐기(삭제)하시겠습니까? 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch('/api/upload-id', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho, ownerIndex, pw: getPw() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '삭제 실패');
        return;
      }
      await load();
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  }

  const byIndex = new Map(uploaded.map((u) => [u.ownerIndex, u]));

  // 감지된 소유자 슬롯 + 감지 범위를 넘는 추가 업로드(공동소유 미감지분)
  const slots: { index: number; name: string }[] = owners.map((name, idx) => ({
    index: idx,
    name,
  }));
  for (const u of uploaded) {
    if (u.ownerIndex >= owners.length) {
      slots.push({ index: u.ownerIndex, name: u.ownerName || `추가 ${u.ownerIndex - owners.length + 1}` });
    }
  }
  slots.sort((a, b) => a.index - b.index);

  return (
    <div className="mt-3 rounded bg-gray-50 border border-gray-200 px-2.5 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-gray-600">신분증 사본</p>
        <a
          href={`/unified/id-print?dong=${encodeURIComponent(dong)}&ho=${encodeURIComponent(ho)}`}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-blue-600 underline"
        >
          인쇄용 보기
        </a>
      </div>
      {loading ? (
        <p className="text-[11px] text-gray-400">불러오는 중…</p>
      ) : error ? (
        <p className="text-[11px] text-red-500">{error}</p>
      ) : slots.length === 0 ? (
        <p className="text-[11px] text-gray-400">소유자 정보 없음</p>
      ) : (
        <div className="space-y-1.5">
          {slots.map(({ index: idx, name }) => {
            const u = byIndex.get(idx);
            return (
              <div key={idx} className="flex items-center gap-2">
                {u && urls[u.fileId] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[u.fileId]}
                    alt={`${name} 신분증`}
                    className="w-12 h-12 object-cover rounded border border-gray-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded border border-dashed border-gray-300 flex items-center justify-center text-[9px] text-gray-300">
                    {u ? '…' : '없음'}
                  </div>
                )}
                <span className="text-xs text-gray-700 flex-1 truncate">{name}</span>
                {u ? (
                  <>
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 underline"
                    >
                      원본
                    </a>
                    <button
                      onClick={() => remove(idx)}
                      className="text-[11px] text-red-500 underline"
                    >
                      폐기
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-gray-400">미제출</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
