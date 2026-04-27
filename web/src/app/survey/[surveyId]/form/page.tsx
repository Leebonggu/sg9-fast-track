'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useBuildingSelector } from '@/hooks/useBuildingSelector';
import { BuildingSelector } from '@/components/survey/BuildingSelector';
import { SurveyQuestionList } from '@/components/survey/SurveyQuestionList';
import { DuplicateWarningModal } from '@/components/survey/DuplicateWarningModal';
import type { SurveyQuestion, BasicInfoField } from '@/lib/surveys/types';

type SurveyConfigMeta = {
  id: string;
  title: string;
  organizer: string;
  intro: string;
  notice: string;
  basicInfoFields: BasicInfoField[];
  questions: SurveyQuestion[];
  isClosed: boolean;
  closedAt: string;
};

export default function SurveyFormPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [config, setConfig] = useState<SurveyConfigMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateHint, setDuplicateHint] = useState(false);
  const submittingRef = useRef(false);

  const [basicInfo, setBasicInfo] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const {
    selectedDong,
    selectedFloor,
    dongList,
    floorList,
    hoList,
    handleDongChange,
    handleFloorChange,
    handleHoChange: baseHandleHoChange,
  } = useBuildingSelector(setBasicInfo);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  useEffect(() => {
    if (!submitted) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [submitted]);

  async function loadConfig() {
    try {
      const res = await fetch(`/api/survey/${surveyId}/config`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
    } catch {
      setError('설문 정보를 불러올 수 없습니다.');
    }
    setLoading(false);
  }

  function handleHoChange(ho: string) {
    baseHandleHoChange(ho);
    setDuplicateHint(false);
    if (selectedDong && ho) {
      fetch(`/api/survey/${surveyId}/check-duplicate?dong=${encodeURIComponent(selectedDong)}&ho=${encodeURIComponent(ho)}`)
        .then((res) => res.json())
        .then((data) => { if (data.duplicate) setDuplicateHint(true); })
        .catch(() => {});
    }
  }

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
        body: JSON.stringify({ basicInfo, answers, forceSubmit }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setShowDuplicateWarning(true);
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      if (data.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <p className="text-red-500">{error || '설문을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  if (config.isClosed) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 text-center max-w-sm shadow-2xl">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">설문이 마감되었습니다</h2>
          <p className="text-gray-500 text-sm">{config.title}</p>
          {config.closedAt && (
            <p className="text-xs text-gray-400 mt-2">
              마감일: {new Date(config.closedAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 text-center max-w-sm shadow-2xl">
          <div className="text-6xl mb-4 text-green-500">✓</div>
          <h2 className="text-xl font-bold text-[#2F5496] mb-2">제출 완료</h2>
          <p className="text-gray-500">설문에 참여해 주셔서 감사합니다.</p>
        </div>
      </div>
    );
  }

  const otherBasicFields = config.basicInfoFields.filter((f) => !['dong', 'ho'].includes(f.key));
  const selectClass =
    'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496] bg-white appearance-none';
  const inputClass =
    'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496]';
  const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#2F5496] text-white px-4 py-5 text-center">
        <h1 className="text-xl font-bold leading-snug">{config.title}</h1>
        <p className="text-sm text-white/70 mt-1">{config.organizer}</p>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-10">
        {config.intro && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-base text-gray-600 leading-relaxed whitespace-pre-line">
              {config.intro}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-[#2F5496] text-base">기본정보</h2>

          <BuildingSelector
            selectedDong={selectedDong}
            selectedFloor={selectedFloor}
            selectedHo={basicInfo.ho || ''}
            dongList={dongList}
            floorList={floorList}
            hoList={hoList}
            onDongChange={handleDongChange}
            onFloorChange={handleFloorChange}
            onHoChange={handleHoChange}
          />

          {duplicateHint && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              이미 응답 이력이 있는 호수입니다. 재제출 시 중복 데이터로 기록됩니다.
            </p>
          )}

          {otherBasicFields.map((field) => (
            <div key={field.key}>
              <label className={labelClass}>
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  value={basicInfo[field.key] || ''}
                  onChange={(e) => handleBasicInfoChange(field.key, e.target.value)}
                  className={selectClass}
                >
                  <option value="">선택하세요</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <div>
                  <input
                    type={field.key === 'phone' ? 'tel' : 'text'}
                    value={basicInfo[field.key] || ''}
                    onChange={(e) => handleBasicInfoChange(field.key, e.target.value)}
                    placeholder={field.key === 'phone' ? '01012345678' : `${field.label} 입력`}
                    maxLength={field.key === 'phone' ? 11 : undefined}
                    className={inputClass}
                  />
                  {field.key === 'name' && (basicInfo.name?.length ?? 0) > 5 && (
                    <p className="text-sm text-red-500 mt-1">이름은 5자 이내로 입력해 주세요.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <SurveyQuestionList
          questions={config.questions}
          answers={answers}
          onChange={(id, opt) => setAnswers((prev) => ({ ...prev, [id]: opt }))}
        />

        {config.notice && (
          <p className="text-sm text-gray-400 text-center whitespace-pre-line leading-relaxed px-2">
            {config.notice}
          </p>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-base text-center">
            {error}
          </div>
        )}

        <button
          onClick={() => doSubmit(false)}
          disabled={submitting}
          className="w-full py-4 bg-[#2F5496] text-white rounded-2xl text-lg font-bold disabled:opacity-50 active:bg-[#1e3a6e] transition-colors"
        >
          {submitting ? '제출 중...' : '제출하기'}
        </button>
      </div>

      {showDuplicateWarning && (
        <DuplicateWarningModal
          dong={basicInfo.dong}
          ho={basicInfo.ho}
          confirmLabel="그래도 제출"
          onCancel={() => setShowDuplicateWarning(false)}
          onConfirm={() => { setShowDuplicateWarning(false); doSubmit(true); }}
        />
      )}
    </div>
  );
}
