'use client';
import { useState, useEffect, useCallback } from 'react';
import { loadProject } from '@/lib/storage';
import { calculateProject } from '@/lib/calculator';
import { fmtMoney, fmtEok, fmtRatio, fmtBurden } from '@/lib/format';
import { ProjectData, CalculationResult } from '@/lib/types';

export default function SlidesPage() {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [slide, setSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const data = loadProject();
    setProject(data);
    setResult(calculateProject(data));
  }, []);

  const slides = project && result ? buildSlides(project, result) : [];
  const total = slides.length;

  const prev = useCallback(() => setSlide((s) => Math.max(0, s - 1)), []);
  const next = useCallback(() => setSlide((s) => Math.min(total - 1, s + 1)), [total]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  if (!project || !result || slides.length === 0) {
    return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  }

  const current = slides[slide];

  return (
    <div className={fullscreen ? 'fixed inset-0 bg-blue-950 z-50 flex flex-col' : 'space-y-4'}>
      {/* 컨트롤 바 */}
      <div className={`flex items-center justify-between px-4 py-2 ${fullscreen ? 'bg-blue-900' : 'bg-white border border-gray-200 rounded-xl'} print:hidden`}>
        <div className="flex items-center gap-3">
          <button onClick={prev} disabled={slide === 0} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">◀ 이전</button>
          <span className="text-sm font-mono text-gray-400">{slide + 1} / {total}</span>
          <button onClick={next} disabled={slide === total - 1} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">다음 ▶</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
            PDF 저장
          </button>
          <button onClick={() => setFullscreen((f) => !f)} className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
            {fullscreen ? '⊡ 일반' : '⊞ 전체화면'}
          </button>
        </div>
      </div>

      {/* 슬라이드 */}
      <div className={`${fullscreen ? 'flex-1 flex items-center justify-center p-8' : ''}`}>
        <div
          className={`bg-white rounded-2xl shadow-2xl overflow-hidden ${
            fullscreen ? 'w-full max-w-5xl aspect-video' : 'aspect-video'
          }`}
        >
          <SlideRenderer slide={current} project={project} result={result} />
        </div>
      </div>

      {/* 슬라이드 목록 (일반 모드) */}
      {!fullscreen && (
        <div className="flex gap-2 overflow-x-auto pb-2 print:hidden">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`flex-shrink-0 w-24 h-14 rounded-lg text-xs font-medium border-2 transition-all ${
                i === slide ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {i + 1}. {s.type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 슬라이드 타입 정의 ───────────────────────────

type Slide =
  | { type: '표지' }
  | { type: '사업개요' }
  | { type: '총수입' }
  | { type: '총지출' }
  | { type: '비례율' }
  | { type: '분담금표' }
  | { type: '절감방안' };

function buildSlides(project: ProjectData, result: CalculationResult): Slide[] {
  return [
    { type: '표지' },
    { type: '사업개요' },
    { type: '총수입' },
    { type: '총지출' },
    { type: '비례율' },
    { type: '분담금표' },
    { type: '절감방안' },
  ];
}

function SlideRenderer({ slide, project, result }: { slide: Slide; project: ProjectData; result: CalculationResult }) {
  const base = 'h-full flex flex-col';

  switch (slide.type) {
    case '표지':
      return (
        <div className={`${base} bg-gradient-to-br from-blue-900 to-blue-700 text-white items-center justify-center text-center p-12`}>
          <p className="text-blue-300 text-lg mb-4">재건축사업 추정분담금 안내</p>
          <h1 className="text-5xl font-bold mb-6">{project.name}</h1>
          <p className="text-blue-200 text-xl">{project.location}</p>
          <div className="mt-8 flex gap-8 text-sm text-blue-200">
            <span>{project.totalBuildings}개동</span>
            <span>{project.totalUnits.toLocaleString()}세대</span>
            <span>{project.completionYear}년 준공</span>
          </div>
          <p className="mt-12 text-blue-400 text-xs">※ 본 자료는 추정치로 향후 변동될 수 있습니다</p>
        </div>
      );

    case '사업개요':
      return (
        <div className={`${base} p-10`}>
          <SlideHeader num="01" title="추정분담금 전제조건" />
          <div className="flex-1 grid grid-cols-3 gap-6 mt-6">
            {[
              { label: '종전(기존)자산', desc: '실거래가 조사, 감정평가법인 의견 반영', color: 'bg-blue-50 border-blue-200' },
              { label: '총수입 추산액', desc: '일반분양가, 주변 시세 등을 종합 검토하여 추산', color: 'bg-green-50 border-green-200' },
              { label: '총지출 추산액', desc: `공사비 평당 ${project.expenses.constructionCostPerPyeong.toLocaleString()}만원 기준`, color: 'bg-orange-50 border-orange-200' },
            ].map((c) => (
              <div key={c.label} className={`border rounded-xl p-5 ${c.color}`}>
                <h3 className="font-bold text-gray-800 mb-2">{c.label}</h3>
                <p className="text-sm text-gray-600">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">※ 본 자료는 추정치이며, 향후 증감 변동이 발생할 수 있습니다.</p>
        </div>
      );

    case '총수입':
      return (
        <div className={`${base} p-10`}>
          <SlideHeader num="02" title="총수입 추산액" sub={fmtEok(result.totalRevenue)} />
          <div className="flex-1 mt-6 space-y-3">
            {[
              ['일반분양 수입', result.generalSalesRevenue],
              ['조합원분양 수입', result.memberSalesRevenue],
              ['임대주택 매각', result.rentalRevenue],
              ['상가 분양', result.commercialRevenue],
              ['이주비 이자 환입', result.financingReturnRevenue],
            ].map(([label, val]) => {
              const pct = result.totalRevenue > 0 ? ((val as number) / result.totalRevenue) * 100 : 0;
              return (
                <div key={label as string} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-gray-600">{label as string}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full flex items-center pl-3" style={{ width: `${Math.max(pct, 2)}%` }}>
                      <span className="text-white text-xs font-medium whitespace-nowrap">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <span className="w-28 text-right text-sm font-medium">{fmtMoney(val as number)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );

    case '총지출':
      return (
        <div className={`${base} p-10`}>
          <SlideHeader num="03" title="총지출 추산액" sub={fmtEok(result.totalExpense)} />
          <div className="flex-1 mt-6 space-y-3">
            {[
              ['건축 공사비', result.constructionCost],
              ['기타 지출', result.otherExpenseTotal],
            ].map(([label, val]) => {
              const pct = result.totalExpense > 0 ? ((val as number) / result.totalExpense) * 100 : 0;
              return (
                <div key={label as string} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-gray-600">{label as string}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-10 overflow-hidden">
                    <div className="bg-orange-500 h-full rounded-full flex items-center pl-3" style={{ width: `${Math.max(pct, 2)}%` }}>
                      <span className="text-white text-sm font-bold">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <span className="w-28 text-right text-sm font-medium">{fmtMoney(val as number)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4">※ 공사비가 총지출의 약 {result.totalExpense > 0 ? ((result.constructionCost / result.totalExpense) * 100).toFixed(0) : '-'}% 차지</p>
        </div>
      );

    case '비례율':
      return (
        <div className={`${base} items-center justify-center p-10 bg-gradient-to-b from-white to-blue-50`}>
          <SlideHeader num="04" title="비례율 산출" />
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-base mb-2">비례율 = (총수입 − 총지출) / 종전자산 총액</p>
            <p className="text-gray-400 text-sm mb-6">{fmtEok(result.totalRevenue)} − {fmtEok(result.totalExpense)} / {fmtEok(result.totalOriginalAsset)}</p>
            <div className="text-7xl font-bold text-blue-700 mb-4">{fmtRatio(result.ratio)}</div>
            <p className="text-gray-500 text-sm">비례율이 100% 초과 시 소형 평형은 환급 발생 가능</p>
          </div>
        </div>
      );

    case '분담금표':
      return (
        <div className={`${base} p-8`}>
          <SlideHeader num="05" title="조합원 추정분담금" />
          <div className="flex-1 overflow-auto mt-4">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="px-3 py-2 text-left">기존 평형</th>
                  <th className="px-3 py-2">권리가액</th>
                  {project.newUnits.map((u) => <th key={u.id} className="px-3 py-2">{u.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {project.originalUnits.map((orig, i) => {
                  const rights = result.memberRightsMap[orig.id] ?? 0;
                  return (
                    <tr key={orig.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium text-left">{orig.name}</td>
                      <td className="px-3 py-2 text-blue-700 font-medium">{fmtMoney(rights)}</td>
                      {project.newUnits.map((nu) => {
                        const b = result.burdenMap[orig.id]?.[nu.id] ?? 0;
                        const bf = fmtBurden(b);
                        return <td key={nu.id} className={`px-3 py-2 font-medium ${bf.color}`}>{fmtMoney(Math.abs(b))}{b < 0 ? ' ↩' : ''}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">↩ 환급 · 추정치, 향후 변동 가능</p>
          </div>
        </div>
      );

    case '절감방안':
      return (
        <div className={`${base} p-10`}>
          <SlideHeader num="06" title="조합원 분담금 절감 방안" />
          <div className="flex-1 grid grid-cols-2 gap-6 mt-6">
            {[
              { title: '수입 증가', color: 'bg-blue-900', items: ['일반분양가 상승 → 수입 증가', '우수 시공사 선정 → 브랜드 가치 상승', '용적률 인센티브 활용 → 세대수 증가'] },
              { title: '지출 절감', color: 'bg-orange-600', items: ['공사비 절감 (총지출의 약 85%)', '신속한 사업 추진 → 금융비용 절감', '단합된 사업 추진 → 분쟁 비용 최소화'] },
            ].map((c) => (
              <div key={c.title} className={`${c.color} text-white rounded-xl p-6`}>
                <h3 className="text-xl font-bold mb-4">{c.title}</h3>
                <ul className="space-y-2">
                  {c.items.map((item) => (
                    <li key={item} className="text-sm flex items-start gap-2">
                      <span>✓</span><span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return <div className="flex items-center justify-center h-full text-gray-400">슬라이드</div>;
  }
}

function SlideHeader({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="flex items-end gap-4">
      <span className="text-5xl font-bold text-blue-200">{num}</span>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {sub && <p className="text-2xl font-bold text-blue-700 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
