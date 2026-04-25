'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';

type SurveySummary = {
  id: string;
  title: string;
  organizer: string;
};

export default function SurveyListPage() {
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, []);

  async function loadSurveys() {
    setLoading(true);
    try {
      const res = await fetch('/api/survey');
      const data = await res.json();
      setSurveys(data.surveys || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-16">
        <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 mr-2 text-lg"
          >
            ←
          </Link>
          <span className="font-semibold flex-1">설문 관리</span>
        </header>

        <div className="p-4 space-y-3">
          {loading && <p className="text-center text-gray-400 py-8">로딩 중...</p>}

          {!loading && surveys.length === 0 && (
            <p className="text-center text-gray-400 py-8">등록된 설문이 없습니다.</p>
          )}

          {surveys.map((s) => (
            <Link
              key={s.id}
              href={`/survey/${s.id}`}
              className="block bg-white rounded-xl p-5 shadow-sm active:bg-gray-50 border border-gray-100"
            >
              <h2 className="font-semibold text-[#2F5496] text-lg">{s.title}</h2>
              <p className="text-sm text-gray-400 mt-1">{s.organizer}</p>
              <p className="text-xs text-gray-300 mt-2">{s.id}</p>
            </Link>
          ))}
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
