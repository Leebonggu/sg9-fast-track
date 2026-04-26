'use client';

import { useState } from 'react';

interface Props {
  lastSynced: string | null;
  onSynced: () => void;
}

export default function SyncButton({ lastSynced, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');

  async function handleSync() {
    setSyncing(true);
    const res = await fetch('/api/unified/sync', { method: 'POST' });
    const data = await res.json();
    setSyncing(false);
    if (data.success) {
      setToast(`동기화 완료: ${data.result.updatedRows}건 (${data.result.durationMs}ms)`);
      setTimeout(() => setToast(''), 4000);
      onSynced();
    }
  }

  const formattedTime = lastSynced
    ? new Date(lastSynced).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '없음';

  return (
    <div className="flex items-center gap-3">
      {toast && (
        <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">{toast}</span>
      )}
      <span className="text-xs text-gray-400">마지막 동기화: {formattedTime}</span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 text-xs bg-[#2F5496] text-white rounded-lg hover:bg-[#243f73] disabled:opacity-50 transition-colors"
      >
        {syncing ? '동기화 중...' : '동기화'}
      </button>
    </div>
  );
}
