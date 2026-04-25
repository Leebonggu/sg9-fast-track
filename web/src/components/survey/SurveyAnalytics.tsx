'use client';

import { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { PDFDocument } from 'pdf-lib';
import CrossTabChart from './CrossTabChart';

type SurveyQuestion = { id: string; label: string; options: string[] };
type BasicInfoFieldMeta = { key: string; label: string };

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

type DongData = { dong: string; total: number; responded: number };

interface SurveyAnalyticsProps {
  config: SurveyConfigMeta;
  responses: SurveyResponse[];
  dongData?: DongData[];
}

const AGE_GROUPS = ['20대', '30대', '40대', '50대', '60대 이상'];
const CROSS_TAB_QUESTIONS = ['Q6', 'Q1', 'Q2', 'Q3'];
const OPTION_COLORS = ['#2F5496', '#0891B2', '#0D9488', '#6366F1', '#8B5CF6', '#64748B'];

function hasData(matrix: number[][]): boolean {
  return matrix.some((row) => row.some((v) => v > 0));
}

export default function SurveyAnalytics({ config, responses, dongData = [] }: SurveyAnalyticsProps) {
  const analyticsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { ageDistribution, crossTabs, questionStats, dongDistSorted } = useMemo(() => {
    const ageDist: Record<string, number> = {};
    for (const ag of AGE_GROUPS) ageDist[ag] = 0;
    for (const r of responses) {
      const ag = r.basicInfo.ageGroup;
      if (ag && ageDist[ag] !== undefined) ageDist[ag]++;
    }

    const crossTabsResult: Record<string, number[][]> = {};
    for (const qId of CROSS_TAB_QUESTIONS) {
      const question = config.questions.find((q) => q.id === qId);
      if (!question) continue;
      const matrix: number[][] = AGE_GROUPS.map(() => new Array(question.options.length).fill(0));
      for (const r of responses) {
        const ag = r.basicInfo.ageGroup;
        const answer = r.answers[qId];
        if (!ag || !answer) continue;
        const rowIdx = AGE_GROUPS.indexOf(ag);
        const colIdx = question.options.indexOf(answer);
        if (rowIdx === -1 || colIdx === -1) continue;
        matrix[rowIdx][colIdx]++;
      }
      crossTabsResult[qId] = matrix;
    }

    const questionStatsResult = config.questions.map((q) => {
      const counts: Record<string, number> = {};
      q.options.forEach((opt) => (counts[opt] = 0));
      responses.forEach((r) => {
        const ans = r.answers[q.id];
        if (ans && counts[ans] !== undefined) counts[ans]++;
      });
      return { question: q, counts };
    });

    const dongDist: Record<string, number> = {};
    for (const r of responses) {
      const dong = r.basicInfo.dong;
      if (dong) dongDist[dong] = (dongDist[dong] || 0) + 1;
    }
    const sorted = Object.entries(dongDist).sort(
      (a, b) => parseInt(a[0].replace(/[^0-9]/g, ''), 10) - parseInt(b[0].replace(/[^0-9]/g, ''), 10),
    );

    return { ageDistribution: ageDist, crossTabs: crossTabsResult, questionStats: questionStatsResult, dongDistSorted: sorted };
  }, [config.questions, responses]);

  const maxAge = Math.max(...Object.values(ageDistribution), 1);

  const totalUnits = dongData.reduce((s, d) => s + d.total, 0);
  const totalResponded = dongData.reduce((s, d) => s + d.responded, 0);
  const overallPct = totalUnits > 0 ? Math.round((totalResponded / totalUnits) * 100) : 0;

  async function downloadPdf() {
    if (!analyticsRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(analyticsRef.current, { scale: 2, useCORS: true });
      const pdfDoc = await PDFDocument.create();
      const pageWidth = 842;
      const pageHeight = 595;
      const imgData = canvas.toDataURL('image/png');
      const pngBytes = await fetch(imgData).then((r) => r.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const scale = pageWidth / canvas.width;
      const imgHeight = canvas.height * scale;
      let y = 0;
      while (y < imgHeight) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(pngImage, {
          x: 0,
          y: pageHeight - Math.min(pageHeight, imgHeight - y),
          width: pageWidth,
          height: imgHeight,
        });
        y += pageHeight;
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      a.download = `${config.id}-통계분석-${today}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  const hasAgeData = responses.some((r) => AGE_GROUPS.includes(r.basicInfo.ageGroup));

  if (responses.length === 0) {
    return <p className="text-sm text-gray-500">응답 데이터가 없습니다</p>;
  }

  return (
    <div className="space-y-4">
      {/* PDF 버튼 — ref 바깥 */}
      <div>
        <button
          onClick={downloadPdf}
          disabled={exporting}
          className="px-4 py-2 bg-[#2F5496] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {exporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
        </button>
      </div>

      {/* PDF 캡처 범위 — 전체 통계 */}
      <div ref={analyticsRef} className="space-y-4">
        {/* 전체 응답 요약 */}
        {totalUnits > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4 mb-3">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">응답 완료</p>
                <p className="text-2xl font-bold text-[#2F5496]">{totalResponded.toLocaleString()}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">전체 세대</p>
                <p className="text-2xl font-bold text-gray-600">{totalUnits.toLocaleString()}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">응답률</p>
                <p className="text-2xl font-bold text-green-600">{overallPct}%</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#2F5496] rounded-full transition-all" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        )}

        {/* 동별 응답 수 */}
        {(dongData.length > 0 || dongDistSorted.length > 0) && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">동별 응답 수</p>
            {dongData.length > 0 ? (
              dongData.map(({ dong, total, responded }) => {
                const pct = total > 0 ? Math.round((responded / total) * 100) : 0;
                return (
                  <div key={dong} className="flex items-center gap-2 mb-1.5">
                    <span className="w-14 text-xs text-gray-600 text-right shrink-0">{dong}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-[#2F5496] rounded transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right shrink-0">
                      {responded} / {total}세대
                    </span>
                  </div>
                );
              })
            ) : (
              (() => {
                const maxCount = Math.max(...dongDistSorted.map(([, c]) => c), 1);
                return dongDistSorted.map(([dong, count]) => (
                  <div key={dong} className="flex items-center gap-2 mb-1.5">
                    <span className="w-14 text-xs text-gray-600 text-right shrink-0">{dong}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-[#2F5496] rounded transition-all" style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right shrink-0">{count}</span>
                  </div>
                ));
              })()
            )}
          </div>
        )}

        {/* 문항별 응답 현황 — 누적 비율 막대 + 범례 */}
        {questionStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-5">
            <p className="font-semibold text-sm text-gray-700">문항별 응답 현황</p>
            {questionStats.map(({ question, counts }) => {
              const total = responses.length;
              return (
                <div key={question.id}>
                  <p className="text-xs font-medium text-gray-500 mb-2 leading-snug">{question.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {question.options.map((opt, i) => {
                      const count = counts[opt] || 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const color = OPTION_COLORS[i % OPTION_COLORS.length];
                      return (
                        <div
                          key={opt}
                          className="rounded-xl p-3 flex flex-col gap-0.5"
                          style={{ backgroundColor: color + '18' }}
                        >
                          <span className="text-xs text-gray-600 leading-snug">{opt}</span>
                          <span className="text-2xl font-bold leading-tight" style={{ color }}>{pct}%</span>
                          <span className="text-xs text-gray-400">{count}명</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!hasAgeData && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            연령대 정보가 없는 응답입니다. 연령대 항목이 포함된 응답이 있어야 교차 분석이 표시됩니다.
          </div>
        )}

        {/* 연령대 분포 — 세로 막대 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">연령대 분포</p>
          <div className="flex gap-2">
            {AGE_GROUPS.map((ag) => {
              const count = ageDistribution[ag] ?? 0;
              const pct = maxAge > 0 ? Math.round((count / maxAge) * 100) : 0;
              return (
                <div key={ag} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-medium">{count}</span>
                  <div
                    className="w-full bg-gray-100 rounded-sm flex flex-col justify-end"
                    style={{ height: '80px' }}
                  >
                    <div
                      className="w-full bg-[#2F5496] rounded-sm transition-all"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">
                    {ag.replace(' 이상', '+')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 연령대 × Q6 선호평형 */}
        {(() => {
          const q = config.questions.find((q) => q.id === 'Q6');
          if (!q) return null;
          const matrix = crossTabs['Q6'];
          return (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              {matrix && hasData(matrix) ? (
                <CrossTabChart title={`연령대 × ${q.label}`} rows={AGE_GROUPS} cols={q.options} data={matrix} />
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">연령대 × 선호평형 데이터 없음</p>
              )}
            </div>
          );
        })()}

        {/* 연령대 × Q1 재건축 필요성 */}
        {(() => {
          const q = config.questions.find((q) => q.id === 'Q1');
          if (!q) return null;
          const matrix = crossTabs['Q1'];
          return (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              {matrix && hasData(matrix) ? (
                <CrossTabChart title={`연령대 × ${q.label}`} rows={AGE_GROUPS} cols={q.options} data={matrix} />
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">연령대 × 재건축 필요성 데이터 없음</p>
              )}
            </div>
          );
        })()}

        {/* 연령대 × Q2 추진 방향 */}
        {(() => {
          const q = config.questions.find((q) => q.id === 'Q2');
          if (!q) return null;
          const matrix = crossTabs['Q2'];
          return (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              {matrix && hasData(matrix) ? (
                <CrossTabChart title={`연령대 × ${q.label}`} rows={AGE_GROUPS} cols={q.options} data={matrix} />
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">연령대 × 추진 방향 데이터 없음</p>
              )}
            </div>
          );
        })()}

        {/* 연령대 × Q3 인접 단지 인식 */}
        {(() => {
          const q = config.questions.find((q) => q.id === 'Q3');
          if (!q) return null;
          const matrix = crossTabs['Q3'];
          return (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              {matrix && hasData(matrix) ? (
                <CrossTabChart title={`연령대 × ${q.label}`} rows={AGE_GROUPS} cols={q.options} data={matrix} />
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">연령대 × 인접 단지 인식 데이터 없음</p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
