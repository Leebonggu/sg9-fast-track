'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  applyFilter, displayAgeGroup,
  hasSintoConsent, hasPlanConsent, hasPrivacyConsent, hasIdVerified,
} from '@/lib/unified-utils';
import type { FilterType, UnifiedRow } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';

// 설문 컬럼 머리글용 짧은 라벨: "2026_04_기본조사_제출_완료" → "기본조사"
const shortSurveyLabel = (id: string) =>
  id
    .replace(/^\d{4}_\d{2}_/, '')
    .replace(/_?제출_?/g, '')
    .replace(/_?완료$/, '')
    .replace(/_/g, ' ');

// 인쇄물은 위원끼리 돌려보는 종이라 무슨 명단인지 제목에 드러나야 한다.
// 등록되지 않은 필터는 기존 문구를 그대로 쓴다.
const TITLE_BY_FILTER: Record<string, string> = {
  'plan-docs-pending': '정비입안 3종 수거 명단',
  'no-sinto-any': '신속통합 미동의 세대 명단',
  'no-plan-any': '정비입안 미동의 세대 명단',
  'no-representative': '공유 대표 미선임 명단',
  'econsent-partial': '공유자 일부만 서명한 세대',
  'roster-name-mismatch': '소유권 이전 의심 세대',
};

// 동(숫자) → 호수(숫자) 오름차순
function sortRows(rows: UnifiedRow[]): UnifiedRow[] {
  return [...rows].sort((a, b) => {
    const d = a.dong.localeCompare(b.dong, undefined, { numeric: true });
    if (d !== 0) return d;
    return a.ho.localeCompare(b.ho, undefined, { numeric: true });
  });
}

function PrintContent() {
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

  // 동별 그룹 (동 오름차순)
  const groups = useMemo(() => {
    const byDong = new Map<string, UnifiedRow[]>();
    for (const r of sortRows(filtered)) {
      const list = byDong.get(r.dong);
      if (list) list.push(r);
      else byDong.set(r.dong, [r]);
    }
    return Array.from(byDong.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true }),
    );
  }, [filtered]);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">불러오는 중...</div>;
  }
  if (filtered.length === 0) {
    return (
      <div className="p-8 text-sm text-gray-500">
        표시할 세대가 없습니다. 필터를 확인해주세요. (현재 필터: {filter})
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-700">
          총 <strong>{filtered.length.toLocaleString()}</strong>세대 ·{' '}
          <strong>{groups.length}</strong>개 동
          <span className="ml-2 text-xs text-gray-500">
            (동마다 새 장으로 인쇄됩니다 · 필터: {filter})
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#2F5496] text-white rounded text-sm font-semibold hover:bg-[#1e3a6e]"
        >
          인쇄 / PDF 저장 (Ctrl+P · ⌘P)
        </button>
      </div>

      <div className="print-root">
        {groups.map(([dong, dongRows]) => (
          <section key={dong} className="dong-section">
            <header className="dong-head">
              <h2>
                {dong}동 <span className="sub">{TITLE_BY_FILTER[filter] ?? '미제출 세대 명단'}</span>
              </h2>
              <div className="meta">
                <span className="count">{dongRows.length}세대</span>
                <span className="date">{today}</span>
              </div>
            </header>
            <table className="list-table">
              <thead>
                <tr>
                  <th className="c-no">번호</th>
                  <th className="c-dong">동</th>
                  <th className="c-ho">호수</th>
                  <th className="c-name">성명</th>
                  <th className="c-age">연령대</th>
                  <th className="c-phone">연락처</th>
                  <th className="c-stat">실거주</th>
                  <th className="c-stat">신통기획<br />동의서</th>
                  {surveyIds.map((id) => (
                    <th key={id} className="c-stat">
                      {shortSurveyLabel(id)}
                    </th>
                  ))}
                  <th className="c-stat">정비입안<br />동의서</th>
                  <th className="c-stat">개인정보<br />동의</th>
                  <th className="c-stat">신분증</th>
                  <th className="c-visit">방문</th>
                </tr>
              </thead>
              <tbody>
                {dongRows.map((r, i) => (
                  <tr key={`${r.dong}-${r.ho}-${i}`}>
                    <td className="c-no">{i + 1}</td>
                    <td className="c-dong">{r.dong}</td>
                    <td className="c-ho">{r.ho}</td>
                    <td className="c-name">{r.ownerName}</td>
                    <td className="c-age">{displayAgeGroup(r) || '-'}</td>
                    <td className="c-phone">{r.phoneOverride || r.phone || '-'}</td>
                    <td className="c-stat">{r.residency || '-'}</td>
                    {/* 종이·전자 합산. 종이만 보면 전자로 이미 동의한 세대를 X로 찍어
                        방문 명단에 올리게 되고, 위원이 헛걸음한다. */}
                    <td className={`c-stat ${hasSintoConsent(r) ? 'ox-o' : 'ox-x'}`}>
                      {hasSintoConsent(r) ? (r.consent ? 'O' : '전자') : 'X'}
                    </td>
                    {surveyIds.map((id) => (
                      <td
                        key={id}
                        className={`c-stat ${r.surveys[id] ? 'ox-o' : 'ox-x'}`}
                      >
                        {r.surveys[id] ? 'O' : 'X'}
                      </td>
                    ))}
                    {/* 방문해서 받아야 할 3종. 종이·전자 합산이라 전자로 낸 세대는 O로 뜬다. */}
                    <td className={`c-stat ${hasPlanConsent(r) ? 'ox-o' : 'ox-x'}`}>
                      {hasPlanConsent(r) ? 'O' : 'X'}
                    </td>
                    <td className={`c-stat ${hasPrivacyConsent(r) ? 'ox-o' : 'ox-x'}`}>
                      {hasPrivacyConsent(r) ? 'O' : 'X'}
                    </td>
                    <td className={`c-stat ${hasIdVerified(r) ? 'ox-o' : 'ox-x'}`}>
                      {hasIdVerified(r) ? 'O' : 'X'}
                    </td>
                    <td className="c-visit">
                      <span className="checkbox" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <style jsx global>{`
        /* 가로: 컬럼이 13개(정비입안 3종 추가)라 세로 186mm로는 글씨를 키운 채 담기지 않는다.
           본문 폭 297 - 24 = 273mm. 이 페이지는 ?filter=로 모든 명단이 공용이라 기존 명단도 가로가 된다. */
        @page {
          size: A4 landscape;
          margin: 14mm 12mm;
        }
        html,
        body {
          background: #f3f4f6;
        }
        .print-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10mm;
          padding: 10mm 0;
        }
        .dong-section {
          width: 273mm;
          background: white;
          padding: 10mm 9mm;
          box-sizing: border-box;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .dong-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          border-bottom: 2.5px solid #2f5496;
          padding-bottom: 3mm;
          margin-bottom: 5mm;
        }
        .dong-head h2 {
          font-size: 24pt;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
        }
        .dong-head h2 .sub {
          font-size: 15pt;
          font-weight: 600;
          color: #475569;
          margin-left: 4mm;
        }
        .dong-head .meta {
          text-align: right;
          font-size: 12pt;
          color: #475569;
        }
        .dong-head .meta .count {
          font-weight: 700;
          color: #2f5496;
          margin-right: 4mm;
        }
        .list-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .list-table th,
        .list-table td {
          border: 1.2px solid #cbd5e1;
          padding: 3.2mm 3mm;
          text-align: center;
        }
        .list-table thead th {
          background: #eef2f9;
          font-size: 14pt;
          font-weight: 700;
          color: #1e293b;
        }
        .list-table tbody td {
          font-size: 16pt;
          color: #111;
        }
        .list-table td.c-name {
          font-weight: 700;
          text-align: left;
          padding-left: 5mm;
          letter-spacing: 0.02em;
        }
        .list-table td.c-stat {
          font-size: 14pt;
        }
        .list-table .ox-o {
          color: #15803d;
          font-weight: 700;
        }
        .list-table .ox-x {
          color: #b91c1c;
          font-weight: 700;
        }
        /* 숫자·짧은 값 컬럼은 좌우 패딩부터 줄여 실제 내용 폭을 확보한다.
           기본 padding(3.2mm 3mm)이 좌우 6mm를 먹어서, 10mm 컬럼에 4mm만 남은 것이
           번호가 잘리던 원인이었다. 폭만 키우면 컬럼이 하나 더 늘 때 같은 사고가 반복된다. */
        .list-table th.c-no, .list-table td.c-no,
        .list-table th.c-dong, .list-table td.c-dong,
        .list-table th.c-ho, .list-table td.c-ho,
        .list-table th.c-age, .list-table td.c-age {
          padding-left: 1.2mm;
          padding-right: 1.2mm;
        }
        /* 273mm 배분: 고정 227mm + 성명 46mm. 괄호 안은 패딩을 뺀 실제 내용 폭. */
        .c-no {
          width: 14mm; /* 11.6mm — 3자리 여유 */
        }
        .c-dong {
          width: 14mm; /* 11.6mm */
          font-weight: 700;
        }
        .c-ho {
          width: 17mm; /* 14.6mm */
          font-weight: 700;
        }
        .c-stat {
          width: 20mm;
        }
        .c-age {
          width: 16mm; /* 13.6mm */
          font-size: 13pt;
          color: #334155;
        }
        /* 방문 전에 전화를 걸 수 있게 통째로 보이도록 줄바꿈을 막는다 */
        .c-phone {
          width: 34mm; /* 28mm — "010-1234-5678"이 12.5pt로 한 줄에 들어간다 */
          font-size: 12.5pt;
          white-space: nowrap;
          letter-spacing: -0.01em;
        }
        .c-visit {
          width: 16mm;
        }
        .list-table .checkbox {
          display: inline-block;
          width: 7mm;
          height: 7mm;
          border: 1.6px solid #475569;
          border-radius: 1mm;
        }
        thead {
          display: table-header-group;
        }
        tr {
          break-inside: avoid;
        }
        .dong-section {
          break-before: page;
        }
        .dong-section:first-child {
          break-before: avoid;
        }
        @media print {
          html,
          body {
            background: white;
          }
          .print-root {
            padding: 0;
            gap: 0;
          }
          .dong-section {
            width: 100%;
            padding: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </>
  );
}

export default function PrintPage() {
  return (
    <AdminLayout>
      <Suspense
        fallback={<div className="p-8 text-gray-400 text-sm">불러오는 중...</div>}
      >
        <PrintContent />
      </Suspense>
    </AdminLayout>
  );
}
