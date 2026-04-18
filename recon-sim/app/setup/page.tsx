'use client';
import { useState, useEffect, useMemo } from 'react';
import { loadProject, saveProject, clearProject } from '@/lib/storage';
import { calculateProject } from '@/lib/calculator';
import { fmtRatio, fmtMoney, fmtBurden } from '@/lib/format';
import { ProjectData, OriginalUnit, NewUnit } from '@/lib/types';
import { SG9_DEFAULT } from '@/lib/defaults';

type Tab = 'original' | 'new' | 'expense' | 'excess';
type Mode = 'simple' | 'advanced';

function genId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function SetupPage() {
  const [data, setData] = useState<ProjectData>(SG9_DEFAULT);
  const [mode, setMode] = useState<Mode>('simple');
  const [tab, setTab] = useState<Tab>('original');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setData(loadProject()); }, []);

  const save = () => {
    saveProject(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    if (confirm('상계주공9단지 기본값으로 초기화하시겠습니까?')) {
      setData(SG9_DEFAULT);
      clearProject();
    }
  };

  const set = <K extends keyof ProjectData>(key: K, val: ProjectData[K]) =>
    setData((d) => ({ ...d, [key]: val }));

  const setExp = <K extends keyof ProjectData['expenses']>(key: K, val: number) =>
    setData((d) => ({ ...d, expenses: { ...d.expenses, [key]: val } }));

  const setEP = <K extends keyof ProjectData['excessProfit']>(key: K, val: ProjectData['excessProfit'][K]) =>
    setData((d) => ({ ...d, excessProfit: { ...d.excessProfit, [key]: val } }));

  const result = useMemo(() => calculateProject(data), [data]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'original', label: '종전자산' },
    { key: 'new', label: '신축 계획' },
    { key: 'expense', label: '지출 항목' },
    { key: 'excess', label: '초과이익 환수' },
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">데이터 설정</h1>
          <p className="text-gray-700 text-sm mt-0.5">입력 후 반드시 저장하세요</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 모드 토글 */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setMode('simple')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              간단 모드
            </button>
            <button
              onClick={() => setMode('advanced')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                mode === 'advanced' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              상세 모드
            </button>
          </div>
          <button onClick={reset} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
            초기화
          </button>
          <button
            onClick={save}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saved ? '저장됨 ✓' : '저장'}
          </button>
        </div>
      </div>

      {/* 단지 메타정보 — 항상 표시 */}
      <MetaSection data={data} set={set} />

      {mode === 'simple' ? (
        <SimpleMode data={data} setData={setData} result={result} />
      ) : (
        <AdvancedMode
          data={data}
          tab={tab}
          setTab={setTab}
          set={set}
          setExp={setExp}
          setEP={setEP}
          result={result}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// 간단 모드
// ══════════════════════════════════════════════

function SimpleMode({
  data,
  setData,
  result,
}: {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  result: ReturnType<typeof calculateProject>;
}) {
  // 총 연면적 자동계산 — 지상연면적(대지면적 × 용적률 / 100 / 3.3058)을
  // 지하 비율로 보정해 전체 연면적(지상+지하) 반환
  const autoCalcArea = () => {
    if (data.landAreaSqm > 0 && data.plannedFAR > 0) {
      const aboveGround = (data.landAreaSqm * data.plannedFAR) / 100 / 3.3058;
      const undergroundRatio = data.expenses.undergroundAreaRatio ?? 0.4;
      const total = Math.round(aboveGround / (1 - undergroundRatio));
      setData({ ...data, expenses: { ...data.expenses, totalFloorAreaPyeong: total } });
    }
  };

  // 조합원 수 = 기존 평형별 세대수 기준 자동 배분
  const autoFillMemberCount = (unitId: string) => {
    const origTotal = data.originalUnits.reduce((s, u) => s + u.count, 0);
    if (origTotal === 0) return;
    setData({
      ...data,
      newUnits: data.newUnits.map((u) =>
        u.id === unitId
          ? { ...u, memberCount: origTotal }
          : u
      ),
    });
  };

  const updOrig = (id: string, key: keyof OriginalUnit, val: number | string) =>
    setData({ ...data, originalUnits: data.originalUnits.map((u) => u.id === id ? { ...u, [key]: val } : u) });

  const updNew = (id: string, key: keyof NewUnit, val: number | string) =>
    setData({ ...data, newUnits: data.newUnits.map((u) => u.id === id ? { ...u, [key]: val } : u) });

  const addOrig = () => setData({
    ...data,
    originalUnits: [...data.originalUnits, { id: genId(), name: '', pyeong: 0, count: 0, valuePerUnit: 0 }],
  });

  const addNew = () => setData({
    ...data,
    newUnits: [...data.newUnits, {
      id: genId(), name: '', sqm: 0, pyeong: 0,
      memberCount: 0, generalCount: 0, rentalCount: 0,
      generalPricePerPyeong: 3500, memberRatio: 0.9, rentalSalePricePerUnit: 0,
    }],
  });

  const totalOrigCount = data.originalUnits.reduce((s, u) => s + u.count, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 입력 영역 */}
      <div className="lg:col-span-2 space-y-5">

        {/* 섹션 1: 기존 아파트 */}
        <Section title="① 기존 아파트" desc="평형별 세대수와 현재 시세를 입력하세요">
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-1 text-xs font-medium text-gray-500 px-1">
              <span className="col-span-3">평형명</span>
              <span className="col-span-3 text-right">세대수</span>
              <span className="col-span-5 text-right">현재 시세 (만원/세대)</span>
              <span className="col-span-1"></span>
            </div>
            {data.originalUnits.map((u) => (
              <div key={u.id} className="grid grid-cols-12 gap-1 items-center">
                <input
                  className="col-span-3 border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
                  value={u.name} onChange={(e) => updOrig(u.id, 'name', e.target.value)}
                  placeholder="13평형"
                />
                <input
                  type="number"
                  className="col-span-3 border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
                  value={u.count || ''} onChange={(e) => updOrig(u.id, 'count', Number(e.target.value))}
                  placeholder="0"
                />
                <input
                  type="number"
                  className="col-span-5 border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
                  value={u.valuePerUnit ? u.valuePerUnit / 10 : ''}
                  onChange={(e) => updOrig(u.id, 'valuePerUnit', Number(e.target.value) * 10)}
                  placeholder="예: 40000 = 4억"
                />
                <button onClick={() => setData({ ...data, originalUnits: data.originalUnits.filter((x) => x.id !== u.id) })}
                  className="col-span-1 text-red-400 hover:text-red-600 text-xs text-center">✕</button>
              </div>
            ))}
            <button onClick={addOrig} className="text-blue-600 text-sm hover:underline mt-1">+ 평형 추가</button>
            {totalOrigCount > 0 && (
              <p className="text-xs text-gray-400">총 {totalOrigCount.toLocaleString()}세대</p>
            )}
          </div>
        </Section>

        {/* 섹션 2: 신축 계획 */}
        <Section title="② 신축 계획" desc="평형별 세대수와 예상 분양가를 입력하세요">
          <div className="space-y-3">
            {data.newUnits.map((u) => (
              <div key={u.id} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
                    value={u.name} onChange={(e) => updNew(u.id, 'name', e.target.value)}
                    placeholder="25평형(59㎡)"
                  />
                  <button onClick={() => setData({ ...data, newUnits: data.newUnits.filter((x) => x.id !== u.id) })}
                    className="text-red-400 hover:text-red-600 text-xs">✕ 삭제</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">
                    평형 (평)
                    <input type="number"
                      className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900 bg-white"
                      value={u.pyeong || ''} onChange={(e) => updNew(u.id, 'pyeong', Number(e.target.value))} />
                  </label>
                  <label className="text-xs text-gray-500">
                    일반분양가 (만원/평)
                    <input type="number"
                      className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900 bg-white"
                      value={u.generalPricePerPyeong || ''} onChange={(e) => updNew(u.id, 'generalPricePerPyeong', Number(e.target.value))}
                      placeholder="3500" />
                  </label>
                  <label className="text-xs text-gray-500">
                    조합원 세대수
                    <div className="flex gap-1 mt-0.5">
                      <input type="number"
                        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900 bg-white"
                        value={u.memberCount || ''} onChange={(e) => updNew(u.id, 'memberCount', Number(e.target.value))} />
                      <button onClick={() => autoFillMemberCount(u.id)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 whitespace-nowrap">
                        자동
                      </button>
                    </div>
                  </label>
                  <label className="text-xs text-gray-500">
                    일반분양 세대수
                    <input type="number"
                      className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900 bg-white"
                      value={u.generalCount || ''} onChange={(e) => updNew(u.id, 'generalCount', Number(e.target.value))} />
                  </label>
                </div>
              </div>
            ))}
            <button onClick={addNew} className="text-blue-600 text-sm hover:underline">+ 평형 추가</button>
          </div>
        </Section>

        {/* 섹션 2-1: 상가 (단지에 상가동이 있는 경우) */}
        <Section title="③ 상가 (선택)" desc="상가동이 있으면 입력하세요. 없으면 0">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              종전 상가 자산 (천원)
              <input type="number"
                className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900 bg-white"
                value={data.commercialValue || ''}
                onChange={(e) => setData({ ...data, commercialValue: Number(e.target.value) })}
                placeholder="0" />
            </label>
            <label className="text-xs text-gray-500">
              신축 상가 분양 수입 (천원)
              <input type="number"
                className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900 bg-white"
                value={data.newCommercialRevenue || ''}
                onChange={(e) => setData({ ...data, newCommercialRevenue: Number(e.target.value) })}
                placeholder="0" />
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-2">상가 자산은 비례율 분모에, 분양 수입은 분자에 합산됩니다.</p>
        </Section>

        {/* 섹션 4: 공사비 */}
        <Section title="④ 공사비" desc="건축 공사비 관련 핵심 항목만 입력하세요">
          <div className="grid grid-cols-1 gap-3">
            <label className="text-xs text-gray-500">
              평당 공사비 (만원/평)
              <p className="text-gray-400 mb-1">신탁방식 770, 조합방식 800</p>
              <input type="number"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right text-gray-900"
                value={data.expenses.constructionCostPerPyeong || ''}
                onChange={(e) => setData({ ...data, expenses: { ...data.expenses, constructionCostPerPyeong: Number(e.target.value) } })} />
            </label>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">총 연면적 (평)</label>
              <div className="flex gap-2">
                <input type="number"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-right text-gray-900"
                  value={data.expenses.totalFloorAreaPyeong || ''}
                  onChange={(e) => setData({ ...data, expenses: { ...data.expenses, totalFloorAreaPyeong: Number(e.target.value) } })} />
                <button onClick={autoCalcArea}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 whitespace-nowrap">
                  자동계산
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">대지면적 (m²)</p>
                  <input type="number"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
                    value={data.landAreaSqm || ''}
                    onChange={(e) => setData({ ...data, landAreaSqm: Number(e.target.value) })}
                    placeholder="0" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">계획 용적률 (%)</p>
                  <input type="number"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
                    value={data.plannedFAR || ''}
                    onChange={(e) => setData({ ...data, plannedFAR: Number(e.target.value) })}
                    placeholder="300" />
                </div>
              </div>
              <p className="text-xs text-gray-400">자동계산 = 지상연면적(대지×용적률÷3.3) ÷ (1−지하비율) → 전체 연면적(지상+지하)</p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-gray-500">지하 연면적 비율 (0~1)</span>
              <input type="number" step="0.05" min="0" max="1"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right text-gray-900"
                value={data.expenses.undergroundAreaRatio ?? 0.4}
                onChange={(e) => setData({ ...data, expenses: { ...data.expenses, undergroundAreaRatio: Number(e.target.value) } })} />
              <p className="text-xs text-gray-400">통상 0.4 (주차장·기계실). 용적률 시나리오에서 지하는 고정으로 처리됩니다.</p>
            </label>
          </div>
        </Section>
      </div>

      {/* 실시간 결과 패널 */}
      <div className="lg:col-span-1">
        <div className="sticky top-20 space-y-4">
          <div className="bg-blue-900 text-white rounded-xl p-5">
            <h3 className="text-sm font-bold mb-4">실시간 계산 결과</h3>
            <div className="space-y-3">
              <ResultRow label="종전자산 총액" value={fmtMoney(result.totalOriginalAsset)} />
              <ResultRow label="총수입 추산" value={fmtMoney(result.totalRevenue)} />
              <ResultRow label="총지출 추산" value={fmtMoney(result.totalExpense)} />
              <div className="border-t border-blue-700 pt-3">
                <p className="text-xs text-blue-300">비례율</p>
                <p className="text-3xl font-bold text-yellow-300">{fmtRatio(result.ratio)}</p>
              </div>
            </div>
          </div>

          {/* 분담금 미리보기 */}
          {result.totalOriginalAsset > 0 && data.originalUnits.length > 0 && data.newUnits.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">분담금 미리보기</h3>
              <div className="space-y-2">
                {data.originalUnits.slice(0, 4).map((orig) => (
                  <div key={orig.id}>
                    <p className="text-xs font-medium text-gray-600 mb-1">{orig.name || '(평형명 미입력)'}</p>
                    {data.newUnits.slice(0, 3).map((nu) => {
                      const b = result.burdenMap[orig.id]?.[nu.id] ?? 0;
                      const bf = fmtBurden(b);
                      return (
                        <div key={nu.id} className="flex justify-between text-xs pl-2">
                          <span className="text-gray-400">→ {nu.name || '?'}</span>
                          <span className={`font-medium ${bf.color}`}>{fmtMoney(Math.abs(b))}{b < 0 ? ' ↩' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">↩ 환급 · 상세 지출 미입력 시 실제보다 낮게 계산됨</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            정확한 계산이 필요하면<br />상세 모드에서 지출 항목을 추가 입력하세요
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 상세 모드
// ══════════════════════════════════════════════

function AdvancedMode({
  data, tab, setTab, set, setExp, setEP, result,
}: {
  data: ProjectData;
  tab: Tab;
  setTab: (t: Tab) => void;
  set: <K extends keyof ProjectData>(k: K, v: ProjectData[K]) => void;
  setExp: <K extends keyof ProjectData['expenses']>(k: K, v: number) => void;
  setEP: <K extends keyof ProjectData['excessProfit']>(k: K, v: ProjectData['excessProfit'][K]) => void;
  result: ReturnType<typeof calculateProject>;
}) {
  const setData = (d: ProjectData) => {
    Object.keys(d).forEach((k) => {
      const key = k as keyof ProjectData;
      set(key, d[key] as ProjectData[typeof key]);
    });
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'original', label: '종전자산' },
    { key: 'new', label: '신축 계획' },
    { key: 'expense', label: '지출 항목' },
    { key: 'excess', label: '초과이익 환수' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-200 mb-5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {tab === 'original' && <OriginalTab data={data} setData={setData} set={set} />}
          {tab === 'new' && <NewUnitTab data={data} setData={setData} set={set} />}
          {tab === 'expense' && <ExpenseTab data={data} setExp={setExp} />}
          {tab === 'excess' && <ExcessTab data={data} setEP={setEP} />}
        </div>
      </div>

      {/* 실시간 결과 */}
      <div className="lg:col-span-1">
        <div className="sticky top-20 bg-blue-900 text-white rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4">실시간 계산 결과</h3>
          <div className="space-y-3">
            <ResultRow label="종전자산 총액" value={fmtMoney(result.totalOriginalAsset)} />
            <ResultRow label="총수입 추산" value={fmtMoney(result.totalRevenue)} />
            <ResultRow label="총지출 추산" value={fmtMoney(result.totalExpense)} />
            <div className="border-t border-blue-700 pt-3">
              <p className="text-xs text-blue-300">비례율</p>
              <p className="text-3xl font-bold text-yellow-300">{fmtRatio(result.ratio)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 상세 모드 탭 컴포넌트들
// ══════════════════════════════════════════════

function OriginalTab({
  data, setData, set,
}: {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  set: <K extends keyof ProjectData>(k: K, v: ProjectData[K]) => void;
}) {
  const addUnit = () => setData({ ...data, originalUnits: [...data.originalUnits, { id: genId(), name: '', pyeong: 0, count: 0, valuePerUnit: 0 }] });
  const upd = (id: string, key: keyof OriginalUnit, val: string | number) =>
    setData({ ...data, originalUnits: data.originalUnits.map((u) => u.id === id ? { ...u, [key]: val } : u) });
  const remove = (id: string) => setData({ ...data, originalUnits: data.originalUnits.filter((u) => u.id !== id) });
  const totalAsset = data.originalUnits.reduce((s, u) => s + u.count * u.valuePerUnit, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">세대당 종전자산 추정가 단위: <strong>천원</strong> (5억 = 500,000)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="px-3 py-2 text-left">평형명</th>
              <th className="px-3 py-2 text-right">세대수</th>
              <th className="px-3 py-2 text-right">세대당 추정가 (천원)</th>
              <th className="px-3 py-2 text-right">소계 (천원)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.originalUnits.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="px-3 py-2"><input type="text" value={u.name} onChange={(e) => upd(u.id, 'name', e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm w-24 text-gray-900" placeholder="13평형" /></td>
                <td className="px-3 py-2"><input type="number" value={u.count || ''} onChange={(e) => upd(u.id, 'count', Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-right text-gray-900" /></td>
                <td className="px-3 py-2"><input type="number" value={u.valuePerUnit || ''} onChange={(e) => upd(u.id, 'valuePerUnit', Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm w-28 text-right text-gray-900" placeholder="500000" /></td>
                <td className="px-3 py-2 text-right text-gray-600">{(u.count * u.valuePerUnit).toLocaleString()}</td>
                <td className="px-3 py-2"><button onClick={() => remove(u.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 font-bold">
              <td className="px-3 py-2" colSpan={3}>합 계</td>
              <td className="px-3 py-2 text-right text-blue-700">{totalAsset.toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addUnit} className="text-blue-600 text-sm hover:underline">+ 평형 추가</button>

      {/* 종전 상가 — 단지에 상가동이 있는 경우 입력 */}
      <div className="border-t border-gray-100 pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="종전 상가 개수" unit="개" hint="단지 내 상가동의 점포 수">
          <NumInput value={data.commercialCount} onChange={(v) => set('commercialCount', v)} />
        </Field>
        <Field label="종전 상가 자산 추정가" unit="천원" hint="상가 전체 추정가 (비례율 분모에 합산)">
          <NumInput value={data.commercialValue} onChange={(v) => set('commercialValue', v)} />
        </Field>
      </div>
    </div>
  );
}

function NewUnitTab({
  data, setData, set,
}: {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  set: <K extends keyof ProjectData>(k: K, v: ProjectData[K]) => void;
}) {
  const addUnit = () => setData({ ...data, newUnits: [...data.newUnits, { id: genId(), name: '', sqm: 0, pyeong: 0, memberCount: 0, generalCount: 0, rentalCount: 0, generalPricePerPyeong: 3500, memberRatio: 0.9, rentalSalePricePerUnit: 0 }] });
  const upd = (id: string, key: keyof NewUnit, val: string | number) =>
    setData({ ...data, newUnits: data.newUnits.map((u) => u.id === id ? { ...u, [key]: val } : u) });
  const remove = (id: string) => setData({ ...data, newUnits: data.newUnits.filter((u) => u.id !== id) });

  // 임대 매각가 일괄 자동계산: 일반분양가 × 평형 × 0.25 × 10 (천원)
  // ※ 0.25 비율은 통상 표준건축비 매입 추정치, 단지·시점별 검증 필요
  const autoFillRentalPrice = () => {
    setData({
      ...data,
      newUnits: data.newUnits.map((u) => ({
        ...u,
        rentalSalePricePerUnit: Math.round(u.generalPricePerPyeong * u.pyeong * 0.25 * 10),
      })),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">일반분양가: 만원/평 · 임대 매각가: 천원/세대</p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
        <strong>⚠ 임대 입력 시 주의</strong> — 임대 세대수를 늘려도 <strong>총 연면적(공사비)은 자동으로 따라가지 않습니다</strong>.
        지출 탭에서 <code className="bg-amber-100 px-1">총 연면적</code>도 함께 조정하지 않으면 비례율이 부풀려져 분담금이 과소추정됩니다.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="px-2 py-2 text-left">평형명</th>
              <th className="px-2 py-2 text-right">전용㎡</th>
              <th className="px-2 py-2 text-right">평형</th>
              <th className="px-2 py-2 text-right">조합원</th>
              <th className="px-2 py-2 text-right">일반분양</th>
              <th className="px-2 py-2 text-right">임대</th>
              <th className="px-2 py-2 text-right">분양가(만/평)</th>
              <th className="px-2 py-2 text-right">조합원비율</th>
              <th className="px-2 py-2 text-right">임대매각가</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.newUnits.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="px-2 py-1"><input type="text" value={u.name} onChange={(e) => upd(u.id, 'name', e.target.value)} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-24 text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.sqm || ''} onChange={(e) => upd(u.id, 'sqm', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-14 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.pyeong || ''} onChange={(e) => upd(u.id, 'pyeong', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-12 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.memberCount || ''} onChange={(e) => upd(u.id, 'memberCount', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-16 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.generalCount || ''} onChange={(e) => upd(u.id, 'generalCount', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-16 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.rentalCount || ''} onChange={(e) => upd(u.id, 'rentalCount', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-14 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.generalPricePerPyeong || ''} onChange={(e) => upd(u.id, 'generalPricePerPyeong', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-20 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.memberRatio} onChange={(e) => upd(u.id, 'memberRatio', Number(e.target.value))} step="0.01" className="border border-gray-300 rounded px-1.5 py-1 text-xs w-14 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><input type="number" value={u.rentalSalePricePerUnit || ''} onChange={(e) => upd(u.id, 'rentalSalePricePerUnit', Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 text-xs w-20 text-right text-gray-900" /></td>
                <td className="px-2 py-1"><button onClick={() => remove(u.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 items-center">
        <button onClick={addUnit} className="text-blue-600 text-sm hover:underline">+ 평형 추가</button>
        <button onClick={autoFillRentalPrice} className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
          임대 매각가 자동채움 (일반분양가 × 25%)
        </button>
        <span className="text-xs text-gray-400">※ 25%는 통상 추정치, 단지·시점별 검증 필요</span>
      </div>

      {/* 신축 상가 분양 수입 — 비례율 분자에 합산 */}
      <div className="border-t border-gray-100 pt-4 mt-2">
        <Field label="신축 상가 분양 수입" unit="천원" hint="상가 전체 분양 수입 (총수입 분자에 합산)">
          <NumInput value={data.newCommercialRevenue} onChange={(v) => set('newCommercialRevenue', v)} />
        </Field>
      </div>
    </div>
  );
}

function ExpenseTab({ data, setExp }: { data: ProjectData; setExp: <K extends keyof ProjectData['expenses']>(k: K, v: number) => void }) {
  const GROUPS: { title: string; items: { key: keyof ProjectData['expenses']; label: string; hint?: string }[] }[] = [
    {
      title: '공사비',
      items: [
        { key: 'constructionCostPerPyeong', label: '평당 공사비 (만원/평)', hint: '신탁 770, 조합 800' },
        { key: 'totalFloorAreaPyeong', label: '총 연면적 (평)' },
        { key: 'undergroundAreaRatio', label: '지하 연면적 비율 (0~1)', hint: '용적률 시나리오에서 지하는 고정 (기본 0.4)' },
      ],
    },
    {
      title: '설계·감리·측량 (천원)',
      items: [
        { key: 'surveyFee', label: '측량·지질조사비' },
        { key: 'designFee', label: '설계비' },
        { key: 'supervisionFee', label: '감리비' },
      ],
    },
    {
      title: '부담금 (천원)',
      items: [
        { key: 'trafficBurden', label: '교통시설부담금' },
        { key: 'schoolBurden', label: '학교용지부담금' },
        { key: 'waterBurden', label: '상하수도부담금' },
        { key: 'electricBurden', label: '전기통신 원인자부담금' },
      ],
    },
    {
      title: '제세공과금 (천원)',
      items: [
        { key: 'registrationFee', label: '보존등기비' },
        { key: 'bondPurchase', label: '채권매입·법인세' },
      ],
    },
    {
      title: '보수료 및 금융비용 (천원)',
      items: [
        { key: 'trustFee', label: '신탁보수료' },
        { key: 'projectLoanFee', label: '사업비 대여금 금융비용' },
        { key: 'moveoutFinancing', label: '기본 이주비 금융비용', hint: '수입에도 환입' },
        { key: 'additionalMoveoutFinancing', label: '추가 이주비 금융비용', hint: '수입에도 환입' },
        { key: 'midpaymentFinancing', label: '조합원 중도금 대출 금융비용', hint: '수입에도 환입' },
        { key: 'hugGuaranteeFee', label: 'HUG 보증수수료' },
      ],
    },
    {
      title: '기타 사업비 (천원)',
      items: [
        { key: 'salesGuaranteeFee', label: '분양보증수수료' },
        { key: 'advertisingFee', label: '광고선전비' },
        { key: 'managementFee', label: '추진위원회·조합운영비' },
        { key: 'meetingFee', label: '총회개최비 등' },
        { key: 'compensationFee', label: '보상비(현금청산자)' },
        { key: 'otherOutsourcingFee', label: '기타 외주비 합계' },
        { key: 'contingency', label: '예비비' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-bold text-gray-700 mb-3 pb-1 border-b border-gray-200">{group.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(({ key, label, hint }) => (
              <Field key={key} label={label} hint={hint}>
                <NumInput value={data.expenses[key]} onChange={(v) => setExp(key, v)} decimal={key === 'constructionCostPerPyeong'} />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExcessTab({ data, setEP }: { data: ProjectData; setEP: <K extends keyof ProjectData['excessProfit']>(k: K, v: ProjectData['excessProfit'][K]) => void }) {
  const ep = data.excessProfit;
  return (
    <div className="space-y-5">
      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800">
        재건축초과이익 환수에 관한 법률 기준 세대당 부담금 추정입니다.
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="ep-enabled" checked={ep.enabled} onChange={(e) => setEP('enabled', e.target.checked)} className="w-4 h-4" />
        <label htmlFor="ep-enabled" className="text-sm font-medium text-gray-700">초과이익 환수 계산 활성화</label>
      </div>
      {ep.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="개시시점 세대당 주택가액" unit="천원" hint="조합설립인가일 기준 (2024.3 개정)">
            <NumInput value={ep.baseHousePrice} onChange={(v) => setEP('baseHousePrice', v)} />
          </Field>
          <Field label="종료시점 예상 세대당 주택가액" unit="천원" hint="준공인가일 기준 예상 시세">
            <NumInput value={ep.projectedHousePrice} onChange={(v) => setEP('projectedHousePrice', v)} />
          </Field>
          <Field label="사업 기간" unit="년">
            <NumInput value={ep.projectDurationYears} onChange={(v) => setEP('projectDurationYears', v)} />
          </Field>
          <Field label="정상주택가격 상승률" unit="%" hint="기본값 2.5%/년">
            <NumInput value={ep.normalRiseRate * 100} onChange={(v) => setEP('normalRiseRate', v / 100)} decimal />
          </Field>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// 공통 UI
// ══════════════════════════════════════════════

// 단지 메타정보 — 모드 무관하게 항상 표시
function MetaSection({
  data,
  set,
}: {
  data: ProjectData;
  set: <K extends keyof ProjectData>(k: K, v: ProjectData[K]) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-800 mb-4">단지 기본정보</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">단지명</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div className="col-span-1 md:col-span-1">
          <label className="block text-xs font-semibold text-gray-700 mb-1">위치</label>
          <input
            type="text"
            value={data.location}
            onChange={(e) => set('location', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">기존 세대수</label>
          <input
            type="number"
            value={data.totalUnits || ''}
            onChange={(e) => set('totalUnits', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">동수</label>
          <input
            type="number"
            value={data.totalBuildings || ''}
            onChange={(e) => set('totalBuildings', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">준공연도</label>
          <input
            type="number"
            value={data.completionYear || ''}
            onChange={(e) => set('completionYear', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">현재 용적률 (%)</label>
          <input
            type="number"
            value={data.currentFAR || ''}
            onChange={(e) => set('currentFAR', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">계획 용적률 (%)</label>
          <input
            type="number"
            value={data.plannedFAR || ''}
            onChange={(e) => set('plannedFAR', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">대지면적 (m²)</label>
          <input
            type="number"
            value={data.landAreaSqm || ''}
            onChange={(e) => set('landAreaSqm', Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-400 mb-4">{desc}</p>
      {children}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-blue-200">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function Field({ label, unit, hint, children }: { label: string; unit?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {unit && <span className="text-gray-400">({unit})</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
  );
}

function NumInput({ value, onChange, decimal }: { value: number; onChange: (v: number) => void; decimal?: boolean }) {
  return (
    <input type="number" value={value || ''} onChange={(e) => onChange(Number(e.target.value))}
      step={decimal ? '0.01' : '1'} placeholder="0"
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
  );
}
