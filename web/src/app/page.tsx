'use client';

import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';

export default function AdminHome() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-16">
        <header className="bg-[#2F5496] text-white p-3.5 sticky top-0 z-40">
          <span className="font-semibold">상계주공 9단지 관리</span>
        </header>
        <div className="p-4 space-y-3 pt-6">
          <Link
            href="/unified"
            className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 active:bg-gray-50"
          >
            <h2 className="font-semibold text-[#2F5496] text-lg">통합 현황</h2>
            <p className="text-sm text-gray-400 mt-1">전체 2,830세대 동의·설문 참여 현황</p>
          </Link>
          <Link
            href="/consent"
            className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 active:bg-gray-50"
          >
            <h2 className="font-semibold text-[#2F5496] text-lg">신통기획접수 관리</h2>
            <p className="text-sm text-gray-400 mt-1">동별 동의서 수거 현황</p>
          </Link>
          <Link
            href="/survey"
            className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 active:bg-gray-50"
          >
            <h2 className="font-semibold text-[#2F5496] text-lg">설문 관리</h2>
            <p className="text-sm text-gray-400 mt-1">설문 응답 수집 및 PDF 생성</p>
          </Link>
          <Link
            href="/kakao-verify-logs"
            className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 active:bg-gray-50"
          >
            <h2 className="font-semibold text-[#2F5496] text-lg">카카오톡 인증 관리</h2>
            <p className="text-sm text-gray-400 mt-1">로그 조회 · 링크 생성</p>
          </Link>
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
