'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import MissingRespondents from '@/components/survey/MissingRespondents';
import SurveyDetailTabs from '@/components/survey/SurveyDetailTabs';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';

export default function SurveyMissingPage() {
  const { surveyId } = useParams<{ surveyId: string }>();

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
          <span className="font-semibold flex-1">미응답 현황</span>
        </header>

        <SurveyDetailTabs surveyId={surveyId} />

        <div className="p-3">
          <MissingRespondents surveyId={surveyId} />
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
