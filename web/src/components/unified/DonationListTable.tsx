'use client';

import { useState } from 'react';
import type { DonationRecord } from '@/lib/donation';

interface Props {
  donations: DonationRecord[];
  onChanged: () => void;
}

function operatorName(): string {
  return typeof window !== 'undefined' ? sessionStorage.getItem('operatorName') || '' : '';
}

export default function DonationListTable({ donations, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

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
      const res = await fetch('/api/unified/donations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, paidDate: editPaidDate, amount, operatorName: operatorName() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '저장 실패');
        return;
      }
      setEditingId(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function cancelEntry(id: string) {
    if (!confirm('이 후원금 납부 기록을 취소하시겠습니까?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/unified/donations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operatorName: operatorName() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '취소 실패');
        return;
      }
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (donations.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">거래 내역이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-2 text-left">납부일</th>
            <th className="p-2 text-left">동</th>
            <th className="p-2 text-left">호수</th>
            <th className="p-2 text-right">금액</th>
            <th className="p-2 text-left">등록자</th>
            <th className="p-2 text-left">비고</th>
            <th className="p-2 text-left">상태</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {donations.map((d) => (
            <tr key={d.id} className="border-t border-gray-100">
              {editingId === d.id ? (
                <>
                  <td className="p-2">
                    <input
                      type="date"
                      value={editPaidDate}
                      onChange={(e) => setEditPaidDate(e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="p-2">{d.dong}</td>
                  <td className="p-2">{d.ho}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 w-24 text-right"
                    />
                  </td>
                  <td className="p-2 text-gray-400">{d.registrant}</td>
                  <td className="p-2 text-gray-400">{d.note}</td>
                  <td className="p-2">{d.status}</td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => submitEdit(d.id)}
                      disabled={saving}
                      className="text-[11px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 mr-1"
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
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2 whitespace-nowrap">{d.paidDate}</td>
                  <td className="p-2">{d.dong}</td>
                  <td className="p-2">{d.ho}</td>
                  <td className="p-2 text-right">{d.amount.toLocaleString()}</td>
                  <td className="p-2 text-gray-400 truncate max-w-[140px]">{d.registrant}</td>
                  <td className="p-2 text-gray-400 truncate max-w-[160px]">{d.note}</td>
                  <td className="p-2">
                    <span className={d.status === '취소' ? 'text-red-500' : 'text-gray-600'}>{d.status}</span>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(d)}
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 mr-1"
                    >
                      수정
                    </button>
                    {d.status !== '취소' && (
                      <button
                        onClick={() => cancelEntry(d.id)}
                        disabled={saving}
                        className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        취소
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
