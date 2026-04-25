'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SurveyAnalytics from '@/components/survey/SurveyAnalytics';
import SurveyDetailTabs from '@/components/survey/SurveyDetailTabs';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';

type BasicInfoFieldMeta = { key: string; label: string };
type SurveyQuestion = { id: string; label: string; options: string[] };

type SurveyConfigMeta = {
  id: string;
  title: string;
  basicInfoFields: BasicInfoFieldMeta[];
  questions: SurveyQuestion[];
  isClosed: boolean;
  closedAt: string;
};

type SurveyResponse = {
  rowIndex: number;
  timestamp: string;
  basicInfo: Record<string, string>;
  answers: Record<string, string>;
  entryPath: string;
  pdfGenerated: boolean;
  pdfLink: string;
};

export type DongData = { dong: string; total: number; responded: number };

export default function SurveyAnalyticsPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [config, setConfig] = useState<SurveyConfigMeta | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [dongData, setDongData] = useState<DongData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [surveyRes, missingRes] = await Promise.all([
        fetch(`/api/survey/${surveyId}`),
        fetch(`/api/survey/${surveyId}/missing`),
      ]);
      const data = await surveyRes.json();
      if (data.error) throw new Error(data.error);
      const missingData = await missingRes.json();
      setConfig(data.config);
      setResponses(data.responses);
      setDongData(
        (missingData.missing || [])
          .map((d: { dong: string; total: number; responded: number }) => ({
            dong: d.dong,
            total: d.total,
            responded: d.responded,
          }))
          .sort(
            (a: DongData, b: DongData) =>
              parseInt(a.dong.replace(/[^0-9]/g, ''), 10) -
              parseInt(b.dong.replace(/[^0-9]/g, ''), 10),
          ),
      );
    } catch (e) {
      setError('데이터 로딩 실패: ' + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-16">
        <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
          <Link
            href={`/survey/${surveyId}`}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 mr-2 text-lg"
          >
            ←
          </Link>
          <span className="font-semibold flex-1">통계 분석</span>
          <button onClick={loadData} className="bg-white/20 px-3 py-1.5 rounded-lg text-sm">
            새로고침
          </button>
        </header>

        <SurveyDetailTabs surveyId={surveyId} />

        <div className="p-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#2F5496] rounded-full animate-spin mr-2" />
              로딩 중...
            </div>
          )}
          {error && <p className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</p>}
          {!loading && config && (
            <SurveyAnalytics config={config} responses={responses} dongData={dongData} />
          )}
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
