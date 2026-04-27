'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { useBuildingSelector } from '@/hooks/useBuildingSelector';
import { BuildingSelector } from '@/components/survey/BuildingSelector';
import { SurveyQuestionList } from '@/components/survey/SurveyQuestionList';
import { DuplicateWarningModal } from '@/components/survey/DuplicateWarningModal';
import type { SurveyQuestion, BasicInfoField } from '@/lib/surveys/types';

type SurveyConfigMeta = {
  id: string;
  title: string;
  organizer: string;
  basicInfoFields: BasicInfoField[];
  questions: SurveyQuestion[];
};

export default function ManualInputPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [config, setConfig] = useState<SurveyConfigMeta | null>(null);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [error, setError] = useState('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [operatorName, setOperatorName] = useState('');
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
    handleHoChange,
    reset,
  } = useBuildingSelector(setBasicInfo);

  useEffect(() => {
    const stored = sessionStorage.getItem('operatorName') || '';
    setOperatorName(stored);
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  async function loadConfig() {
    try {
      const res = await fetch(`/api/survey/${surveyId}/config`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
    } catch {
      setLoadError('설문 정보를 불러올 수 없습니다.');
    }
  }

  function handleBasicInfoChange(key: string, value: string) {
    if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 11);
    setBasicInfo((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setBasicInfo({});
    reset();
    setAnswers({});
    setError('');
    setSubmitted(false);
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
        body: JSON.stringify({
          basicInfo,
          answers,
          forceSubmit,
          isManual: true,
          operatorName,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setShowDuplicateWarning(true);
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      if (data.error) throw new Error(data.error);
      setSubmitCount((c) => c + 1);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  if (loadError || (!config && !loadError)) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          {loadError ? (
            <p className="text-red-500">{loadError}</p>
          ) : (
            <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin" />
          )}
        </div>
      </AdminLayout>
    );
  }

  if (!config) return null;

  const selectClass =
    'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496] bg-white appearance-none';
  const inputClass =
    'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496]';
  const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';
  const otherBasicFields = config.basicInfoFields.filter((f) => !['dong', 'ho'].includes(f.key));

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-10">
        <header className="bg-[#2F5496] text-white px-4 py-4 sticky top-0 z-40">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/survey/${surveyId}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 text-base shrink-0"
            >
              ←
            </Link>
            <span className="font-semibold truncate flex-1">{config.title}</span>
            <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full shrink-0">
              수동 입력
            </span>
          </div>
          <p className="text-xs text-white/60 pl-10">
            입력자: <span className="text-white/90 font-medium">{operatorName || '(이름 없음)'}</span>
            {submitCount > 0 && (
              <span className="ml-3 bg-white/20 px-2 py-0.5 rounded-full">
                이번 세션 {submitCount}건 입력
              </span>
            )}
          </p>
        </header>

        {submitted ? (
          <div className="max-w-xl mx-auto p-4 pt-10 text-center">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="text-5xl text-green-500 mb-3">✓</div>
              <p className="font-bold text-lg text-gray-800 mb-1">입력 완료</p>
              <p className="text-sm text-gray-400 mb-6">
                {basicInfo.dong} {basicInfo.ho}호 응답이 저장되었습니다.
              </p>
              <button
                onClick={resetForm}
                className="w-full py-3.5 bg-[#2F5496] text-white rounded-xl font-semibold mb-3"
              >
                계속 입력
              </button>
              <Link
                href={`/survey/${surveyId}`}
                className="block w-full py-3.5 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-center"
              >
                관리 페이지로
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-xl mx-auto p-4 space-y-4">
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

            <SurveyQuestionList
              questions={config.questions}
              answers={answers}
              onChange={(id, opt) => setAnswers((prev) => ({ ...prev, [id]: opt }))}
            />

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
              {submitting ? '저장 중...' : '오프라인 응답 저장'}
            </button>
          </div>
        )}

        {showDuplicateWarning && (
          <DuplicateWarningModal
            dong={basicInfo.dong}
            ho={basicInfo.ho}
            confirmLabel="그래도 저장"
            onCancel={() => setShowDuplicateWarning(false)}
            onConfirm={() => { setShowDuplicateWarning(false); doSubmit(true); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
