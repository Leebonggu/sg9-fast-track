'use client';

import { useEffect, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import DonationPanel from './DonationPanel';
import IdUploadAdmin from './IdUploadAdmin';
import { adminFetch } from '@/lib/admin-fetch';
import { AGE_GROUP_OPTIONS } from '@/lib/unified-utils';

interface Props {
  row: UnifiedRow;
  onClose: () => void;
  onSaved?: () => void;
  onDonationChanged?: (dong: string, ho: string, total: number, count: number) => void;
  onKakaoToggled?: (dong: string, ho: string, value: boolean) => void;
  onAgeChanged?: (dong: string, ho: string, value: string) => void;
  onPlanToggled?: (dong: string, ho: string, field: 'consent' | 'privacy' | 'id', value: boolean) => void;
}

export default function EditRowModal({ row, onClose, onSaved, onDonationChanged, onKakaoToggled, onAgeChanged, onPlanToggled }: Props) {
  const [ownerName, setOwnerName] = useState(row.ownerName ?? '');
  const [postalCode, setPostalCode] = useState(row.postalCode ?? '');
  const [address, setAddress] = useState(row.address ?? '');
  const [residency, setResidency] = useState(row.residency ?? '');
  const [opposition, setOpposition] = useState(row.opposition ?? false);
  const [oppositionSaving, setOppositionSaving] = useState(false);
  const [kakaoGroup, setKakaoGroup] = useState(row.kakaoGroup ?? false);
  const [kakaoSaving, setKakaoSaving] = useState(false);
  const [ageGroup, setAgeGroup] = useState(row.ageGroup ?? '');
  const [ageSaving, setAgeSaving] = useState(false);
  const [planConsent, setPlanConsent] = useState(row.planConsent ?? false);
  const [planPrivacy, setPlanPrivacy] = useState(row.planPrivacy ?? false);
  const [idReceived, setIdReceived] = useState(row.idReceived ?? false);
  const [planSaving, setPlanSaving] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [operatorName, setOperatorName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOperatorName(sessionStorage.getItem('operatorName') || '');
    }
  }, []);

  function buildDiff() {
    const overrides: Record<string, string> = {};
    if (ownerName !== (row.ownerName ?? '')) overrides.ownerName = ownerName;
    if (postalCode !== (row.postalCode ?? '')) overrides.postalCode = postalCode;
    if (address !== (row.address ?? '')) overrides.address = address;
    if (residency !== (row.residency ?? '')) overrides.residency = residency;
    return overrides;
  }

  async function save() {
    const overrides = buildDiff();
    if (Object.keys(overrides).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch('/api/unified/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, overrides, operatorName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '저장 실패');
        return;
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function toggleOpposition() {
    const newVal = !opposition;
    setOppositionSaving(true);
    try {
      await adminFetch('/api/unified/opposition', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, opposition: newVal }),
      });
      setOpposition(newVal);
      onSaved?.();
    } finally {
      setOppositionSaving(false);
    }
  }

  async function toggleKakao() {
    const newVal = !kakaoGroup;
    setKakaoSaving(true);
    try {
      const res = await adminFetch('/api/unified/kakao-group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, kakaoGroup: newVal }),
      });
      if (!res.ok) { alert('저장 실패'); return; }
      setKakaoGroup(newVal);
      onKakaoToggled?.(row.dong, row.ho, newVal);
    } finally {
      setKakaoSaving(false);
    }
  }

  async function changeAge(newVal: string) {
    if (newVal === ageGroup) return;
    const prev = ageGroup;
    setAgeGroup(newVal);
    setAgeSaving(true);
    try {
      const res = await adminFetch('/api/unified/age', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, ageGroup: newVal }),
      });
      if (!res.ok) { setAgeGroup(prev); alert('저장 실패'); return; }
      onAgeChanged?.(row.dong, row.ho, newVal);
    } catch {
      setAgeGroup(prev);
    } finally {
      setAgeSaving(false);
    }
  }

  async function togglePlan(field: 'consent' | 'privacy' | 'id', current: boolean, setter: (v: boolean) => void) {
    const newVal = !current;
    setPlanSaving(field);
    try {
      const res = await adminFetch('/api/unified/plan-tracking', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, field, value: newVal }),
      });
      if (!res.ok) { alert('저장 실패'); return; }
      setter(newVal);
      onPlanToggled?.(row.dong, row.ho, field, newVal);
    } finally { setPlanSaving(null); }
  }

  const diffCount = Object.keys(buildDiff()).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            {row.dong}동 {row.ho}호 수정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 -mr-2"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="mb-3 rounded bg-gray-50 border border-gray-200 px-2.5 py-2">
          <span className="text-[11px] text-gray-400">연락처</span>{' '}
          <span className="text-sm text-gray-700 font-medium break-all">{row.phone || '없음'}</span>
          <p className="text-[10px] text-gray-400 mt-0.5">동별 시트에서 자동 동기화 (여기서 수정 불가)</p>
        </div>

        <h3 className="text-xs font-semibold text-gray-500 mb-2">소유자 정보 수정</h3>
        <div className="space-y-3">
          <Field
            label="소유자명"
            value={ownerName}
            onChange={setOwnerName}
            help="여러 명은 콤마(,)로 구분 — 최대 5명"
          />
          <Field
            label="우편번호"
            value={postalCode}
            onChange={setPostalCode}
            inputMode="numeric"
            maxLength={5}
            help="5자리, leading-zero 자동 보정"
          />
          <Field label="대표주소" value={address} onChange={setAddress} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">실거주여부</label>
            <select
              value={residency}
              onChange={(e) => setResidency(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">(빈값)</option>
              <option value="실거주">실거주</option>
              <option value="임대">임대</option>
            </select>
          </div>
        </div>

        <IdUploadAdmin dong={row.dong} ho={row.ho} />

        <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2.5 py-2">
          <p className="text-[11px] text-amber-800 leading-snug">
            ⚠ <b>원본 시트가 직접 수정됩니다.</b> 변경 이력(시각/이전값/새값/수정자)은 <b>변경로그</b> 시트에 자동 기록됩니다.
          </p>
          <p className="text-[10px] text-amber-700 mt-1">
            수정자: <b>{operatorName || '(이름 미입력 — IP로 기록됨)'}</b>
          </p>
        </div>

        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">
            {diffCount === 0 ? '변경 없음' : `${diffCount}개 필드 변경됨`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving || diffCount === 0}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">재건축 반대 의사</span>
            <button
              type="button"
              onClick={toggleOpposition}
              disabled={oppositionSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                opposition ? 'bg-red-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  opposition ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {opposition && (
            <p className="text-[10px] text-red-500 mt-0.5">반대 의사 세대로 표시됩니다.</p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">토글 즉시 저장됩니다 (위 저장 버튼과 무관).</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">단톡방 참여</span>
            <button
              type="button"
              onClick={toggleKakao}
              disabled={kakaoSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                kakaoGroup ? 'bg-green-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  kakaoGroup ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">토글 즉시 저장됩니다.</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">연령대</span>
            <select
              value={ageGroup}
              disabled={ageSaving}
              onChange={(e) => changeAge(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400 disabled:opacity-50"
            >
              {AGE_GROUP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt || '미지정'}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">선택 즉시 저장됩니다. (설문 시드값, 위원이 정정 가능)</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">정비계획 입안 제안</h3>
          {([
            { field: 'consent' as const, label: '동의서', value: planConsent, setter: setPlanConsent },
            { field: 'privacy' as const, label: '개인정보동의', value: planPrivacy, setter: setPlanPrivacy },
          ]).map(({ field, label, value, setter }) => (
            <div key={field} className="flex items-center justify-between py-1">
              <span className="text-xs text-gray-500">{label}</span>
              <button
                type="button"
                onClick={() => togglePlan(field, value, setter)}
                disabled={planSaving === field}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  value ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 mt-1">오프라인 수령 시 체크. 토글 즉시 저장됩니다.</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">신분증사본 수령 (오프라인 종이)</span>
            <button
              type="button"
              onClick={() => togglePlan('id', idReceived, setIdReceived)}
              disabled={planSaving === 'id'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                idReceived ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  idReceived ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">온라인 업로드분(위 신분증 패널)도 수령으로 자동 인정됩니다. 이 토글은 오프라인 종이 수령용.</p>
        </div>

        <DonationPanel
          dong={row.dong}
          ho={row.ho}
          onChanged={(total, count) => onDonationChanged?.(row.dong, row.ho, total, count)}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  maxLength,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {help && <p className="text-[10px] text-gray-400 mt-0.5">{help}</p>}
    </div>
  );
}
