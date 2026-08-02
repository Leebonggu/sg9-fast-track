'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface Props {
  dong: string;
  ho: string;
  initialMemo: string;
}

export default function MemoCell({ dong, ho, initialMemo }: Props) {
  const [memo, setMemo] = useState(initialMemo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 행 key가 "동-호"라 데이터가 갱신돼도 이 컴포넌트는 재마운트되지 않는다.
  // useState 초기값은 최초 마운트에만 쓰이므로, 그대로 두면 sync로 메모가 바뀌어도
  // 새로고침 전까지 옛 값이 계속 보인다.
  // 저장 직후에는 부모 rows가 아직 옛 값이라 무조건 동기화하면 방금 입력한 내용이 되돌아간다.
  // → prop이 실제로 바뀐 순간에만 반영한다 (편집 중에는 입력을 방해하지 않도록 건너뜀).
  const [lastProp, setLastProp] = useState(initialMemo);
  if (initialMemo !== lastProp) {
    setLastProp(initialMemo);
    if (!editing) setMemo(initialMemo);
  }

  async function saveMemo(value: string) {
    setSaving(true);
    await adminFetch('/api/unified/memo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dong, ho, memo: value }),
    });
    setSaving(false);
    setEditing(false);
  }

  // 표의 가상 스크롤은 모든 행이 정확히 ROW_H(41px)라고 가정한다. 메모가 여러 줄이 되거나
  // 편집 상자가 행을 밀어내면 그 가정이 깨져 스크롤이 꿀렁거린다.
  // → 표시는 항상 한 줄로 자르고(전체 내용은 title), 편집 상자는 absolute로 띄워
  //   행 높이에 영향을 주지 않게 한다.
  //
  // 편집기가 input이 아니라 textarea인 이유: sync가 붙이는 [설문연락처] 줄 때문에 메모가
  // 여러 줄일 수 있는데, <input>은 값에서 줄바꿈을 지워버려 편집만 해도 한 줄로 뭉개진다.
  // Enter는 줄바꿈, 저장은 포커스 아웃 또는 Ctrl/Cmd+Enter.
  return (
    <div className="relative">
      <button
        onClick={() => setEditing(true)}
        title={memo || undefined}
        data-cell="memo"
        className="block w-full text-left text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded px-1 py-0.5 h-[24px] leading-[16px] truncate"
      >
        {memo.replace(/\n/g, ' · ') || <span className="text-gray-300">메모 추가</span>}
      </button>
      {editing && (
        <textarea
          autoFocus
          rows={Math.min(memo.split('\n').length + 1, 5)}
          className="absolute inset-x-0 top-0 z-20 w-full text-xs border border-blue-400 rounded px-1 py-0.5 outline-none bg-white shadow-lg resize-y"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => saveMemo(memo)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveMemo(memo);
            if (e.key === 'Escape') {
              setMemo(initialMemo); // 편집 취소 → 원래 값으로 되돌림
              setEditing(false);
            }
          }}
          disabled={saving}
        />
      )}
    </div>
  );
}
