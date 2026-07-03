'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface Props {
  lastSynced: string | null;
  onSynced: () => void;
}

export default function SyncButton({ lastSynced, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');
  const [dupWarning, setDupWarning] = useState('');

  async function handleSync() {
    setSyncing(true);
    const res = await adminFetch('/api/unified/sync', { method: 'POST' });
    const data = await res.json();
    setSyncing(false);
    if (data.success) {
      setToast(`동기화 완료: ${data.result.updatedRows}건 (${data.result.durationMs}ms)`);
      setTimeout(() => setToast(''), 5000);
      const dups = data.result.duplicates ?? [];
      if (dups.length > 0) {
        const list = dups.map((d: { dong: string; ho: string; count: number }) => `${d.dong} ${d.ho}호`).join(', ');
        setDupWarning(`⚠️ 중복 수거 감지 (${dups.length}건): ${list}`);
        setTimeout(() => setDupWarning(''), 10000);
      } else {
        setDupWarning('');
      }
      onSynced();
    }
  }

  const formattedTime = lastSynced
    ? new Date(lastSynced).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '없음';

  return (
    <div className="flex flex-col items-end gap-1">
      {dupWarning && (
        <span className="text-[10px] sm:text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 sm:px-3 py-1 rounded-lg max-w-[280px] sm:max-w-none">
          {dupWarning}
        </span>
      )}
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      {toast && (
        <span className="text-[10px] sm:text-xs text-green-600 bg-green-50 px-2 sm:px-3 py-1 rounded-full max-w-[140px] sm:max-w-none truncate">
          {toast}
        </span>
      )}
      <span className="hidden sm:inline text-xs text-gray-400 truncate">
        마지막 동기화: {formattedTime}
      </span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="shrink-0 px-3 sm:px-4 py-2 text-xs bg-[#2F5496] text-white rounded-lg hover:bg-[#243f73] disabled:opacity-50 transition-colors"
      >
        {syncing ? '동기화 중...' : '동기화'}
      </button>
    </div>
    </div>
  );
}
