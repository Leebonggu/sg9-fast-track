'use client';
import { useState, useEffect } from 'react';
import { loadProject } from '@/lib/storage';
import {
  calculateScenarioMatrix,
  calculateFARScenarios,
  SALE_STEPS,
  COST_STEPS,
  DEFAULT_FAR_STEPS,
} from '@/lib/calculator';
import { fmtRatio, fmtMoney, fmtBurden } from '@/lib/format';
import { ProjectData, ScenarioCell, FARScenarioResult } from '@/lib/types';

type Tab = 'matrix' | 'far';

export default function ScenarioPage() {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tab, setTab] = useState<Tab>('matrix');
  const [matrix, setMatrix] = useState<ScenarioCell[][] | null>(null);
  const [farResults, setFarResults] = useState<FARScenarioResult[] | null>(null);
  const [selectedOrigId, setSelectedOrigId] = useState('');
  const [selectedNewId, setSelectedNewId] = useState('');
  const [customFARs, setCustomFARs] = useState<string>('200,250,300,350,400');

  useEffect(() => {
    const data = loadProject();
    setProject(data);
    setMatrix(calculateScenarioMatrix(data));
    setFarResults(calculateFARScenarios(data, [...DEFAULT_FAR_STEPS]));
    if (data.originalUnits.length > 0) setSelectedOrigId(data.originalUnits[0].id);
    if (data.newUnits.length > 0) setSelectedNewId(data.newUnits[0].id);
  }, []);

  const handleFARRecalc = () => {
    if (!project) return;
    const farArr = customFARs
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    setFarResults(calculateFARScenarios(project, farArr));
  };

  if (!project || !matrix) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">시나리오 분석</h1>
        <p className="text-gray-500 text-sm mt-1">분양가·공사비 변동 시나리오 / 용적률 변화 시나리오</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-gray-200">
        {([
          ['matrix', '분양가 × 공사비'],
          ['far', '용적률 시나리오'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 평형 선택 (공통) */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">기존 평형</label>
          <select
            value={selectedOrigId}
            onChange={(e) => setSelectedOrigId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {project.originalUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">신축 평형</label>
          <select
            value={selectedNewId}
            onChange={(e) => setSelectedNewId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {project.newUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'matrix' && (
        <MatrixTab
          matrix={matrix}
          origId={selectedOrigId}
          newId={selectedNewId}
        />
      )}
      {tab === 'far' && farResults && (
        <FARTab
          project={project}
          farResults={farResults}
          origId={selectedOrigId}
          newId={selectedNewId}
          customFARs={customFARs}
          setCustomFARs={setCustomFARs}
          onRecalc={handleFARRecalc}
        />
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
        <p className="font-bold text-sm mb-1">⚠ 시나리오는 가정에 기반한 추정치입니다.</p>
        <p>
          용적률 시나리오는 <strong>지상 연면적만</strong> 비례 변동시키고 지하(주차장·기계실 등, 기본 40%)는 고정으로 처리합니다.
          실제로는 층수 증가에 따라 평당 공사비도 상승하며, 법적상한용적률 초과분은 임대주택 의무 공급 조건이 적용됩니다.
        </p>
      </div>
    </div>
  );
}

// ── 분양가 × 공사비 매트릭스 탭 ──────────────────

function MatrixTab({
  matrix,
  origId,
  newId,
}: {
  matrix: ScenarioCell[][];
  origId: string;
  newId: string;
}) {
  return (
    <div className="space-y-6">
      {/* 비례율 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
        <h2 className="text-base font-bold text-gray-800 mb-1">비례율 변화표</h2>
        <p className="text-xs text-gray-400 mb-4">행: 일반분양가 변동 / 열: 공사비 변동</p>
        <table className="w-full text-sm text-center">
          <thead>
            <tr>
              <th className="px-3 py-2 bg-gray-100 text-gray-600 text-left">분양가 ↓ / 공사비 →</th>
              {COST_STEPS.map((c) => (
                <th key={c} className={`px-3 py-2 ${c === 0 ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {c === 0 ? '기준' : `${c > 0 ? '+' : ''}${(c * 100).toFixed(0)}%`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SALE_STEPS.map((sp, ri) => (
              <tr key={sp}>
                <td className={`px-3 py-2 font-medium text-left ${sp === 0 ? 'bg-blue-900 text-white' : 'bg-gray-50 text-gray-600'}`}>
                  {sp === 0 ? '기준' : `${sp > 0 ? '+' : ''}${(sp * 100).toFixed(0)}%`}
                </td>
                {COST_STEPS.map((cc, ci) => {
                  const cell = matrix[ri][ci];
                  const isBase = sp === 0 && cc === 0;
                  return (
                    <td
                      key={cc}
                      className={`px-3 py-2 font-mono font-medium ${
                        isBase ? 'bg-yellow-100 text-yellow-800 font-bold' : 'text-gray-900'
                      }`}
                    >
                      {fmtRatio(cell.ratio)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 분담금 테이블 */}
      {origId && newId && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
          <h2 className="text-base font-bold text-gray-800 mb-1">분담금 변화표</h2>
          <p className="text-xs text-gray-400 mb-4">선택 평형 기준 · (−) 는 환급</p>
          <table className="w-full text-sm text-center">
            <thead>
              <tr>
                <th className="px-3 py-2 bg-gray-100 text-gray-600 text-left">분양가 ↓ / 공사비 →</th>
                {COST_STEPS.map((c) => (
                  <th key={c} className={`px-3 py-2 ${c === 0 ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {c === 0 ? '기준' : `${c > 0 ? '+' : ''}${(c * 100).toFixed(0)}%`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SALE_STEPS.map((sp, ri) => (
                <tr key={sp}>
                  <td className={`px-3 py-2 font-medium text-left ${sp === 0 ? 'bg-blue-900 text-white' : 'bg-gray-50 text-gray-600'}`}>
                    {sp === 0 ? '기준' : `${sp > 0 ? '+' : ''}${(sp * 100).toFixed(0)}%`}
                  </td>
                  {COST_STEPS.map((cc, ci) => {
                    const cell = matrix[ri][ci];
                    const b = cell.burdenMap[origId]?.[newId] ?? 0;
                    const bf = fmtBurden(b);
                    const isBase = sp === 0 && cc === 0;
                    return (
                      <td key={cc} className={`px-3 py-2 font-medium ${isBase ? 'bg-yellow-100' : ''} ${bf.color}`}>
                        {fmtMoney(Math.abs(b))}{b < 0 ? ' ↩' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">↩ 환급</p>
        </div>
      )}
    </div>
  );
}

// ── 용적률 시나리오 탭 ──────────────────────────

function FARTab({
  project,
  farResults,
  origId,
  newId,
  customFARs,
  setCustomFARs,
  onRecalc,
}: {
  project: ProjectData;
  farResults: FARScenarioResult[];
  origId: string;
  newId: string;
  customFARs: string;
  setCustomFARs: (v: string) => void;
  onRecalc: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* 설명 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <strong>용적률 시나리오란?</strong><br />
        용적률이 달라지면 일반분양 세대수와 총 연면적이 비례하여 변동됩니다.<br />
        기준 용적률 <strong>{project.plannedFAR}%</strong> 대비 변화를 시뮬레이션합니다.
      </div>

      {/* 용적률 입력 */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            시뮬레이션할 용적률 (% · 쉼표로 구분)
          </label>
          <input
            type="text"
            value={customFARs}
            onChange={(e) => setCustomFARs(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 200,250,300,350,400"
          />
        </div>
        <button
          onClick={onRecalc}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          재계산
        </button>
      </div>

      {/* 비례율 변화 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
        <h2 className="text-base font-bold text-gray-800 mb-4">용적률별 비례율 및 분담금</h2>
        <table className="w-full text-sm text-center">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="px-3 py-2 text-left">용적률</th>
              <th className="px-3 py-2">일반분양 세대 증감</th>
              <th className="px-3 py-2">총수입</th>
              <th className="px-3 py-2">총지출</th>
              <th className="px-3 py-2">비례율</th>
              {origId && newId && <th className="px-3 py-2">분담금</th>}
            </tr>
          </thead>
          <tbody>
            {farResults.map((row, i) => {
              const isBase = row.far === project.plannedFAR;
              const baseGeneralCount = project.newUnits.reduce((s, u) => s + u.generalCount, 0);
              const rowGeneralCount = Math.round(
                baseGeneralCount * (project.plannedFAR > 0 ? row.far / project.plannedFAR : 1)
              );
              const diff = rowGeneralCount - baseGeneralCount;
              const b = origId && newId ? (row.result.burdenMap[origId]?.[newId] ?? 0) : null;
              const bf = b !== null ? fmtBurden(b) : null;
              return (
                <tr key={row.far} className={isBase ? 'bg-yellow-50 font-bold' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-left">
                    {row.far}%{isBase ? ' (기준)' : ''}
                  </td>
                  <td className="px-3 py-2">
                    {rowGeneralCount.toLocaleString()}세대
                    {diff !== 0 && (
                      <span className={`ml-1 text-xs ${diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{fmtMoney(row.result.totalRevenue)}</td>
                  <td className="px-3 py-2">{fmtMoney(row.result.totalExpense)}</td>
                  <td className="px-3 py-2 font-mono">{fmtRatio(row.result.ratio)}</td>
                  {bf && (
                    <td className={`px-3 py-2 font-medium ${bf.color}`}>
                      {fmtMoney(Math.abs(b!))}{b! < 0 ? ' ↩' : ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">
          ※ 조합원 세대수는 고정, 일반분양 세대수와 연면적이 용적률에 비례하여 변동됩니다.
        </p>
      </div>

      {/* 그래프 (비례율 바 차트) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">용적률 → 비례율 변화</h2>
        <div className="space-y-2">
          {farResults.map((row) => {
            const pct = Math.min(Math.max(row.result.ratio * 100, 0), 200);
            const isBase = row.far === project.plannedFAR;
            return (
              <div key={row.far} className="flex items-center gap-3">
                <span className="w-20 text-right text-sm text-gray-600 font-mono">{row.far}%</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isBase ? 'bg-yellow-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(pct / 2, 100)}%` }}
                  />
                </div>
                <span className="w-20 text-sm font-mono font-medium text-gray-800">
                  {fmtRatio(row.result.ratio)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
