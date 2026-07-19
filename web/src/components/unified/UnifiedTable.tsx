'use client';

import { memo, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';
import { AGE_GROUP_OPTIONS } from '@/lib/unified-utils';
import MemoCell from './MemoCell';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
  showDong: boolean;
  onRowClick: (row: UnifiedRow) => void;
  onKakaoToggled: (dong: string, ho: string, value: boolean) => void;
  onAgeChanged: (dong: string, ho: string, value: string) => void;
  onPlanToggled: (dong: string, ho: string, field: 'consent' | 'privacy' | 'id', value: boolean) => void;
}

const Check = ({ value }: { value: boolean }) =>
  value ? (
    <span className="text-green-600 font-bold text-sm">✓</span>
  ) : (
    <span className="text-red-300 text-sm">✗</span>
  );

const shortSurveyLabel = (id: string) =>
  id.replace(/_완료$/, '').replace(/^\d{4}_\d{2}_/, '');

// 테이블 인터랙티브 컨트롤 공용 스타일 — 네모(rounded-md) + 푸른색 계열로 통일
const CTRL = 'inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md border text-[11px] font-medium transition-colors';
const CTRL_ON = 'bg-blue-600 text-white border-blue-600';
const CTRL_OFF = 'bg-white text-gray-400 border-gray-300 hover:border-blue-400';

function KakaoToggle({
  dong, ho, value, onChanged,
}: {
  dong: string; ho: string; value: boolean;
  onChanged: (dong: string, ho: string, value: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    if (saving) return;
    const newVal = !value;
    onChanged(dong, ho, newVal); // 낙관적: 즉시 화면 반영, 저장은 백그라운드
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/kakao-group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho, kakaoGroup: newVal }),
      });
      if (!res.ok) { onChanged(dong, ho, value); alert('저장 실패'); } // 실패 시 롤백
    } catch {
      onChanged(dong, ho, value); // 네트워크 오류 시 롤백
    } finally {
      setSaving(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      title="단톡방 참여 여부 (클릭해서 토글)"
      className={`${CTRL} min-w-[3rem] ${value ? CTRL_ON : CTRL_OFF}`}
    >
      {value ? '✓ 참여' : '미참여'}
    </button>
  );
}

function PlanMiniToggle({ dong, ho, field, label, value, onChanged }: {
  dong: string; ho: string; field: 'consent' | 'privacy' | 'id'; label: string; value: boolean;
  onChanged: (dong: string, ho: string, field: 'consent' | 'privacy' | 'id', value: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    if (saving) return;
    const newVal = !value;
    onChanged(dong, ho, field, newVal);
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/plan-tracking', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho, field, value: newVal }),
      });
      if (!res.ok) { onChanged(dong, ho, field, value); alert('저장 실패'); }
    } catch { onChanged(dong, ho, field, value); }
    finally { setSaving(false); }
  }
  return (
    <button type="button" onClick={toggle} title={`${label} 수령 여부 (클릭해서 토글)`}
      className={`${CTRL} ${value ? CTRL_ON : CTRL_OFF}`}>
      {value ? `✓${label}` : label}
    </button>
  );
}

function IdReceivedCell({ row, onPlanToggled }: { row: UnifiedRow; onPlanToggled: RowProps['onPlanToggled']; }) {
  const online = row.idUploaded ?? 0;
  return (
    <span className="inline-flex items-center gap-1">
      {online > 0 && (
        <span className="inline-flex items-center justify-center h-7 px-2 rounded-md border text-[11px] font-medium bg-blue-50 text-blue-700 border-blue-200"
          title={`온라인 신분증 ${online}장 업로드됨 (읽기 전용)`}>✓온라인{online}</span>
      )}
      <PlanMiniToggle dong={row.dong} ho={row.ho} field="id" label="종이" value={row.idReceived ?? false} onChanged={onPlanToggled} />
    </span>
  );
}

function AgeSelect({
  dong, ho, value, onChanged,
}: {
  dong: string; ho: string; value: string;
  onChanged: (dong: string, ho: string, value: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  async function change(newVal: string) {
    if (saving || newVal === value) return;
    const prev = value;
    onChanged(dong, ho, newVal); // 낙관적: 즉시 화면 반영, 저장은 백그라운드
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/age', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong, ho, ageGroup: newVal }),
      });
      if (!res.ok) { onChanged(dong, ho, prev); alert('저장 실패'); } // 실패 시 롤백
    } catch {
      onChanged(dong, ho, prev); // 네트워크 오류 시 롤백
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className={`group relative inline-flex ${saving ? 'opacity-50' : ''}`}>
      <span
        className={`${CTRL} ${
          value
            ? CTRL_ON
            : 'bg-white text-gray-400 border-gray-300 group-hover:border-blue-400'
        }`}
      >
        {value || '미지정'}
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </span>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        title="연령대 (선택해서 변경)"
        aria-label="연령대"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
      >
        {AGE_GROUP_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt || '미지정'}</option>
        ))}
      </select>
    </div>
  );
}

function Chip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-md border ${
        done
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50/60 text-red-400 border-red-100'
      }`}
    >
      <span className="font-bold">{done ? '✓' : '✗'}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

function DonationBadge({ total, count }: { total: number; count: number }) {
  if (total <= 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-md border bg-gray-50 text-gray-400 border-gray-200">
        <span className="whitespace-nowrap">- (미납부)</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
      <span className="font-bold">✓</span>
      <span className="whitespace-nowrap">
        {total.toLocaleString()}원·{count}회
      </span>
    </span>
  );
}

function ResidencyBadge({ value }: { value: string }) {
  if (!value) return null;
  const base =
    value === '실거주'
      ? 'bg-green-100 text-green-700'
      : value === '임대'
        ? 'bg-orange-100 text-orange-700'
        : 'bg-gray-100 text-gray-500';
  return (
    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${base}`}>
      {value}
    </span>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors"
      title="원본 데이터 수정"
    >
      수정
    </button>
  );
}

function rowBgClass(doneCount: number, totalCount: number) {
  if (doneCount === totalCount) return '';
  if (doneCount === 0) return 'bg-red-50';
  return 'bg-amber-50';
}

interface RowProps {
  row: UnifiedRow;
  surveyIds: string[];
  showDong: boolean;
  onRowClick: (row: UnifiedRow) => void;
  onKakaoToggled: (dong: string, ho: string, value: boolean) => void;
  onAgeChanged: (dong: string, ho: string, value: string) => void;
  onPlanToggled: (dong: string, ho: string, field: 'consent' | 'privacy' | 'id', value: boolean) => void;
}

// 개별 행을 memo로 분리 — 토글/메모 변경 시 해당 행만 재렌더 (2,830행 전체 재렌더 방지).
// patchKakaoGroup은 바뀐 행만 새 객체로 만들고 나머지는 객체 동일성을 유지하므로,
// 변경되지 않은 행은 memo 얕은 비교에서 걸러져 재렌더되지 않는다.
const MobileCard = memo(function MobileCard({
  row, surveyIds, showDong, onRowClick, onKakaoToggled, onAgeChanged, onPlanToggled,
}: RowProps) {
  const doneCount =
    (row.consent ? 1 : 0) + surveyIds.filter((id) => row.surveys[id]).length;
  const totalCount = 1 + surveyIds.length;
  const bg = rowBgClass(doneCount, totalCount) || 'bg-white';
  return (
    <div className={`rounded-lg border border-gray-200 ${bg} px-3 py-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_120px]`}>
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          {showDong && (
            <span className="text-xs text-gray-400 shrink-0">{row.dong}동</span>
          )}
          <span className="font-semibold text-sm text-gray-800 shrink-0">
            {row.ho}호
          </span>
          <span className="text-xs text-gray-700 truncate">
            {row.ownerName || '-'}
          </span>
          {row.nameMismatch && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium" title={`동의서: ${row.consentName}`}>이름불일치</span>
          )}
          {row.opposition && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">반대</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ResidencyBadge value={row.residency} />
          <EditButton onClick={() => onRowClick(row)} />
        </div>
      </div>
      {row.phone && (
        <div className="text-[11px] text-gray-500 mb-1.5 break-all">📞 {row.phone}</div>
      )}
      <div className="flex flex-wrap gap-1 mb-2 items-center">
        <Chip done={row.consent} label="동의서" />
        {surveyIds.map((id) => (
          <Chip
            key={id}
            done={row.surveys[id] ?? false}
            label={shortSurveyLabel(id)}
          />
        ))}
        <DonationBadge total={row.donationTotal ?? 0} count={row.donationCount ?? 0} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
        </div>
        <AgeSelect dong={row.dong} ho={row.ho} value={row.ageGroup ?? ''} onChanged={onAgeChanged} />
        <KakaoToggle dong={row.dong} ho={row.ho} value={row.kakaoGroup ?? false} onChanged={onKakaoToggled} />
      </div>
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-400">정비입안 동의서</span>
        <PlanMiniToggle dong={row.dong} ho={row.ho} field="consent" label="동의서" value={row.planConsent ?? false} onChanged={onPlanToggled} />
        <span className="text-[10px] text-gray-400 ml-1">개인정보</span>
        <PlanMiniToggle dong={row.dong} ho={row.ho} field="privacy" label="개인정보" value={row.privacyConsent ?? false} onChanged={onPlanToggled} />
        <span className="text-[10px] text-gray-400 ml-1">신분증</span>
        <IdReceivedCell row={row} onPlanToggled={onPlanToggled} />
      </div>
    </div>
  );
});

const DesktopRow = memo(function DesktopRow({
  row, surveyIds, showDong, onRowClick, onKakaoToggled, onAgeChanged, onPlanToggled,
}: RowProps) {
  const doneCount =
    (row.consent ? 1 : 0) + surveyIds.filter((id) => row.surveys[id]).length;
  const totalCount = 1 + surveyIds.length;
  const bg = rowBgClass(doneCount, totalCount);
  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 [content-visibility:auto] [contain-intrinsic-size:auto_41px] ${bg}`}>
      {showDong && (
        <td className="py-2 px-3 text-gray-400 text-xs">{row.dong}</td>
      )}
      <td className="py-2 px-3 font-medium">{row.ho}</td>
      <td className="py-2 px-3 text-gray-700">
        <span className="flex items-center gap-1.5 flex-wrap">
          {row.ownerName}
          {row.nameMismatch && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium" title={`동의서: ${row.consentName}`}>이름불일치</span>
          )}
          {row.opposition && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">반대</span>
          )}
        </span>
      </td>
      <td className="py-2 px-3 text-xs text-gray-600">
        <span className="block max-w-[130px] truncate" title={row.phone || undefined}>
          {row.phone || '-'}
        </span>
      </td>
      <td className="py-2 px-3 text-center">
        <ResidencyBadge value={row.residency} />
      </td>
      <td className="py-2 px-3 text-center">
        <Check value={row.consent} />
      </td>
      <td className="py-2 px-3 text-center">
        <DonationBadge total={row.donationTotal ?? 0} count={row.donationCount ?? 0} />
      </td>
      {surveyIds.map((id) => (
        <td key={id} className="py-2 px-3 text-center">
          <Check value={row.surveys[id] ?? false} />
        </td>
      ))}
      <td className="py-2 px-3 min-w-[100px]">
        <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
      </td>
      <td className="py-2 px-3 text-center">
        <AgeSelect dong={row.dong} ho={row.ho} value={row.ageGroup ?? ''} onChanged={onAgeChanged} />
      </td>
      <td className="py-2 px-3 text-center">
        <KakaoToggle dong={row.dong} ho={row.ho} value={row.kakaoGroup ?? false} onChanged={onKakaoToggled} />
      </td>
      <td className="py-2 px-3 text-center">
        <PlanMiniToggle dong={row.dong} ho={row.ho} field="consent" label="동의서" value={row.planConsent ?? false} onChanged={onPlanToggled} />
      </td>
      <td className="py-2 px-3 text-center">
        <PlanMiniToggle dong={row.dong} ho={row.ho} field="privacy" label="개인정보" value={row.privacyConsent ?? false} onChanged={onPlanToggled} />
      </td>
      <td className="py-2 px-3 text-center">
        <IdReceivedCell row={row} onPlanToggled={onPlanToggled} />
      </td>
      <td className="py-2 px-3 text-center">
        <EditButton onClick={() => onRowClick(row)} />
      </td>
    </tr>
  );
});

function UnifiedTableInner({ rows, surveyIds, showDong, onRowClick, onKakaoToggled, onAgeChanged, onPlanToggled }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        해당 조건의 세대가 없습니다.
      </div>
    );
  }

  return (
    <>
      {/* 모바일: 카드 리스트 */}
      <div className="sm:hidden flex flex-col gap-2 -mx-1">
        {rows.map((row) => (
          <MobileCard
            key={`${row.dong}-${row.ho}`}
            row={row}
            surveyIds={surveyIds}
            showDong={showDong}
            onRowClick={onRowClick}
            onKakaoToggled={onKakaoToggled}
            onAgeChanged={onAgeChanged}
            onPlanToggled={onPlanToggled}
          />
        ))}
      </div>

      {/* 데스크톱: 테이블 */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-400">
              {showDong && (
                <th className="text-left py-2 px-3 font-medium whitespace-nowrap">동</th>
              )}
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">호수</th>
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">소유자</th>
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap max-w-[130px]">연락처</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">실거주</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">
                신속통합동의서_제출
              </th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">후원금</th>
              {surveyIds.map((id) => (
                <th
                  key={id}
                  className="text-center py-2 px-3 font-medium whitespace-nowrap"
                >
                  {id}
                </th>
              ))}
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">메모</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">연령대</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">단톡방</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">정비입안 동의서</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">개인정보동의</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">신분증</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">수정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DesktopRow
                key={`${row.dong}-${row.ho}`}
                row={row}
                surveyIds={surveyIds}
                showDong={showDong}
                onRowClick={onRowClick}
                onKakaoToggled={onKakaoToggled}
                onAgeChanged={onAgeChanged}
                onPlanToggled={onPlanToggled}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const UnifiedTable = memo(UnifiedTableInner);
export default UnifiedTable;
