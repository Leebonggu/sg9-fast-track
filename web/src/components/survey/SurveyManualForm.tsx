'use client';

import { useState, useEffect, useRef } from 'react';
import { SurveyQuestionList } from '@/components/survey/SurveyQuestionList';
import { DuplicateWarningModal } from '@/components/survey/DuplicateWarningModal';
import type { SurveyQuestion, BasicInfoField } from '@/lib/surveys/types';

type SurveyConfigMeta = {
  id: string;
  title: string;
  basicInfoFields: BasicInfoField[];
  questions: SurveyQuestion[];
  isClosed?: boolean;
};

interface Props {
  surveyId: string; // 라우트 id (displayId 아님)
  dong: string;
  ho: string;
  prefill?: { ownerName?: string; phone?: string };
  operatorName: string;
  onCancel: () => void; // ← 뒤로
  onSubmitted: () => void; // 저장 성공
}

export default function SurveyManualForm({
  surveyId,
  dong,
  ho,
  prefill,
  operatorName,
  onCancel,
  onSubmitted,
}: Props) {
  const [config, setConfig] = useState<SurveyConfigMeta | null>(null);
  const [loadError, setLoadError] = useState('');
  const [basicInfo, setBasicInfo] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDuplicate, setShowDuplicate] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setBasicInfo({
      dong,
      ho,
      ...(prefill?.ownerName ? { name: prefill.ownerName } : {}),
      ...(prefill?.phone ? { phone: prefill.phone } : {}),
    });
    (async () => {
      try {
        const res = await fetch(`/api/survey/${surveyId}/config`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setConfig(data.config);
      } catch {
        setLoadError('설문 정보를 불러올 수 없습니다.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  function handleBasicInfoChange(key: string, value: string) {
    if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 11);
    setBasicInfo((prev) => ({ ...prev, [key]: value }));
  }

  async function doSubmit(forceSubmit = false) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/survey/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basicInfo, answers, forceSubmit, isManual: true, operatorName }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setShowDuplicate(true);
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      if (data.error) throw new Error(data.error);
      onSubmitted();
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  const headerRow = (
    <div className="flex items-center gap-2 mb-3">
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 text-xs text-gray-600 hover:text-gray-800"
      >
        ← 뒤로
      </button>
      <span className="text-sm font-semibold text-gray-800 truncate">{config?.title ?? '설문 입력'}</span>
    </div>
  );

  if (loadError) {
    return (
      <div>
        {headerRow}
        <p className="text-sm text-red-500">{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        {headerRow}
        <p className="text-sm text-gray-400">불러오는 중…</p>
      </div>
    );
  }

  const otherBasicFields = config.basicInfoFields.filter((f) => !['dong', 'ho'].includes(f.key));
  const inputClass =
    'w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400';

  return (
    <div>
      {headerRow}

      <div className="rounded bg-blue-50 border border-blue-200 px-2.5 py-2 mb-3">
        <span className="text-[11px] text-blue-600">대상 세대</span>{' '}
        <span className="text-sm font-semibold text-gray-800">
          {dong}동 {ho}호
        </span>
        <span className="text-[11px] text-blue-600"> (고정)</span>
      </div>

      {otherBasicFields.length > 0 && (
        <div className="space-y-2 mb-3">
          {otherBasicFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-500 mb-1">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  value={basicInfo[field.key] || ''}
                  onChange={(e) => handleBasicInfoChange(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">선택하세요</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.key === 'phone' ? 'tel' : 'text'}
                  value={basicInfo[field.key] || ''}
                  onChange={(e) => handleBasicInfoChange(field.key, e.target.value)}
                  placeholder={field.key === 'phone' ? '01012345678' : `${field.label} 입력`}
                  maxLength={field.key === 'phone' ? 11 : undefined}
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 [&_.rounded-2xl]:rounded-lg">
        <SurveyQuestionList
          questions={config.questions}
          answers={answers}
          onChange={(id, opt) => setAnswers((prev) => ({ ...prev, [id]: opt }))}
        />
      </div>

      {error && (
        <div className="mt-3 p-2.5 rounded bg-red-50 text-red-600 text-sm text-center">{error}</div>
      )}

      <button
        type="button"
        onClick={() => doSubmit(false)}
        disabled={submitting}
        className="mt-3 w-full py-2.5 bg-[#2F5496] text-white rounded-lg text-sm font-semibold disabled:opacity-50 active:bg-[#1e3a6e] transition-colors"
      >
        {submitting ? '저장 중…' : '응답 저장'}
      </button>

      {showDuplicate && (
        <DuplicateWarningModal
          dong={dong}
          ho={ho}
          confirmLabel="그래도 저장"
          onCancel={() => setShowDuplicate(false)}
          onConfirm={() => {
            setShowDuplicate(false);
            doSubmit(true);
          }}
        />
      )}
    </div>
  );
}
