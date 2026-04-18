'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { loadProject } from '@/lib/storage';
import { calculateProject, calcExcessProfitBurden } from '@/lib/calculator';
import { fmtMoney, fmtEok, fmtRatio, fmtBurden } from '@/lib/format';
import { ProjectData, CalculationResult } from '@/lib/types';

// ── 계산식 설명 사전 ──────────────────────────────
const TIPS: Record<string, string> = {
  비례율:
    '공식: (총수입 − 총지출) ÷ 종전자산 총액\n\n사업의 수익성 지표입니다. 100% 초과 시 수입이 지출보다 많아 소형 평형은 오히려 환급받을 수 있습니다. 100% 미만이면 모든 조합원의 분담금이 증가합니다.',
  총수입:
    '공식: 일반분양 + 조합원분양 + 임대매각 + 상가분양 + 이주비이자환입\n\n재건축 사업에서 발생하는 모든 수입의 합계입니다. 분양가가 높을수록 비례율이 높아져 분담금이 줄어듭니다.',
  총지출:
    '공사비(약 85%) + 설계·감리비 + 부담금 + 금융비용 + 기타 사업비\n\n공사비가 전체 지출의 대부분을 차지합니다. 시공사 선정 시 공사비 협상이 분담금에 가장 큰 영향을 미칩니다.',
  종전자산:
    '현재 보유한 아파트·상가의 추정 시가 합계입니다.\n\n실제 사업시행계획인가 고시일 기준으로 2개 감정평가법인이 평가한 금액의 산술 평균으로 확정됩니다.',
  권리가액:
    '공식: 세대당 종전자산 추정가 × 비례율\n\n조합원이 재건축 후 인정받는 권리의 금액입니다. 신축 아파트 분양가에서 이 금액만큼 차감하여 납부합니다.',
  조합원분양가:
    '일반분양가 × 조합원 비율(통상 90%)\n\n일반분양보다 저렴하게 조합원에게만 제공되는 특별 분양가입니다.',
  분담금:
    '공식: 조합원 분양가 − 조합원 권리가액\n\n(+) 양수: 추가로 납부해야 할 금액\n(−) 음수: 돌려받는 환급금\n\n큰 평형을 선택할수록 분양가가 높아 분담금이 증가합니다.',
  이주비이자환입:
    '이주비·중도금 이자는 조합원이 개별 납부하므로, 수입과 지출 양쪽에 동일하게 계상하여 비례율 계산에서 상쇄됩니다.',
  일반분양:
    '조합원 외 일반에게 분양하는 세대의 수입입니다. 일반분양 세대가 많을수록 사업 수입이 늘어 비례율이 높아집니다.',
};

// ── Tooltip 컴포넌트 ──────────────────────────────
function Tooltip({ id }: { id: keyof typeof TIPS }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const tip = TIPS[id];
  if (!tip) return null;

  return (
    <div className="relative inline-flex items-center ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors"
        aria-label="설명 보기"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 left-5 top-0 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl whitespace-pre-line leading-relaxed">
          <p className="font-bold text-yellow-300 mb-1">{id}</p>
          {tip}
          <div className="absolute -left-1.5 top-2 w-3 h-3 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────
export default function SimulatorPage() {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [selectedOrigId, setSelectedOrigId] = useState('');
  const [selectedNewId, setSelectedNewId] = useState('');

  useEffect(() => {
    const data = loadProject();
    setProject(data);
    setResult(calculateProject(data));
    if (data.originalUnits.length > 0) setSelectedOrigId(data.originalUnits[0].id);
    if (data.newUnits.length > 0) setSelectedNewId(data.newUnits[0].id);
  }, []);

  const hasData =
    project &&
    project.originalUnits.some((u) => u.count > 0 && u.valuePerUnit > 0) &&
    project.newUnits.some((u) => u.generalCount + u.memberCount > 0);

  if (!project || !result)
    return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;

  const selectedOrig = project.originalUnits.find((u) => u.id === selectedOrigId);
  const selectedNew = project.newUnits.find((u) => u.id === selectedNewId);
  const memberRights = selectedOrig ? (result.memberRightsMap[selectedOrig.id] ?? 0) : 0;
  const burden =
    selectedOrig && selectedNew
      ? (result.burdenMap[selectedOrig.id]?.[selectedNew.id] ?? 0)
      : null;
  const burdenFmt = burden !== null ? fmtBurden(burden) : null;

  const excessResult =
    project.excessProfit.enabled && selectedOrig
      ? calcExcessProfitBurden(project.excessProfit)
      : null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-600 text-sm">
            {project.location} · {project.totalBuildings}개동 · {project.totalUnits.toLocaleString()}세대 · {project.completionYear}년 준공
          </p>
        </div>
        {!hasData && (
          <Link href="/setup" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            데이터 입력하기 →
          </Link>
        )}
      </div>

      {!hasData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800 text-sm">
          ⚠️ 아직 사업 데이터가 입력되지 않았습니다.{' '}
          <Link href="/setup" className="font-semibold underline">데이터 설정</Link>에서
          종전자산·신축계획·지출 항목을 입력하면 분담금이 계산됩니다.
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="비례율"
          tooltip="비례율"
          value={fmtRatio(result.ratio)}
          sub={result.ratio >= 1 ? '수익 우위' : '비용 우위'}
          color={result.ratio >= 1 ? 'blue' : 'red'}
        />
        <SummaryCard
          label="총수입 추산액"
          tooltip="총수입"
          value={fmtEok(result.totalRevenue)}
          sub={`일반분양 ${fmtEok(result.generalSalesRevenue)}`}
          color="gray"
        />
        <SummaryCard
          label="총지출 추산액"
          tooltip="총지출"
          value={fmtEok(result.totalExpense)}
          sub={`공사비 ${fmtEok(result.constructionCost)}`}
          color="gray"
        />
        <SummaryCard
          label="종전자산 총액"
          tooltip="종전자산"
          value={fmtEok(result.totalOriginalAsset)}
          sub={`${project.originalUnits.length}개 평형`}
          color="gray"
        />
      </div>

      {/* 수입/지출 상세 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DetailCard title="총수입 구성" tooltip="총수입">
          <DetailRow label="일반분양 수입" tooltip="일반분양" value={fmtMoney(result.generalSalesRevenue)} />
          <DetailRow label="조합원분양 수입" tooltip="조합원분양가" value={fmtMoney(result.memberSalesRevenue)} />
          <DetailRow label="임대주택 매각" value={fmtMoney(result.rentalRevenue)} />
          <DetailRow label="상가 분양" value={fmtMoney(result.commercialRevenue)} />
          <DetailRow label="이주비 이자 환입" tooltip="이주비이자환입" value={fmtMoney(result.financingReturnRevenue)} />
          <DetailRow label="합 계" value={fmtMoney(result.totalRevenue)} bold />
        </DetailCard>

        <DetailCard title="총지출 구성" tooltip="총지출">
          <DetailRow label="건축 공사비" value={fmtMoney(result.constructionCost)} />
          <DetailRow label="설계·감리·측량비" value={fmtMoney(project.expenses.designFee + project.expenses.supervisionFee + project.expenses.surveyFee)} />
          <DetailRow label="부담금 합계" value={fmtMoney(project.expenses.trafficBurden + project.expenses.schoolBurden + project.expenses.waterBurden + project.expenses.electricBurden)} />
          <DetailRow label="금융비용 합계" value={fmtMoney(project.expenses.trustFee + project.expenses.moveoutFinancing + project.expenses.additionalMoveoutFinancing + project.expenses.midpaymentFinancing + project.expenses.hugGuaranteeFee)} />
          <DetailRow label="기타 사업비" value={fmtMoney(result.otherExpenseTotal - (project.expenses.designFee + project.expenses.supervisionFee + project.expenses.surveyFee + project.expenses.trafficBurden + project.expenses.schoolBurden + project.expenses.waterBurden + project.expenses.electricBurden + project.expenses.trustFee + project.expenses.moveoutFinancing + project.expenses.additionalMoveoutFinancing + project.expenses.midpaymentFinancing + project.expenses.hugGuaranteeFee))} />
          <DetailRow label="합 계" value={fmtMoney(result.totalExpense)} bold />
        </DetailCard>
      </div>

      {/* 내 분담금 계산기 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">내 분담금 계산</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">현재 보유 평형</label>
            <select
              value={selectedOrigId}
              onChange={(e) => setSelectedOrigId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {project.originalUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.count.toLocaleString()}세대 · 추정가 {fmtMoney(u.valuePerUnit)}/세대)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">신청할 신축 평형</label>
            <select
              value={selectedNewId}
              onChange={(e) => setSelectedNewId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {project.newUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · 조합원분양가 {fmtMoney(u.generalPricePerPyeong * u.pyeong * 10 * u.memberRatio)}/세대
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedOrig && selectedNew && (
          <div className="bg-gray-50 rounded-xl p-5 space-y-3">
            <CalcRow
              label="종전자산 추정가"
              tooltip="종전자산"
              value={fmtMoney(selectedOrig.valuePerUnit)}
            />
            <CalcRow
              label={`비례율 적용 (${fmtRatio(result.ratio)})`}
              tooltip="비례율"
              value=""
            />
            <CalcRow
              label="→ 조합원 권리가액"
              tooltip="권리가액"
              value={fmtMoney(memberRights)}
              highlight
            />
            <CalcRow
              label={`조합원 분양가 (${selectedNew.name})`}
              tooltip="조합원분양가"
              value={fmtMoney(selectedNew.generalPricePerPyeong * selectedNew.pyeong * 10 * selectedNew.memberRatio)}
            />
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-base font-bold text-gray-800">추정 분담(환급)금</span>
                  <Tooltip id="분담금" />
                </div>
                {burdenFmt && (
                  <span className={`text-xl font-bold ${burdenFmt.color}`}>{burdenFmt.text}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                분담금 = 조합원 분양가 − 조합원 권리가액 · (−) 음수는 환급
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 재건축 초과이익 환수 */}
      {project.excessProfit.enabled && excessResult && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">재건축 초과이익 환수 (추정)</h2>
          <p className="text-xs text-gray-500 mb-4">※ 세대당 추정치. 개발비용 미포함 보수적 계산.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniCard label="개시시점 가격" value={fmtMoney(project.excessProfit.baseHousePrice)} />
            <MiniCard label="정상상승분" value={fmtMoney(excessResult.normalRise)} />
            <MiniCard label="초과이익" value={fmtMoney(excessResult.excessProfit)} />
            <MiniCard label="환수 부담금" value={fmtMoney(excessResult.burden)} highlight />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            실효세율 {(excessResult.effectiveRate * 100).toFixed(1)}% · 사업기간 {project.excessProfit.projectDurationYears}년 · 정상상승률 {(project.excessProfit.normalRiseRate * 100).toFixed(1)}%/년
          </p>
        </div>
      )}

      {/* 전체 분담금 테이블 */}
      {hasData && result.totalOriginalAsset > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">평형별 분담금 전체 표</h2>
            <Tooltip id="분담금" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="px-3 py-2 text-left">기존 평형</th>
                <th className="px-3 py-2 text-right">권리가액</th>
                {project.newUnits.map((u) => (
                  <th key={u.id} className="px-3 py-2 text-right">{u.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.originalUnits.map((orig, i) => {
                const rights = result.memberRightsMap[orig.id] ?? 0;
                return (
                  <tr key={orig.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-medium text-gray-900">{orig.name}</td>
                    <td className="px-3 py-2 text-right text-blue-700 font-medium">{fmtMoney(rights)}</td>
                    {project.newUnits.map((nu) => {
                      const b = result.burdenMap[orig.id]?.[nu.id] ?? 0;
                      const bf = fmtBurden(b);
                      return (
                        <td key={nu.id} className={`px-3 py-2 text-right font-medium ${bf.color}`}>
                          {fmtMoney(Math.abs(b))}{b < 0 ? ' ↩' : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">↩ 표시는 환급 / 나머지는 납부</p>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900 space-y-2 leading-relaxed">
      <p className="font-bold text-sm">⚠ 본 시뮬레이터는 추정치 제공 목적이며, 실제 분담금은 다음 시점에 확정됩니다.</p>
      <ul className="list-disc list-inside space-y-1 pl-1">
        <li><strong>종전자산 가액</strong>: 사업시행계획인가 고시일 기준 감정평가 2곳의 산술평균</li>
        <li><strong>총수입</strong>: 일반분양가 확정 시점(분양승인일)</li>
        <li><strong>총지출</strong>: 관리처분인가 시점 공사비 확정 단가</li>
        <li><strong>재초환 부담금</strong>: 준공인가일 기준 최종 산정 (개시시점은 조합설립인가일)</li>
      </ul>
      <p className="pt-1">
        본 자료는 법적 구속력이 없으며, 정확한 분담금은 조합 또는 정비사업전문관리업체의 공식 산정을 따라야 합니다.
        조합원 분양가 비율(통상 90%), 임대 매각가(일반분양가의 25% 가정), 공사비 단가 등은 단지별 협상·시장 상황에 따라 변동되므로 <strong>실제 단지 데이터로 검증이 필요합니다</strong>.
      </p>
      <p className="pt-1 text-amber-800">
        <strong>주의</strong>: 임대 세대수를 변경하면 <strong>총 연면적(공사비)도 함께 조정</strong>해야 정확한 비례율이 나옵니다. 자동 연동되지 않습니다.
      </p>
    </div>
  );
}

// ── 하위 컴포넌트 ─────────────────────────────────

function SummaryCard({
  label, tooltip, value, sub, color,
}: {
  label: string; tooltip?: keyof typeof TIPS; value: string; sub: string; color: 'blue' | 'red' | 'gray';
}) {
  const colorMap = { blue: 'text-blue-700', red: 'text-red-600', gray: 'text-gray-900' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center">
        <p className="text-xs text-gray-600 font-semibold">{label}</p>
        {tooltip && <Tooltip id={tooltip} />}
      </div>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function DetailCard({ title, tooltip, children }: { title: string; tooltip?: keyof typeof TIPS; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center mb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {tooltip && <Tooltip id={tooltip} />}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label, tooltip, value, bold,
}: {
  label: string; tooltip?: keyof typeof TIPS; value: string; bold?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t pt-2' : ''}`}>
      <div className="flex items-center text-gray-700">
        <span>{label}</span>
        {tooltip && <Tooltip id={tooltip} />}
      </div>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

function CalcRow({
  label, tooltip, value, highlight,
}: {
  label: string; tooltip?: keyof typeof TIPS; value: string; highlight?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <div className="flex items-center text-gray-700">
        <span>{label}</span>
        {tooltip && <Tooltip id={tooltip} />}
      </div>
      <span className={highlight ? 'text-blue-700 font-bold' : 'text-gray-900 font-medium'}>{value}</span>
    </div>
  );
}

function MiniCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-orange-50 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`text-lg font-bold mt-1 ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
