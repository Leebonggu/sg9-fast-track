'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import { adminFetch } from '@/lib/admin-fetch';
import { AGE_GROUP_OPTIONS, hasSintoConsent, consentSource } from '@/lib/unified-utils';
import { splitContacts } from '@/lib/phone-format';
import MemoCell from './MemoCell';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
  showDong: boolean;
  // 스크롤을 맨 위로 되돌릴 시점을 정하는 키(필터/동 변경 등 "보는 목록이 바뀔 때"만 값이 달라져야 한다).
  // rows 배열은 토글 낙관적 업데이트마다 새 배열이 되므로 리셋 기준으로 쓰면 안 된다.
  resetKey?: string;
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
// 종이 기록은 없지만 전자동의로 인정되는 상태 — 채워진 모양이되 종이(진한 파랑)와 구분되는 연한 파랑
const CTRL_E = 'bg-blue-50 text-blue-700 border-blue-300';

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

// electronic: 전자동의로 이미 인정되는 항목이면 채워진 모양(연한 파랑, `✓라벨(전자)`)으로 보여준다.
// 클릭은 여전히 종이 기록 전용 — 전자 상태는 명부 파생값이라 여기서 켜고 끌 수 없다.
function PlanMiniToggle({ dong, ho, field, label, value, electronic, onChanged, title }: {
  dong: string; ho: string; field: 'consent' | 'privacy' | 'id'; label: string; value: boolean;
  electronic?: boolean;
  onChanged: (dong: string, ho: string, field: 'consent' | 'privacy' | 'id', value: boolean) => void;
  title?: string;
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
  const eOnly = !value && Boolean(electronic);
  return (
    <button
      type="button"
      onClick={toggle}
      title={
        eOnly
          ? `전자동의로 인정됨 — 클릭하면 종이 ${label} 수령을 별도로 기록합니다`
          : title ?? `${label} 수령 여부 (클릭해서 토글)`
      }
      className={`${CTRL} ${value ? CTRL_ON : eOnly ? CTRL_E : CTRL_OFF}`}
    >
      {value ? `✓${label}` : eOnly ? `✓${label}(전자)` : label}
    </button>
  );
}

// 신분증은 전부 "종이로 받아서 위원이 스캔 업로드"하는 흐름이라, 주민 온라인 제출을
// 따로 구분해 보여줄 이유가 없다. 하나로 합쳐 "종이(업로드된 파일 수)"로 표시한다.
//   종이(0)   미수령
//   ✓종이(0)  종이는 받았고 아직 업로드 안 함 → 스캔 대기
//   ✓종이(2)  받고 2장 업로드 완료 (공동명의는 소유자 1명당 1장)
function IdReceivedCell({ row, onPlanToggled }: { row: UnifiedRow; onPlanToggled: RowProps['onPlanToggled']; }) {
  const uploaded = row.idUploaded ?? 0;
  return (
    <PlanMiniToggle
      dong={row.dong} ho={row.ho} field="id"
      label={`종이(${uploaded})`}
      value={row.idReceived ?? false}
      electronic={eAccepted(row)}
      onChanged={onPlanToggled}
      title={`종이 수령 여부 (클릭해서 토글) · 괄호 안은 업로드된 신분증 파일 수 ${uploaded}장 (자동 집계, 파기 제외)`}
    />
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
  // 동의는 종이·전자 합산 — 전자로만 낸 세대가 빨간 배경(미완료)으로 찍히면 안 된다.
  const doneCount =
    (hasSintoConsent(row) ? 1 : 0) + surveyIds.filter((id) => row.surveys[id]).length;
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
          {row.rosterNameMismatch && (
            <span
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium"
              title={`전자동의 명부: ${row.rosterName} — 소유권 이전 의심. 등기부로 확인 후 판단하세요.`}
            >
              명부 {row.rosterName}
            </span>
          )}
          {/* 대표자는 아래 상세 줄에 공유 인원수·추진방식과 함께 나온다 (여기 배지는 중복) */}
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
        <div className="text-[11px] text-gray-500 mb-1.5 break-all">
          📞 {splitContacts(row.phone).map((c, i) => (
            <span key={i}>
              {i > 0 && ' / '}
              {c.number || c.name}
              {c.number && c.name && <span className="text-gray-400"> {c.name}</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1 mb-2 items-center">
        <Chip done={hasSintoConsent(row)} label="동의서" />
        <EBadge state={row.econsentSinto} />
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
        <PlanMiniToggle dong={row.dong} ho={row.ho} field="consent" label="동의서" value={row.planConsent ?? false} electronic={row.econsentPlan === '완전'} onChanged={onPlanToggled} />
        {row.econsentPlan === '일부' && <EBadge state="일부" />}
        <span className="text-[10px] text-gray-400 ml-1">개인정보</span>
        <PlanMiniToggle dong={row.dong} ho={row.ho} field="privacy" label="개인정보" value={row.privacyConsent ?? false} electronic={eAccepted(row)} onChanged={onPlanToggled} />
        <span className="text-[10px] text-gray-400 ml-1">신분증</span>
        <IdReceivedCell row={row} onPlanToggled={onPlanToggled} />
      </div>
      {(row.representative || (row.coOwnerCount ?? 0) > 1 || row.planChoice) && (
        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] text-gray-500">
          {(row.coOwnerCount ?? 0) > 1 && (
            <span title="공유 소유자 수">공유 {row.coOwnerCount}인</span>
          )}
          {row.representative
            ? <span className="text-gray-700">대표 {row.representative}</span>
            : (row.coOwnerCount ?? 0) > 1 && (
                <span className="px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">대표 미선임</span>
              )}
          {row.planChoice && <span className="text-gray-600">· {row.planChoice}</span>}
        </div>
      )}
    </div>
  );
});

/**
 * 전자동의 배지 — 읽기 전용이다.
 *
 * 옆의 PlanMiniToggle·IdReceivedCell은 클릭하면 시트에 쓰는 위젯이고, 그 값은 위원이
 * 손으로 체크한 종이 기록이다. 전자동의를 그 value에 섞으면 클릭 한 번에 종이 컬럼이
 * 덮인다. 그래서 두 경로는 화면에서 나란히 보여주되 저장은 끝까지 분리한다.
 */
function EBadge({ state, label = '전자' }: { state?: string; label?: string }) {
  if (state !== '완전' && state !== '일부') return null;
  const full = state === '완전';
  return (
    <span
      className={`shrink-0 text-[9px] px-1 py-0.5 rounded font-medium ${
        full ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
      }`}
      title={
        full
          ? '전자동의 제출 완료'
          : '공유자 일부만 전자서명 — 대표 선임/나머지 독려 대상'
      }
    >
      {full ? label : `${label}△`}
    </span>
  );
}

/**
 * 공유 세대 대표자 배지.
 *
 * 정비계획입안 동의서는 공유자 대표가 서명해야 유효하다. 대표가 없으면 동의 자체를
 * 시작할 수 없어 방문 전에 알아야 한다(명부 실측 공유 334세대 중 259세대가 미선임).
 *
 * 한 줄 안에 배지로만 둔다 — 줄을 늘리면 공유 세대만 행이 높아져 가상 스크롤의
 * 행 높이 가정이 깨지고 표가 다시 출렁인다.
 *
 * coOwnerCount는 전자동의 명부에서 온다. 명부 동기화 전에는 값이 없고,
 * 그때는 대표 선임 여부를 알 방법이 없으므로 아무것도 띄우지 않는다.
 */
function RepBadge({ row }: { row: UnifiedRow }) {
  if ((row.coOwnerCount ?? 0) <= 1) return null;
  const set = Boolean(row.representative);
  return (
    <span
      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
        set ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'
      }`}
      title={
        set
          ? `공유 ${row.coOwnerCount}인 · 대표 ${row.representative}`
          : `공유 ${row.coOwnerCount}인 · 대표 미선임 — 정비입안 동의서는 대표가 서명해야 유효하다`
      }
    >
      {set ? `대표 ${row.representative}` : '대표 미선임'}
    </span>
  );
}

// 전자동의로 제출한 세대는 신분증·개인정보를 온라인으로 처리한 것으로 본다(위원회 판단).
// 판정 근거는 unified-utils.ts의 hasIdVerified 주석 참고.
function eAccepted(row: UnifiedRow): boolean {
  return row.econsentSinto === '완전' || row.econsentPlan === '완전';
}

const DesktopRow = memo(function DesktopRow({
  row, surveyIds, showDong, onRowClick, onKakaoToggled, onAgeChanged, onPlanToggled,
}: RowProps) {
  // 동의는 종이·전자 합산 — 전자로만 낸 세대가 빨간 배경(미완료)으로 찍히면 안 된다.
  const doneCount =
    (hasSintoConsent(row) ? 1 : 0) + surveyIds.filter((id) => row.surveys[id]).length;
  const totalCount = 1 + surveyIds.length;
  const bg = rowBgClass(doneCount, totalCount);
  return (
    // data-row: 가상 스크롤이 실제 행 높이를 재는 표식 (패딩 행과 구분해야 한다)
    <tr data-row className={`h-[41px] border-b border-gray-100 hover:bg-gray-50 ${bg}`}>
      {showDong && (
        <td className="py-0 px-3 text-gray-400 text-xs overflow-hidden whitespace-nowrap">{row.dong}</td>
      )}
      <td className="py-0 px-3 font-medium overflow-hidden whitespace-nowrap">{row.ho}</td>
      <td className="py-0 px-3 text-gray-700 overflow-hidden whitespace-nowrap">
        <span className="flex items-center gap-1.5 flex-nowrap overflow-hidden" title={row.ownerName || undefined}>
          <span className="truncate">{row.ownerName}</span>
          {row.nameMismatch && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium" title={`동의서: ${row.consentName}`}>이름불일치</span>
          )}
          {row.rosterNameMismatch && (
            <span
              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium"
              title={`전자동의 명부: ${row.rosterName} — 소유권 이전 의심. 등기부로 확인 후 판단하세요.`}
            >
              명부 {row.rosterName}
            </span>
          )}
          <RepBadge row={row} />
          {row.opposition && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">반대</span>
          )}
        </span>
      </td>
      {/* 연락처는 대부분 "나영선 010-2150-9054"처럼 이름이 병기돼 있다.
          그대로 truncate하면 정작 필요한 번호 뒷자리가 잘리므로 번호를 앞세우고 이름은 뒤에 흐리게 둔다. */}
      <td className="py-0 px-3 text-xs text-gray-600 overflow-hidden whitespace-nowrap">
        <span className="block truncate" title={row.phone || undefined}>
          {splitContacts(row.phone || '').map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="text-gray-300"> / </span>}
              {c.number || c.name}
              {c.number && c.name && <span className="text-gray-400"> {c.name}</span>}
            </span>
          ))}
          {!row.phone && '-'}
        </span>
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <ResidencyBadge value={row.residency} />
      </td>
      {/* 체크는 종이·전자 합산(동의했는가). 경로는 옆 배지(전자)와 툴팁으로 구분하고 저장은 계속 분리 */}
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1"
          title={consentSource(row.consent, row.econsentSinto) || '미제출'}
        >
          <Check value={hasSintoConsent(row)} />
          <EBadge state={row.econsentSinto} />
        </span>
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <DonationBadge total={row.donationTotal ?? 0} count={row.donationCount ?? 0} />
      </td>
      {surveyIds.map((id) => (
        <td key={id} className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
          <Check value={row.surveys[id] ?? false} />
        </td>
      ))}
      {/* 편집 상자가 absolute로 뜨므로 overflow-hidden을 걸지 않는다 (걸면 잘림).
          내용은 MemoCell 안에서 truncate되고, table-layout:fixed라 열 너비는 안 벌어진다. */}
      <td className="py-0 px-3 whitespace-nowrap">
        <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <AgeSelect dong={row.dong} ho={row.ho} value={row.ageGroup ?? ''} onChanged={onAgeChanged} />
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <KakaoToggle dong={row.dong} ho={row.ho} value={row.kakaoGroup ?? false} onChanged={onKakaoToggled} />
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <PlanMiniToggle dong={row.dong} ho={row.ho} field="consent" label="동의서" value={row.planConsent ?? false} electronic={row.econsentPlan === '완전'} onChanged={onPlanToggled} />
          {row.econsentPlan === '일부' && <EBadge state="일부" />}
        </span>
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <PlanMiniToggle dong={row.dong} ho={row.ho} field="privacy" label="개인정보" value={row.privacyConsent ?? false} electronic={eAccepted(row)} onChanged={onPlanToggled} />
        </span>
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <IdReceivedCell row={row} onPlanToggled={onPlanToggled} />
        </span>
      </td>
      <td className="py-0 px-3 text-center overflow-hidden whitespace-nowrap">
        <EditButton onClick={() => onRowClick(row)} />
      </td>
    </tr>
  );
});

// 데스크톱 테이블 열 너비(px) — table-layout:fixed의 colgroup에 사용.
// 순서는 thead/DesktopRow의 td 순서와 정확히 일치해야 한다.
function buildColWidths(showDong: boolean, surveyIds: string[]): number[] {
  return [
    ...(showDong ? [48] : []),
    56,   // 호수
    190,  // 소유자 (+명부이름 배지)
    120,  // 연락처
    64,   // 실거주
    118,  // 신속통합동의서_제출 (+전자 배지)
    112,  // 후원금
    ...surveyIds.map(() => 90),
    170,  // 메모
    88,   // 연령대
    76,   // 단톡방
    128,  // 정비입안 동의서 (+전자 배지)
    128,  // 개인정보동의 (+전자 배지)
    152,  // 신분증 (+전자 배지)
    56,   // 수정
  ];
}

const ROW_H = 41;
const OVERSCAN = 8;

function UnifiedTableInner({ rows, resetKey, surveyIds, showDong, onRowClick, onKakaoToggled, onAgeChanged, onPlanToggled }: Props) {
  // 데스크톱/모바일 중 한쪽만 마운트 (둘 다 마운트 시 2,830행 이중 렌더로 느려짐). 기본 데스크톱.
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // 데스크톱 가상 스크롤 상태
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const rafRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  // 실제 행 높이. ROW_H는 초기 추정치일 뿐이고, 렌더 후 실측값으로 교정한다.
  //
  // 상수로 고정하면 실제 높이와 1px만 어긋나도 스크롤할 때마다 표 전체 높이가 출렁인다
  // (패딩은 N×가정값인데 렌더된 행은 실제값이라, 창이 밀릴 때마다 합이 달라진다).
  // border-collapse의 경계선이나 셀 내용 변화로 높이는 언제든 바뀔 수 있으므로 재서 쓴다.
  const [rowH, setRowH] = useState(ROW_H);

  // 필터/동이 바뀌면(resetKey 변경) 스크롤 리셋 + 뷰포트 높이 재측정.
  // rows를 의존성에 두면 토글 낙관적 업데이트마다 새 배열이 와서 스크롤이 맨 위로 튄다.
  useEffect(() => {
    if (!isDesktop) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    setScrollTop(0);
    setViewportH(el.clientHeight);
  }, [resetKey, isDesktop]);

  // 뷰포트 높이는 스크롤이 아니라 크기 변화에만 반응해야 한다.
  // 컨테이너가 calc(100vh - 260px)이라 창 크기 말고도 위쪽 필터 줄이 접히거나 늘어나면 바뀐다
  // → window resize만으로는 놓쳐서 ResizeObserver로 컨테이너 자체를 관찰한다.
  useEffect(() => {
    if (!isDesktop) return;
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop]);

  // 실제 행 높이 실측. 데이터 행에 data-row를 달아두고 첫 행을 잰다.
  // 값이 달라졌을 때만 state를 갱신해 렌더 루프를 만들지 않는다.
  useEffect(() => {
    if (!isDesktop) return;
    const tr = bodyRef.current?.querySelector<HTMLTableRowElement>('tr[data-row]');
    if (!tr) return;
    const h = tr.getBoundingClientRect().height;
    if (h > 0 && Math.abs(h - rowH) > 0.5) setRowH(h);
  });

  function onScroll() {
    const el = scrollRef.current;
    if (!el || rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      // 스크롤 중에는 scrollTop만 바뀐다. 여기서 clientHeight까지 매 프레임 재면
      // 가로 스크롤바가 생겼다 사라질 때 높이가 흔들리며 되먹임이 생긴다 → ResizeObserver에 맡긴다.
      setScrollTop(el.scrollTop);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        해당 조건의 세대가 없습니다.
      </div>
    );
  }

  // 모바일: 카드 리스트 (가상 스크롤 없음, content-visibility는 div라 안전)
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-2 -mx-1">
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
    );
  }

  // 데스크톱: 고정 높이 스크롤 컨테이너 + table-layout:fixed + 윈도잉
  const colWidths = buildColWidths(showDong, surveyIds);
  const colCount = colWidths.length;
  const minWidth = colWidths.reduce((a, b) => a + b, 0);

  const total = rows.length;
  const vh = viewportH || 800;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const visibleCount = Math.ceil(vh / rowH) + OVERSCAN * 2;
  const end = Math.min(total, start + visibleCount);
  const topPad = start * rowH;
  const botPad = (total - end) * rowH;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
      <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth }}>
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400 sticky top-0 bg-white z-10">
            {showDong && (
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">동</th>
            )}
            <th className="text-left py-2 px-3 font-medium whitespace-nowrap">호수</th>
            <th className="text-left py-2 px-3 font-medium whitespace-nowrap">소유자</th>
            <th className="text-left py-2 px-3 font-medium whitespace-nowrap">연락처</th>
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
        <tbody ref={bodyRef}>
          {topPad > 0 && (
            <tr aria-hidden style={{ height: topPad }}>
              <td colSpan={colCount} className="p-0 border-0" />
            </tr>
          )}
          {rows.slice(start, end).map((row) => (
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
          {botPad > 0 && (
            <tr aria-hidden style={{ height: botPad }}>
              <td colSpan={colCount} className="p-0 border-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const UnifiedTable = memo(UnifiedTableInner);
export default UnifiedTable;
