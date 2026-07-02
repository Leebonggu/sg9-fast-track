'use client';

import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import DonationImportTable from '@/components/unified/DonationImportTable';
import type { EditableRow } from '@/components/unified/DonationImportTable';
import type { ClassifiedImportRow } from '@/lib/donation-import-types';

interface PreviewResponse {
  new: ClassifiedImportRow[];
  review: ClassifiedImportRow[];
  duplicates: ClassifiedImportRow[];
}

export default function DonationsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newRows, setNewRows] = useState<EditableRow[]>([]);
  const [reviewRows, setReviewRows] = useState<EditableRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/unified/donations/import/preview', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '미리보기 실패');
        setNewRows([]);
        setReviewRows([]);
        setDuplicateCount(0);
        return;
      }
      const body = data as PreviewResponse;
      setNewRows(body.new.map((r) => ({ ...r, checked: true })));
      setReviewRows(body.review.map((r) => ({ ...r, checked: false })));
      setDuplicateCount(body.duplicates.length);
    } finally {
      setLoading(false);
    }
  }

  function editField(rowIdx: number, field: 'dong' | 'ho', value: string) {
    setNewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, [field]: value } : r)));
    setReviewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, [field]: value } : r)));
  }

  function toggleRow(rowIdx: number) {
    setNewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, checked: !r.checked } : r)));
    setReviewRows((prev) => prev.map((r) => (r.rowIdx === rowIdx ? { ...r, checked: !r.checked } : r)));
  }

  async function handleCommit() {
    const toSubmit = [...newRows, ...reviewRows].filter((r) => r.checked && r.dong && r.ho);
    if (toSubmit.length === 0) {
      alert('등록할 건을 선택해 주세요.');
      return;
    }
    setCommitting(true);
    try {
      const operatorName = typeof window !== 'undefined' ? sessionStorage.getItem('operatorName') : '';
      const registrant = operatorName ? `엑셀 일괄등록(${operatorName})` : '엑셀 일괄등록';
      const res = await fetch('/api/unified/donations/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: toSubmit.map((r) => ({ iso: r.iso, dateOnly: r.dateOnly, amount: r.amount, dong: r.dong, ho: r.ho })),
          registrant,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '등록 실패');
        return;
      }
      setResult(data);
      setNewRows([]);
      setReviewRows([]);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-5xl mx-auto">
        <h1 className="text-lg font-bold text-gray-800 mb-4">후원금 일괄업로드</h1>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="text-xs px-3 py-1.5 rounded bg-[#2F5496] text-white font-semibold disabled:opacity-50"
          >
            {loading ? '분석 중...' : '미리보기'}
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {result && (
          <p className="text-sm text-green-600 mb-4">
            등록 완료: {result.inserted}건 (중복으로 제외됨: {result.skipped}건)
          </p>
        )}

        {(newRows.length > 0 || reviewRows.length > 0 || duplicateCount > 0) && (
          <>
            <DonationImportTable
              newRows={newRows}
              reviewRows={reviewRows}
              duplicateCount={duplicateCount}
              onEdit={editField}
              onToggle={toggleRow}
            />
            <button
              onClick={handleCommit}
              disabled={committing}
              className="mt-4 text-sm px-4 py-2 rounded bg-green-600 text-white font-semibold disabled:opacity-50"
            >
              {committing ? '등록 중...' : '선택한 건 등록'}
            </button>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
