'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { applyFilter } from '@/lib/unified-utils';
import type { FilterType, UnifiedRow } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';

const LABELS_PER_PAGE = 16;

function LabelsContent() {
  const params = useSearchParams();
  const filter = (params.get('filter') ?? 'all') as FilterType;
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminFetch('/api/unified');
      const data = await res.json();
      setRows(data.rows);
      setSurveyIds(data.surveyIds);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => applyFilter(rows, filter, surveyIds),
    [rows, filter, surveyIds],
  );

  const pages = useMemo<(UnifiedRow | null)[][]>(() => {
    const result: (UnifiedRow | null)[][] = [];
    for (let i = 0; i < filtered.length; i += LABELS_PER_PAGE) {
      const page: (UnifiedRow | null)[] = filtered.slice(i, i + LABELS_PER_PAGE);
      while (page.length < LABELS_PER_PAGE) page.push(null);
      result.push(page);
    }
    return result;
  }, [filtered]);

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">불러오는 중...</div>;
  }
  if (filtered.length === 0) {
    return (
      <div className="p-8 text-sm text-gray-500">
        표시할 라벨이 없습니다. 필터를 확인해주세요. (현재 필터: {filter})
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-700">
          총 <strong>{filtered.length.toLocaleString()}</strong>개 라벨 ·{' '}
          <strong>{pages.length}</strong>장 인쇄 예정
          <span className="ml-2 text-xs text-gray-500">
            (필터: {filter} · 폼텍 LS-3105 호환 / 16칸 2열×8행 / 99.1×33.9mm)
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#2F5496] text-white rounded text-sm font-semibold hover:bg-[#1e3a6e]"
        >
          인쇄하기 (Ctrl+P / ⌘P)
        </button>
      </div>

      <div className="labels-root">
        {pages.map((pageRows, pi) => (
          <div key={pi} className="label-page">
            {pageRows.map((row, ci) => (
              <div key={ci} className="label-cell">
                {row ? (
                  <div className="label-content">
                    <div className="address">{row.address}</div>
                    <div className="name">
                      {row.ownerName ? `${row.ownerName} 귀하` : ''}
                    </div>
                    <div className="postal">{row.postalCode}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 12.9mm 5.9mm;
        }
        html, body {
          background: #f3f4f6;
        }
        .labels-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12mm;
          padding: 12mm 0;
        }
        .label-page {
          width: 198.2mm;
          height: 271.2mm;
          background: white;
          display: grid;
          grid-template-columns: 99.1mm 99.1mm;
          grid-template-rows: repeat(8, 33.9mm);
          gap: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          page-break-after: always;
          break-after: page;
        }
        .label-cell {
          width: 99.1mm;
          height: 33.9mm;
          padding: 3mm 4mm;
          box-sizing: border-box;
          overflow: hidden;
          border: 1px dashed #e5e7eb;
        }
        .label-content {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }
        .label-content .address {
          font-size: 10pt;
          line-height: 1.25;
          color: #111;
          word-break: keep-all;
          overflow: hidden;
        }
        .label-content .name {
          font-size: 11pt;
          font-weight: 700;
          color: #111;
          margin-top: 1mm;
        }
        .label-content .postal {
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #111;
        }
        @media print {
          html, body { background: white; }
          .labels-root { padding: 0; gap: 0; }
          .label-page {
            box-shadow: none;
            page-break-after: always;
            break-after: page;
          }
          .label-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .label-cell { border: none; }
        }
      `}</style>
    </>
  );
}

export default function LabelsPage() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-8 text-gray-400 text-sm">불러오는 중...</div>}>
        <LabelsContent />
      </Suspense>
    </AdminLayout>
  );
}
