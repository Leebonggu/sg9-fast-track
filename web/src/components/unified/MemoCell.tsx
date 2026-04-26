'use client';

import { useState } from 'react';

interface Props {
  dong: string;
  ho: string;
  initialMemo: string;
}

export default function MemoCell({ dong, ho, initialMemo }: Props) {
  const [memo, setMemo] = useState(initialMemo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveMemo(value: string) {
    setSaving(true);
    await fetch('/api/unified/memo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dong, ho, memo: value }),
    });
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 outline-none"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => saveMemo(memo)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveMemo(memo);
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded px-1 py-0.5 min-h-[20px]"
    >
      {memo || <span className="text-gray-300">메모 추가</span>}
    </button>
  );
}
