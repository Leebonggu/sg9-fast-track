'use client';

import { useEffect, useState } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import DonationPanel from './DonationPanel';
import IdUploadAdmin from './IdUploadAdmin';
import SurveyManualForm from '@/components/survey/SurveyManualForm';
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
  onConsentToggled?: (dong: string, ho: string, value: boolean) => void;
  onSurveyCompleted?: (dong: string, ho: string, displayId: string) => void;
  onPhoneChanged?: (dong: string, ho: string, phone: string) => void;
}

export default function EditRowModal({ row, onClose, onSaved, onDonationChanged, onKakaoToggled, onAgeChanged, onPlanToggled, onConsentToggled, onSurveyCompleted, onPhoneChanged }: Props) {
  const [phone, setPhone] = useState(row.phone ?? '');
  const [phoneSaving, setPhoneSaving] = useState(false);
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
  const [privacyConsent, setPrivacyConsent] = useState(row.privacyConsent ?? false);
  const [idReceived, setIdReceived] = useState(row.idReceived ?? false);
  const [planSaving, setPlanSaving] = useState<string | null>(null);
  const [consent, setConsent] = useState(row.consent ?? false);
  const [consentSaving, setConsentSaving] = useState(false);
  // v2에 제출 행이 없는 세대에서 수거 토글을 켰을 때 뜨는 확인 폼(성명·연락처). null이면 닫힘.
  const [consentEntry, setConsentEntry] = useState<{ name: string; phone: string } | null>(null);
  const [surveys, setSurveys] = useState<{ id: string; title: string; displayId?: string }[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<{ id: string; displayId: string; title: string } | null>(null);
  const [completedSurveys, setCompletedSurveys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [operatorName, setOperatorName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOperatorName(sessionStorage.getItem('operatorName') || '');
    }
  }, []);

  useEffect(() => {
    fetch('/api/survey')
      .then((r) => r.json())
      .then((d) => setSurveys(d.surveys ?? []))
      .catch(() => {});
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

  async function toggleConsent() {
    // row.dong은 "901"(동 없음), v2 시트명은 "901동" — 보정 안 하면 조용히 실패한다.
    const building = row.dong.endsWith('동') ? row.dong : `${row.dong}동`;
    setConsentSaving(true);
    try {
      const res = await adminFetch('/api/consent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building, unit: row.ho }),
      });
      const data = await res.json().catch(() => ({}));
      // 제출 이력이 없어 뒤집을 행이 없는 세대 — 성명 확인 후 수동입력(웹) 행을 새로 만든다.
      if (res.status === 404 && data.code === 'NO_ROW') {
        setConsentEntry({ name: ownerName.trim(), phone: phone.trim() });
        return;
      }
      if (!res.ok) { alert(data.error || '저장 실패'); return; }
      const newVal = data.collected ?? !consent;
      setConsent(newVal);
      onConsentToggled?.(row.dong, row.ho, newVal);
    } finally {
      setConsentSaving(false);
    }
  }

  // 확인 폼 제출 → v2 동별 시트에 수동입력(웹) 행 생성(수거 완료 상태)
  async function submitConsentEntry() {
    if (!consentEntry) return;
    const name = consentEntry.name.trim();
    if (!name) { alert('성명을 입력하세요'); return; }
    const building = row.dong.endsWith('동') ? row.dong : `${row.dong}동`;
    setConsentSaving(true);
    try {
      const res = await adminFetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building, unit: row.ho, name, collected: true, phone: consentEntry.phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || '등록 실패'); return; }
      setConsent(true);
      onConsentToggled?.(row.dong, row.ho, true);
      setConsentEntry(null);
    } finally {
      setConsentSaving(false);
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

  async function savePhone() {
    if (phone === (row.phone ?? '')) return;
    setPhoneSaving(true);
    try {
      const res = await adminFetch('/api/unified/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: row.dong, ho: row.ho, phone }),
      });
      if (!res.ok) { alert('연락처 저장 실패'); return; }
      onPhoneChanged?.(row.dong, row.ho, phone);
    } finally {
      setPhoneSaving(false);
    }
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

        {activeSurvey ? (
          <SurveyManualForm
            surveyId={activeSurvey.id}
            dong={row.dong}
            ho={row.ho}
            prefill={{ ownerName: row.ownerName, phone: row.phone }}
            operatorName={operatorName}
            onCancel={() => setActiveSurvey(null)}
            onSubmitted={() => {
              const key = activeSurvey.displayId;
              setCompletedSurveys((s) => new Set(s).add(key));
              onSurveyCompleted?.(row.dong, row.ho, key);
              setActiveSurvey(null);
            }}
          />
        ) : (
          <>
        <div className="mb-3 rounded bg-gray-50 border border-gray-200 px-2.5 py-2">
          <label className="block text-[11px] text-gray-400 mb-1">연락처</label>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={savePhone}
              inputMode="tel"
              placeholder="연락처 없음"
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={savePhone}
              disabled={phoneSaving || phone === (row.phone ?? '')}
              className="shrink-0 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {phoneSaving ? '저장 중…' : '저장'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">동별 시트가 아니라 통합현황에만 저장됩니다(동별 미기재 세대도 저장 가능). 다음 동기화에도 유지됩니다.</p>
        </div>

        <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">사전동의(신속통합동의서) 수거</span>
            <button
              type="button"
              onClick={toggleConsent}
              disabled={consentSaving || consentEntry !== null}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                consent ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  consent ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-blue-700 mt-1">⚠ v2 동별 시트에 직접 반영됩니다. 토글 즉시 저장.</p>

          {consentEntry && (
            <div className="mt-2 border-t border-blue-200 pt-2">
              <p className="text-[11px] text-gray-600 mb-2">
                v2 동별 시트에 제출 이력이 없는 세대입니다. 아래 정보로{' '}
                <span className="font-semibold">수동입력(웹)</span> 행을 새로 만들고 수거 완료로 기록합니다.
              </p>
              <label className="block text-[10px] text-gray-500 mb-0.5">성명</label>
              <input
                autoFocus
                value={consentEntry.name}
                onChange={(e) => setConsentEntry({ ...consentEntry, name: e.target.value })}
                placeholder="동의서에 기재된 성명"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-2 outline-none focus:border-blue-400"
              />
              <label className="block text-[10px] text-gray-500 mb-0.5">연락처</label>
              <input
                value={consentEntry.phone}
                onChange={(e) => setConsentEntry({ ...consentEntry, phone: e.target.value })}
                placeholder="010-0000-0000 (선택)"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-blue-400"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setConsentEntry(null)}
                  disabled={consentSaving}
                  className="flex-1 px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submitConsentEntry}
                  disabled={consentSaving || !consentEntry.name.trim()}
                  className="flex-1 px-3 py-1.5 text-sm rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {consentSaving ? '등록 중…' : '수거 등록'}
                </button>
              </div>
            </div>
          )}
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
                kakaoGroup ? 'bg-blue-600' : 'bg-gray-200'
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">정비계획 입안 제안 동의서</span>
            <button
              type="button"
              onClick={() => togglePlan('consent', planConsent, setPlanConsent)}
              disabled={planSaving === 'consent'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                planConsent ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  planConsent ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">오프라인 수령 시 체크. 토글 즉시 저장됩니다.</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">개인정보 수집·제공 동의</span>
            <button
              type="button"
              onClick={() => togglePlan('privacy', privacyConsent, setPrivacyConsent)}
              disabled={planSaving === 'privacy'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                privacyConsent ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  privacyConsent ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">재건축 과정 정보제공 동의. 오프라인 수령 시 체크.</p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">신분증사본 수령 (오프라인 종이)</span>
            <button
              type="button"
              onClick={() => togglePlan('id', idReceived, setIdReceived)}
              disabled={planSaving === 'id'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                idReceived ? 'bg-blue-600' : 'bg-gray-200'
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

        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">설문 수동입력</p>
          {surveys.length === 0 ? (
            <p className="text-[11px] text-gray-400">등록된 설문 없음</p>
          ) : (
            <div className="space-y-1.5">
              {surveys.map((s) => {
                const key = s.displayId ?? s.id;
                const done = !!row.surveys[key] || completedSurveys.has(key);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-700 flex-1 truncate">
                      {s.title}
                      {done ? (
                        <span className="ml-1 text-[10px] text-green-600">✓완료</span>
                      ) : (
                        <span className="ml-1 text-[10px] text-gray-400">미입력</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSurvey({ id: s.id, displayId: s.displayId ?? s.id, title: s.title })
                      }
                      className="shrink-0 text-[11px] text-blue-600 underline"
                    >
                      입력
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DonationPanel
          dong={row.dong}
          ho={row.ho}
          onChanged={(total, count) => onDonationChanged?.(row.dong, row.ho, total, count)}
        />
          </>
        )}
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
