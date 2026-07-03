'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface DonationRecord {
  id: string;
  timestamp: string;
  dong: string;
  ho: string;
  paidDate: string;
  amount: number;
  registrant: string;
  note: string;
  status: string;
}

interface Props {
  dong: string;
  ho: string;
  onChanged?: (total: number, count: number) => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DonationPanel({ dong, ho, onChanged }: Props) {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatorName, setOperatorName] = useState('');

  const [adding, setAdding] = useState(false);
  const [newPaidDate, setNewPaidDate] = useState(todayStr());
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOperatorName(sessionStorage.getItem('operatorName') || '');
    }
  }, []);

  const fetchDonations = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`/api/unified/donations?dong=${dong}&ho=${ho}`);
    const data = await res.json();
    const list: DonationRecord[] = data.donations ?? [];
    setDonations(list);
    setLoading(false);
    return list;
  }, [dong, ho]);

  function reportChanged(list: DonationRecord[]) {
    const t = list.reduce((sum, d) => sum + d.amount, 0);
    onChanged?.(t, list.length);
  }

  useEffect(() => { fetchDonations(); }, [fetchDonations]);

  const total = donations.reduce((sum, d) => sum + d.amount, 0);

  async function submitAdd() {
    const amount = Number(newAmount);
    if (!newPaidDate || !amount || amount <= 0) {
      alert('납부일과 금액을 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dong, ho, paidDate: newPaidDate, amount, registrant: operatorName, note: newNote,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '저장 실패');
        return;
      }
      setNewPaidDate(todayStr());
      setNewAmount('');
      setNewNote('');
      setAdding(false);
      reportChanged(await fetchDonations());
    } finally {
      setSaving(false);
    }
  }

  function startEdit(d: DonationRecord) {
    setEditingId(d.id);
    setEditPaidDate(d.paidDate);
    setEditAmount(String(d.amount));
  }

  async function submitEdit(id: string) {
    const amount = Number(editAmount);
    if (!editPaidDate || !amount || amount <= 0) {
      alert('납부일과 금액을 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/donations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, paidDate: editPaidDate, amount, operatorName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '저장 실패');
        return;
      }
      setEditingId(null);
      reportChanged(await fetchDonations());
    } finally {
      setSaving(false);
    }
  }

  async function cancelEntry(id: string) {
    if (!confirm('이 후원금 납부 기록을 취소하시겠습니까?')) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/donations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operatorName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '취소 실패');
        return;
      }
      reportChanged(await fetchDonations());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-gray-200">
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-100 bg-gray-50 rounded-t">
        <span className="text-xs font-semibold text-gray-700">후원금 납부 내역</span>
        <span className="text-[11px] text-gray-500">
          총 {donations.length}회 · {total.toLocaleString()}원
        </span>
      </div>

      {loading ? (
        <div className="px-2.5 py-3 text-xs text-gray-400">불러오는 중...</div>
      ) : donations.length === 0 ? (
        <div className="px-2.5 py-3 text-xs text-gray-400">납부 기록이 없습니다.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {donations.map((d) => (
            <div key={d.id} className="px-2.5 py-2">
              {editingId === d.id ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="date"
                    value={editPaidDate}
                    onChange={(e) => setEditPaidDate(e.target.value)}
                    className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="border border-gray-300 rounded px-1.5 py-1 text-xs w-24"
                    placeholder="금액"
                  />
                  <button
                    onClick={() => submitEdit(d.id)}
                    disabled={saving}
                    className="text-[11px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                    className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-700 min-w-0">
                    <span className="shrink-0">{d.paidDate}</span>
                    <span className="font-semibold shrink-0">{d.amount.toLocaleString()}원</span>
                    <span className="text-gray-400 truncate">({d.registrant})</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(d)}
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => cancelEntry(d.id)}
                      disabled={saving}
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-2.5 py-2 border-t border-gray-100">
        {adding ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={newPaidDate}
                onChange={(e) => setNewPaidDate(e.target.value)}
                className="border border-gray-300 rounded px-1.5 py-1 text-xs"
              />
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="금액"
                className="border border-gray-300 rounded px-1.5 py-1 text-xs w-24"
              />
              <span className="text-xs text-gray-400">원</span>
            </div>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="비고 (선택)"
              className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs"
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setAdding(false)}
                disabled={saving}
                className="text-[11px] px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={submitAdd}
                disabled={saving}
                className="text-[11px] px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
          >
            + 후원금 추가
          </button>
        )}
      </div>
    </div>
  );
}
