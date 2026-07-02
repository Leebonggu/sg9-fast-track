'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';
import DonationListTable from '@/components/unified/DonationListTable';
import type { DonationRecord } from '@/lib/donation';

type StatusFilter = 'all' | '정상' | '취소';

export default function DonationsListPage() {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/unified/donations');
    const data = await res.json();
    setDonations(data.donations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = donations.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    const digits = search.replace(/[^0-9]/g, '');
    if (digits && !`${d.dong}${d.ho}`.includes(digits)) return false;
    return true;
  });

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: '정상', label: '정상' },
    { key: '취소', label: '취소' },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="p-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link href="/unified" className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
              ← 통합현황으로
            </Link>
            <Link href="/unified/donations-import" className="text-xs text-[#2F5496] hover:underline">
              일괄업로드 →
            </Link>
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-4">후원금 전체 목록</h1>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {statusTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  statusFilter === key
                    ? 'bg-[#2F5496] text-white border-[#2F5496]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="동/호수 검색 (예: 901101)"
              className="text-xs border border-gray-300 rounded px-2 py-1.5 ml-auto"
            />
          </div>

          {!loading && (
            <p className="text-xs text-gray-400 mb-2">
              {filtered.length.toLocaleString()}건 표시 중 / 전체 {donations.length.toLocaleString()}건
            </p>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin" />
              <span className="text-xs text-gray-400">불러오는 중...</span>
            </div>
          ) : (
            <DonationListTable donations={filtered} onChanged={fetchData} />
          )}
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
