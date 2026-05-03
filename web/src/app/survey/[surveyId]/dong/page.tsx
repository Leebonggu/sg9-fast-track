'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';
import SurveyDetailTabs from '@/components/survey/SurveyDetailTabs';
import DongHeatmap from '@/components/DongHeatmap';
import { BUILDINGS, BUILDING_CONFIG, getTotalUnits } from '@/lib/buildings';

type SurveyResponse = {
  rowIndex: number;
  basicInfo: Record<string, string>;
};

export default function SurveyDongPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDong, setSelectedDong] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/survey/${surveyId}`)
      .then((r) => r.json())
      .then((d) => setResponses(d.responses ?? []))
      .finally(() => setLoading(false));
  }, [surveyId]);

  const stats = useMemo(
    () =>
      BUILDINGS.map((building) => {
        const count = responses.filter((r) => r.basicInfo.dong === building).length;
        const total = getTotalUnits(building);
        const rate = total > 0 ? Math.round((count / total) * 100) : 0;
        return { building, count, total, rate };
      }),
    [responses]
  );

  const totalResponded = responses.length;
  const totalUnits = BUILDINGS.reduce((s, b) => s + getTotalUnits(b), 0);
  const totalRate = totalUnits > 0 ? Math.round((totalResponded / totalUnits) * 100) : 0;

  const missingUnits = useMemo(() => {
    if (!selectedDong) return [];
    const config = BUILDING_CONFIG[selectedDong];
    if (!config) return [];
    const respondedSet = new Set(
      responses.filter((r) => r.basicInfo.dong === selectedDong).map((r) => r.basicInfo.ho)
    );
    const excluded = config.excludedUnits ?? [];
    const missing: { unitNum: string }[] = [];
    for (let floor = 1; floor <= config.floors; floor++) {
      for (const u of config.units) {
        const unitNum = String(floor * 100 + u);
        if (!excluded.includes(unitNum) && !respondedSet.has(unitNum)) {
          missing.push({ unitNum });
        }
      }
    }
    return missing.sort((a, b) => Number(a.unitNum) - Number(b.unitNum));
  }, [selectedDong, responses]);

  function handleSelectDong(building: string) {
    setSelectedDong((prev) => (prev === building ? null : building));
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
          <span className="font-semibold flex-1">동별 응답 현황</span>
        </header>

        <SurveyDetailTabs surveyId={surveyId} />

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <>
            <div className="mx-3 mt-3 bg-white rounded-xl shadow-sm p-4">
              <div className="flex gap-4 mb-3">
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-400">응답</p>
                  <p className="text-2xl font-bold text-[#2F5496]">{totalResponded}</p>
                  <p className="text-xs text-gray-400">{totalRate}%</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-400">미응답</p>
                  <p className="text-2xl font-bold text-red-500">{totalUnits - totalResponded}</p>
                  <p className="text-xs text-gray-400">{100 - totalRate}%</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-400">총세대</p>
                  <p className="text-2xl font-bold text-gray-600">{totalUnits}</p>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2F5496] rounded-full"
                  style={{ width: `${totalRate}%` }}
                />
              </div>
            </div>

            <DongHeatmap
              stats={stats}
              selectedDong={selectedDong}
              onSelectDong={handleSelectDong}
              missingUnits={missingUnits}
              missingLoading={false}
              missingLabel="미응답 세대"
              countLabel="응답"
            />
          </>
        )}
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
