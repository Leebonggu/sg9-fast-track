'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { applyFilter, displayAgeGroup, isElectronicDone } from '@/lib/unified-utils';
import { splitContacts } from '@/lib/phone-format';
import type { FilterType, UnifiedRow } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';

// 설문 컬럼 머리글용 짧은 라벨: "2026_04_기본조사_제출_완료" → "기본조사"
const shortSurveyLabel = (id: string) =>
  id
    .replace(/^\d{4}_\d{2}_/, '')
    .replace(/_?제출_?/g, '')
    .replace(/_?완료$/, '')
    .replace(/_/g, ' ');

// 좁은 상태 컬럼에서 4글자 라벨이 "기본조"/"사"로 끊기면 읽기 나쁘다.
// 공백 없는 3~4글자는 가운데서 미리 쪼개 균형 있게 두 줄로 만든다.
function wrapLabel(s: string) {
  if (s.includes(' ') || s.length < 3 || s.length > 4) return s;
  const half = Math.ceil(s.length / 2);
  return (
    <>
      {s.slice(0, half)}
      <br />
      {s.slice(half)}
    </>
  );
}

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

// 종이(오프라인) 근거는 O(초록), 전자동의는 전(파랑), 둘 다면 O전을 겹쳐 찍는다.
// 개인정보·신분증은 전자동의 세대에서 실제로 받은 게 아니라 자동 인정된 것이라,
// 방문 현장에서 "서류가 없다"고 헷갈리지 않으려면 O와 구분돼야 한다.
//
// 종이 우선으로 O만 찍던 때는 근거가 두 개인 세대가 종이 한 개인 세대와 똑같아 보였다.
// 신통은 전자로 낸 474세대 중 394세대가 종이도 갖고 있어(라이브 실측) 그 사실이
// 통째로 O에 흡수돼, 인쇄물만 보면 신통에는 전자동의가 없는 것처럼 보였다.
//
// 판정 기준(무엇이 X가 아닌가)은 unified-utils의 hasXxx와 동일하다 — 표시만 갈라진다.
function mark(paper: boolean, elec: boolean) {
  if (!paper && !elec) return <span className="ox-x">X</span>;
  return (
    <>
      {paper && <span className="ox-o">O</span>}
      {elec && <span className="ox-e">전</span>}
    </>
  );
}

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

  // 제목 줄의 colSpan은 실제 컬럼 수와 정확히 맞아야 표가 어긋나지 않는다.
  // 컬럼: 번호·동·호수·성명·연령·연락처(6) + 실거주·신통(2) + 설문(n) + 입안·개인정보·신분증·방문(4)
  const leftSpan = 6;
  const totalCols = 12 + surveyIds.length;
  const rightSpan = totalCols - leftSpan;

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
            (A4 세로 · 동마다 새 장으로 인쇄됩니다 · 필터: {filter})
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
            <table className="list-table">
              {/* table-layout:fixed는 첫 행에서 폭을 가져가는데 첫 행이 colSpan 제목 줄이라
                  th에 준 width가 무시된다. 폭은 colgroup에서만 지정한다. */}
              <colgroup>
                <col className="c-no" />
                <col className="c-dong" />
                <col className="c-ho" />
                <col className="c-name" />
                <col className="c-age" />
                <col className="c-phone" />
                <col className="c-live" />
                <col className="c-stat" />
                {surveyIds.map((id) => (
                  <col key={id} className="c-stat" />
                ))}
                <col className="c-stat" />
                <col className="c-stat" />
                <col className="c-stat" />
                <col className="c-visit" />
              </colgroup>
              <thead>
                {/* 동 제목을 thead에 넣어 페이지가 넘어가도 매 장에 다시 찍히게 한다.
                    이어지는 장에 동 이름이 없으면 위원이 어느 동인지 몰라 '동이 빠졌다'고 오해한다. */}
                <tr className="sheet-title">
                  <th className="t-left" colSpan={leftSpan}>
                    {dong}동 <span className="sub">{TITLE_BY_FILTER[filter] ?? '미제출 세대 명단'}</span>
                  </th>
                  <th className="t-right" colSpan={rightSpan}>
                    <span className="count">{dongRows.length}세대</span>
                    <span className="date">{today}</span>
                    <span className="legend">O 종이 · 전 전자 · O전 둘다 · X 없음</span>
                  </th>
                </tr>
                <tr className="col-head">
                  <th className="c-no">번호</th>
                  <th className="c-dong">동</th>
                  <th className="c-ho">호수</th>
                  <th className="c-name">성명</th>
                  <th className="c-age">연령</th>
                  <th className="c-phone">연락처</th>
                  <th className="c-live">실거주</th>
                  <th className="c-stat">신통<br />동의서</th>
                  {surveyIds.map((id) => (
                    <th key={id} className="c-stat">
                      {wrapLabel(shortSurveyLabel(id))}
                    </th>
                  ))}
                  <th className="c-stat">입안<br />동의서</th>
                  <th className="c-stat">개인<br />정보</th>
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
                    <td className="c-name">
                      {/* 쉼표 뒤에 공백을 넣어 줄바꿈 지점을 만든다 — "박민수,박서연"처럼
                          붙어 있으면 좁은 칸에서 이름 한가운데가 끊긴다. */}
                      {r.ownerName.replace(/,\s*/g, ', ')}
                      {/* 공유 세대만 표시. 정비입안 동의서는 대표가 서명해야 유효하므로
                          방문 전에 대표가 누구인지(또는 아직 없는지) 알아야 한다.
                          명부에 소유자수가 없으면(sync 전) 판단할 근거가 없어 아무것도 안 띄운다. */}
                      {(r.coOwnerCount ?? 0) > 1 && (
                        <span className={`rep ${r.representative ? 'rep-set' : 'rep-none'}`}>
                          {r.representative
                            ? `대표 ${r.representative}`
                            : `대표 미선임 (공유 ${r.coOwnerCount}인)`}
                        </span>
                      )}
                    </td>
                    <td className="c-age">{displayAgeGroup(r) || '-'}</td>
                    <td className="c-phone">
                      {(() => {
                        const cs = splitContacts(r.phoneOverride || r.phone || '');
                        if (cs.length === 0) return '-';
                        // 이름과 번호를 각자 줄로 나눈다 — 한 줄에 그리면 셀을 넘쳐 글자가 겹친다
                        return cs.map((c, ci) => (
                          <span key={ci} className="contact">
                            {c.name && <span className="contact-name">{c.name}</span>}
                            <span className="contact-num">{c.number || '-'}</span>
                          </span>
                        ));
                      })()}
                    </td>
                    <td className="c-live">{r.residency || '-'}</td>
                    {/* 종이·전자 합산. 종이만 보면 전자로 이미 동의한 세대를 X로 찍어
                        방문 명단에 올리게 되고, 위원이 헛걸음한다. */}
                    <td className="c-stat">
                      {mark(r.consent, isElectronicDone(r.econsentSinto))}
                    </td>
                    {surveyIds.map((id) => (
                      <td
                        key={id}
                        className={`c-stat ${r.surveys[id] ? 'ox-o' : 'ox-x'}`}
                      >
                        {r.surveys[id] ? 'O' : 'X'}
                      </td>
                    ))}
                    {/* 방문해서 받아야 할 3종. 종이·전자 합산이라 전자로 낸 세대는 '전'으로 뜬다. */}
                    {(() => {
                      const elecAny =
                        isElectronicDone(r.econsentSinto) || isElectronicDone(r.econsentPlan);
                      const planPaper = Boolean(r.planConsent);
                      const privacyPaper = Boolean(r.privacyConsent);
                      const idPaper = Boolean(r.idReceived) || (r.idUploaded ?? 0) > 0;
                      const elecPlan = isElectronicDone(r.econsentPlan);
                      return (
                        <>
                          <td className="c-stat">{mark(planPaper, elecPlan)}</td>
                          <td className="c-stat">{mark(privacyPaper, elecAny)}</td>
                          <td className="c-stat">{mark(idPaper, elecAny)}</td>
                        </>
                      );
                    })()}
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
        /* 세로: 동 컬럼을 빼고 폰트를 줄여 본문 폭 210 - 12*2 = 186mm에 담는다.
           가로였을 땐 한 장에 5행밖에 안 들어가 699행이 130장이 됐다. */
        @page {
          size: A4 portrait;
          margin: 12mm;
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
        /* 화면 미리보기는 A4 한 장을 그대로 흉내낸다 — 210mm에 여백 12mm.
           내용 폭이 186mm로 인쇄와 정확히 같아진다.
           예전에 width:186mm + padding:9mm이라 화면에서만 내용 폭이 168mm였고,
           표(185mm)가 17mm 넘쳐 오른쪽이 잘려 보였다. 인쇄는 멀쩡한데 화면만 깨져서
           "인쇄하면 잘린다"는 신고로 이어졌다. 두 상태의 내용 폭은 반드시 같아야 한다. */
        .dong-section {
          width: 210mm;
          background: white;
          padding: 12mm;
          box-sizing: border-box;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .list-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .list-table th,
        .list-table td {
          border: 1.2px solid #cbd5e1;
          padding: 0.8mm 1.2mm;
          text-align: center;
        }
        .list-table thead th {
          background: #eef2f9;
          font-weight: 700;
          color: #1e293b;
        }
        /* 제목 줄 — 표 안에 있지만 표처럼 보이면 안 되므로 테두리·배경을 지운다.
           thead에 있어서 페이지가 넘어갈 때마다 컬럼 헤더와 함께 다시 찍힌다. */
        .list-table thead tr.sheet-title th.t-left,
        .list-table thead tr.sheet-title th.t-right {
          border: none;
          border-bottom: 2.5px solid #2f5496;
          background: white;
          padding: 0 0 2mm 0;
        }
        .list-table thead tr.sheet-title th.t-left {
          text-align: left;
          font-size: 18pt;
          font-weight: 800;
          color: #1e293b;
        }
        .list-table thead tr.sheet-title th.t-left .sub {
          font-size: 11pt;
          font-weight: 600;
          color: #475569;
          margin-left: 3mm;
        }
        .list-table thead tr.sheet-title th.t-right {
          text-align: right;
          font-size: 9pt;
          font-weight: 500;
          color: #475569;
        }
        .list-table thead tr.sheet-title th.t-right .count {
          font-weight: 700;
          color: #2f5496;
        }
        .list-table thead tr.sheet-title th.t-right span + span {
          margin-left: 3mm;
        }
        /* 범례는 세대수·날짜와 같은 줄에 두면 넘쳐서 "X 없/음"으로 접힌다.
           제 줄로 내리고 nowrap을 건다 — 표기 규칙이 반토막 나면 읽으나 마나다. */
        .list-table thead tr.sheet-title th.t-right .legend {
          display: block;
          margin-left: 0;
          margin-top: 1mm;
          font-size: 8pt;
          font-weight: 600;
          color: #64748b;
          white-space: nowrap;
        }
        /* 컬럼 머리글은 2줄짜리(신통/동의서)가 있어 좁은 폭에서도 안 깨지게 줄인다.
           padding-top은 제목 줄과 붙어 보이지 않게 하는 여백.
           word-break:keep-all은 쓰지 않는다 — 긴 라벨이 줄바꿈 대신 셀을 넘쳐 옆 칸과 겹친다.
           넘치느니 줄바꿈되는 게 낫다. */
        .list-table thead .col-head th {
          font-size: 7.5pt;
          line-height: 1.15;
          letter-spacing: -0.02em;
          padding-top: 2.5mm;
        }
        /* 본문은 9.5pt까지 줄였다(사용자 승인 — "동/호수만 잘 보이면 된다").
           행 높이를 실제로 지배하는 건 글씨 크기보다 line-height다. 기본값(한글 약 1.5)을
           1.15로 조이면 글씨를 안 줄여도 행마다 1.3mm가 빠진다. 둘을 같이 적용했다. */
        .list-table tbody td {
          font-size: 9.5pt;
          line-height: 1.15;
          color: #111;
        }
        .list-table td.c-name {
          font-size: 10pt;
          font-weight: 700;
          text-align: left;
          padding-left: 2.5mm;
          letter-spacing: 0.02em;
          /* 공유 세대는 "문애숙임, 문기성제이슨, 문인주"처럼 한 덩어리로 흘러서
             한글 사이 아무 데나 접혔다 — "문기성/제이슨"으로 이름 한가운데가 끊긴다.
             keep-all이면 쉼표 뒤 공백에서만 접혀 이름은 통째로 남는다.
             개별 이름은 6자 이하가 99.8%(3169/3175)라 한 줄에 들어간다.
             overflow-wrap: anywhere는 나머지 0.2%(법인명 "주식회사트리플바운더리" 등
             11자)를 위한 탈출구다 — 이게 없으면 keep-all이 셀을 넘쳐 옆 칸을 침범한다. */
          word-break: keep-all;
          overflow-wrap: anywhere;
        }
        /* 공유 세대의 대표자 — 소유자명 아래 작은 줄로 붙인다.
           미선임은 방문해서 처리해야 할 일이라 색으로 구분한다. */
        .list-table td.c-name .rep {
          display: block;
          margin-top: 0.8mm;
          font-size: 7.5pt;
          font-weight: 500;
          letter-spacing: 0;
        }
        .list-table td.c-name .rep-set {
          color: #475569;
        }
        .list-table td.c-name .rep-none {
          color: #b45309;
        }
        .list-table td.c-stat {
          font-size: 11pt;
        }
        /* 실거주는 O/X가 아니라 "실거주"(3글자)라 다른 상태 컬럼보다 폭·글씨를 따로 잡는다.
           9pt로 줄여도 13mm에선 "실거"/"주"로 깨져서, 폭을 넓히고 글씨도 따로 잡는다.
           동 컬럼을 넣으면서 15mm/9.5pt로 조정. */
        .list-table th.c-live,
        .list-table td.c-live {
          font-size: 9.5pt;
        }
        .list-table .ox-o {
          color: #15803d;
          font-weight: 700;
        }
        /* 전자동의 — 초록 O(종이 있음)·빨강 X(없음)와 한눈에 갈라져야 한다 */
        .list-table .ox-e {
          color: #1d4ed8;
          font-weight: 700;
        }
        /* 종이·전자 둘 다인 세대는 "O전"이 한 칸에 같이 들어간다.
           붙여 쓰면 한 낱말처럼 읽혀서 아주 좁은 간격을 준다. */
        .list-table .ox-o + .ox-e {
          margin-left: 0.4mm;
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
        .list-table th.c-age, .list-table td.c-age,
        .list-table th.c-live, .list-table td.c-live,
        .list-table th.c-stat, .list-table td.c-stat,
        .list-table th.c-visit, .list-table td.c-visit {
          padding-left: 0.8mm;
          padding-right: 0.8mm;
        }
        /* 컬럼 폭은 여기(col)에서만 정한다. th/td에 width를 주면 table-layout:fixed가
           첫 행에서만 폭을 읽는데 첫 행이 colSpan 제목 줄이라 통째로 무시된다.
           185mm 배분 (A4 세로 본문 폭 186mm - 여유 1mm):
           번호 8 + 동 10 + 호수 11 + 성명 36 + 연령 10 + 연락처 35 + 실거주 15
           + 상태 10 x 5(신통·설문1·입안·개인정보·신분증) 50 + 방문 10 = 185mm.
           1mm를 비워두는 이유: 합계를 186mm에 꽉 채우면 border-collapse의 바깥 테두리가
           col 폭 밖으로 나가 표 실제 폭이 186.3mm가 된다(실측). 오른쪽 테두리가 인쇄
           영역을 넘는다. 1mm를 남기면 fixed 레이아웃이 그 여유로 테두리를 흡수해
           표 실제 폭이 정확히 186.0mm가 된다 — verify-print로 잰 값이다.
           ⚠ 컬럼이 늘면 이 합계를 다시 맞춰야 한다. 특히 설문 컬럼이 2개 이상이 되면
           10mm씩 초과하므로 c-name / c-phone에서 그만큼 폭을 떼어와야 한다. */
        .list-table col.c-no {
          width: 8mm; /* 최대 3자리(가장 큰 동이 210세대) */
        }
        .list-table col.c-dong {
          width: 10mm; /* 901~923 — 3자리 고정 */
        }
        .list-table col.c-ho {
          width: 11mm; /* 최대 4자리(1408) */
        }
        .list-table col.c-name {
          width: 36mm;
        }
        .list-table col.c-age {
          width: 10mm;
        }
        .list-table col.c-phone {
          width: 35mm;
        }
        .list-table col.c-live {
          width: 15mm; /* "실거주" 3글자가 한 줄에 들어가야 한다 */
        }
        .list-table col.c-stat {
          /* 폭을 정하는 건 본문이 아니라 머리글이다. 본문 최대는 "O전"(11pt, 약 6.4mm),
             머리글 최대는 "동의서" 3자 x 7.5pt = 7.9mm + 좌우 패딩 1.6mm = 9.5mm.
             12 → 10mm로 5개에서 10mm를 회수해 성명·연락처에 줬다(실측 확인). */
          width: 10mm;
        }
        .list-table col.c-visit {
          width: 10mm;
        }
        /* 동·호수는 본문을 줄여도 크게 남긴다 — 방문 명단에서 세대를 찾는 기준이라
           이것만 잘 보이면 나머지는 작아도 된다는 게 위원 요구였다. */
        .list-table td.c-dong,
        .list-table td.c-ho {
          font-size: 11pt;
          font-weight: 700;
        }
        /* .list-table tbody td(11pt)보다 구체적으로 써야 실제로 적용된다 */
        .list-table td.c-age {
          font-size: 9.5pt;
          color: #334155;
        }
        /* 연락처는 "나영선 010-2150-9054"처럼 이름이 병기된 경우가 99%다(실측 1,201/1,208).
           한 줄에 다 그리면 셀을 넘쳐 글자가 겹치므로 이름을 윗줄로 내리고,
           번호에만 nowrap을 걸어 통째로 보이게 한다. 방문 전에 걸어야 하는 정보다. */
        .c-phone .contact {
          display: block;
        }
        .c-phone .contact + .contact {
          margin-top: 1.2mm;
        }
        .c-phone .contact-name {
          display: block;
          font-size: 7pt;
          line-height: 1.15;
          color: #64748b;
        }
        .c-phone .contact-num {
          display: block;
          font-size: 9.5pt;
          white-space: nowrap;
          letter-spacing: -0.02em;
        }
        .list-table .checkbox {
          display: inline-block;
          width: 5mm;
          height: 5mm;
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
