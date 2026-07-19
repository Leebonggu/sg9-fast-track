'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { compressImage } from '@/lib/image-compress';

interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  fileId: string;
  link: string;
  timestamp: string;
  phone: string;
  correctionAllowed: boolean;
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
  const [phones, setPhones] = useState<Record<number, string>>({});
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

  const [printing, setPrinting] = useState(false);

  // 인쇄용 보기는 새 탭에서 열리는데, 새 탭은 이 탭의 sessionStorage(adminPw)를
  // 못 읽는 경우가 있어(특히 모바일) 로그인 필요 메시지가 반복 노출됐다.
  // 그래서 이 탭(이미 인증됨)에서 (동,호) 스코프 토큰을 미리 발급받아 링크에 실어 보낸다.
  async function openPrint() {
    setPrinting(true);
    try {
      const res = await adminFetch('/api/admin/id-view-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '인쇄용 링크 생성 실패');
        return;
      }
      const url = `/unified/id-print?dong=${encodeURIComponent(dong)}&ho=${encodeURIComponent(ho)}&t=${encodeURIComponent(data.token)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('인쇄용 링크 생성 중 오류가 발생했습니다.');
    } finally {
      setPrinting(false);
    }
  }

  const [correctionLinks, setCorrectionLinks] = useState<Record<number, string>>({});
  const [allowingIdx, setAllowingIdx] = useState<number | null>(null);

  async function requestCorrection(ownerIndex: number) {
    setAllowingIdx(ownerIndex);
    try {
      const res = await adminFetch('/api/admin/id-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho, ownerIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '정정 허용 실패');
        return;
      }
      const link = `${window.location.origin}/check-submission/result?t=${encodeURIComponent(data.token)}`;
      setCorrectionLinks((prev) => ({ ...prev, [ownerIndex]: link }));
      await load();
    } finally {
      setAllowingIdx(null);
    }
  }

  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [extraCount, setExtraCount] = useState(0);

  async function upload(ownerIndex: number, name: string, file: File | null, phone: string) {
    if (!file) return;
    setBusyIdx(ownerIndex);
    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch('/api/upload-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pw: getPw(), dong, ho, ownerIndex, ownerName: name, phone: phone.trim(), mimeType, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '업로드 실패');
        return;
      }
      // 방금 채운 게 빈 추가 슬롯이면 그 몫만큼 추가 슬롯 수를 줄임 (업로드분은 아래 overflow로 표시됨)
      if (ownerIndex >= owners.length && !uploaded.some((u) => u.ownerIndex === ownerIndex)) {
        setExtraCount((c) => Math.max(0, c - 1));
      }
      await load();
    } catch {
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setBusyIdx(null);
    }
  }

  const byIndex = new Map(uploaded.map((u) => [u.ownerIndex, u]));

  // 감지된 소유자 슬롯 + 감지 범위를 넘는 추가 업로드(공동소유 미감지분) + 빈 추가 슬롯
  const slots: { index: number; name: string }[] = owners.map((name, idx) => ({
    index: idx,
    name,
  }));
  for (const u of uploaded) {
    if (u.ownerIndex >= owners.length) {
      slots.push({ index: u.ownerIndex, name: u.ownerName || `추가 ${u.ownerIndex - owners.length + 1}` });
    }
  }
  const maxIndex = slots.reduce((m, s) => Math.max(m, s.index), owners.length - 1);
  for (let k = 1; k <= extraCount; k++) {
    const index = maxIndex + k;
    slots.push({ index, name: `추가 ${index - owners.length + 1}` });
  }
  slots.sort((a, b) => a.index - b.index);

  return (
    <div className="mt-3 rounded bg-gray-50 border border-gray-200 px-2.5 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-gray-600">신분증 사본</p>
        <button
          type="button"
          onClick={openPrint}
          disabled={printing}
          className="text-[11px] text-blue-600 underline disabled:opacity-50"
        >
          인쇄용 보기
        </button>
      </div>
      {loading ? (
        <p className="text-[11px] text-gray-400">불러오는 중…</p>
      ) : error ? (
        <p className="text-[11px] text-red-500">{error}</p>
      ) : (
        <>
          {slots.length === 0 ? (
            <p className="text-[11px] text-gray-400 mb-1.5">소유자 정보 없음 — 아래에서 직접 추가할 수 있습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {slots.map(({ index: idx, name }) => {
                const u = byIndex.get(idx);
                const isBusy = busyIdx === idx;
                const phoneVal = phones[idx] ?? u?.phone ?? '';
                return (
                  <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
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
                    <span className="text-xs text-gray-700 flex-1 truncate">
                      {name}
                      {u?.phone && <span className="text-gray-400"> · {u.phone}</span>}
                    </span>
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
                        <button
                          onClick={() => requestCorrection(idx)}
                          disabled={allowingIdx === idx}
                          className="text-[11px] text-emerald-600 underline disabled:opacity-50"
                        >
                          {u.correctionAllowed ? '정정 허용됨' : '정정 허용'}
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-gray-400">미제출</span>
                    )}
                    <label
                      className={`shrink-0 text-[11px] px-2 py-1 rounded cursor-pointer ${
                        isBusy ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isBusy ? '…' : u ? '재업로드' : '업로드'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={busyIdx !== null}
                        onChange={(e) => {
                          upload(idx, name, e.target.files?.[0] ?? null, phoneVal);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneVal}
                    placeholder="연락처 (선택)"
                    disabled={busyIdx !== null}
                    onChange={(e) => setPhones((prev) => ({ ...prev, [idx]: e.target.value }))}
                    className="ml-14 w-[calc(100%-3.5rem)] border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 disabled:opacity-50"
                  />
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExtraCount((c) => c + 1)}
            disabled={busyIdx !== null || extraCount >= 10}
            className="mt-2 w-full text-[11px] font-semibold text-blue-600 border border-dashed border-blue-300 rounded py-1.5 disabled:opacity-40"
          >
            ＋ 신분증 추가
          </button>
        </>
      )}
      {Object.entries(correctionLinks).map(([idx, link]) => (
        <div key={idx} className="mt-1.5 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          <span className="text-[10px] text-emerald-700 truncate flex-1">{link}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(link)}
            className="text-[10px] text-emerald-700 font-semibold shrink-0"
          >
            복사
          </button>
        </div>
      ))}
    </div>
  );
}
