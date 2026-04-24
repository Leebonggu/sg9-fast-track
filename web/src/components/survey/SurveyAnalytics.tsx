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

interface SurveyAnalyticsProps {
  config: SurveyConfigMeta;
  responses: SurveyResponse[];
}

const AGE_GROUPS = ['20대', '30대', '40대', '50대', '60대 이상'];
const CROSS_TAB_QUESTIONS = ['Q6', 'Q1', 'Q2', 'Q3'];

function hasData(matrix: number[][]): boolean {
  return matrix.some((row) => row.some((v) => v > 0));
}

export default function SurveyAnalytics({ config, responses }: SurveyAnalyticsProps) {
  const analyticsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { ageDistribution, crossTabs } = useMemo(() => {
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

      const matrix: number[][] = AGE_GROUPS.map(() =>
        new Array(question.options.length).fill(0)
      );

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

    return { ageDistribution: ageDist, crossTabs: crossTabsResult };
  }, [config.questions, responses]);

  const maxAge = Math.max(...Object.values(ageDistribution), 1);

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
    <div className="space-y-6">
      {!hasAgeData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          연령대 정보가 없는 응답입니다. 연령대 항목이 포함된 응답이 있어야 교차 분석이 표시됩니다.
        </div>
      )}
      <div>
        <button
          onClick={downloadPdf}
          disabled={exporting}
          className="px-4 py-2 bg-[#2F5496] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {exporting ? 'PDF 생성 중...' : 'PDF 다운로드'}
        </button>
      </div>

      <div ref={analyticsRef} className="space-y-6">
        {/* 연령대 분포 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">연령대 분포</p>
          {AGE_GROUPS.map((ag) => {
            const count = ageDistribution[ag] ?? 0;
            const pct = (count / maxAge) * 100;
            return (
              <div key={ag} className="flex items-center gap-2 mb-1.5">
                <span className="w-20 text-xs text-gray-600 text-right">{ag}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#2F5496] rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-14 text-right">{count}명</span>
              </div>
            );
          })}
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
