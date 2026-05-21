'use client';

import { useEffect, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';

interface Props {
  row: UnifiedRow;
  onClose: () => void;
  onSaved?: () => void;
}

export default function EditRowModal({ row, onClose, onSaved }: Props) {
  const [ownerName, setOwnerName] = useState(row.ownerName ?? '');
  const [postalCode, setPostalCode] = useState(row.postalCode ?? '');
  const [address, setAddress] = useState(row.address ?? '');
  const [residency, setResidency] = useState(row.residency ?? '');
  const [saving, setSaving] = useState(false);
  const [operatorName, setOperatorName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOperatorName(sessionStorage.getItem('operatorName') || '');
    }
  }, []);

  function buildDiff() {
    const overrides: Record<string, string> = {};
    if (ownerName !== (row.ownerName ?? '')) overrides.ownerName = ownerName;
    if (postalCode !== (row.postalCode ?? '')) overrides.postalCode = postalCode;
    if (address !== (row.address ?? '')) overrides.address = address;
    if (residency !== (row.residency ?? '')) overrides.residency = residency;
    return overrides;
  }

  async function save() {
    const overrides = buildDiff();
    if (Object.keys(overrides).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/unified/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, overrides, operatorName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '저장 실패');
        return;
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const diffCount = Object.keys(buildDiff()).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            {row.dong}동 {row.ho}호 수정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 -mr-2"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <Field
            label="소유자명"
            value={ownerName}
            onChange={setOwnerName}
            help="여러 명은 콤마(,)로 구분 — 최대 5명"
          />
          <Field
            label="우편번호"
            value={postalCode}
            onChange={setPostalCode}
            inputMode="numeric"
            maxLength={5}
            help="5자리, leading-zero 자동 보정"
          />
          <Field label="대표주소" value={address} onChange={setAddress} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">실거주여부</label>
            <select
              value={residency}
              onChange={(e) => setResidency(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">(빈값)</option>
              <option value="실거주">실거주</option>
              <option value="임대">임대</option>
            </select>
          </div>
        </div>

        <div className="mt-3 rounded bg-amber-50 border border-amber-200 px-2.5 py-2">
          <p className="text-[11px] text-amber-800 leading-snug">
            ⚠ <b>원본 시트가 직접 수정됩니다.</b> 변경 이력(시각/이전값/새값/수정자)은 <b>변경로그</b> 시트에 자동 기록됩니다.
          </p>
          <p className="text-[10px] text-amber-700 mt-1">
            수정자: <b>{operatorName || '(이름 미입력 — IP로 기록됨)'}</b>
          </p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-gray-500">
            {diffCount === 0 ? '변경 없음' : `${diffCount}개 필드 변경됨`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving || diffCount === 0}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  maxLength,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {help && <p className="text-[10px] text-gray-400 mt-0.5">{help}</p>}
    </div>
  );
}
