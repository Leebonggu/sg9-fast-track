'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BUILDING_CONFIG } from '@/lib/buildings';
import AdminLayout from '@/components/AdminLayout';

type SurveyQuestion = {
  id: string;
  label: string;
  description?: string;
  options: string[];
};

type BasicInfoFieldMeta = {
  key: string;
  sheetColumn: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
  required: boolean;
};

type SurveyConfigMeta = {
  id: string;
  title: string;
  organizer: string;
  basicInfoFields: BasicInfoFieldMeta[];
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
  const [selectedDong, setSelectedDong] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

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

  const dongList = useMemo(() => Object.keys(BUILDING_CONFIG), []);

  const floorList = useMemo(() => {
    if (!selectedDong || !BUILDING_CONFIG[selectedDong]) return [];
    const { floors } = BUILDING_CONFIG[selectedDong];
    return Array.from({ length: floors }, (_, i) => i + 1);
  }, [selectedDong]);

  const hoList = useMemo(() => {
    if (!selectedDong || !selectedFloor || !BUILDING_CONFIG[selectedDong]) return [];
    const { units, excludedUnits } = BUILDING_CONFIG[selectedDong];
    const floor = parseInt(selectedFloor, 10);
    return units
      .map((u) => `${floor}${String(u).padStart(2, '0')}`)
      .filter((ho) => !excludedUnits?.includes(ho));
  }, [selectedDong, selectedFloor]);

  function handleDongChange(dong: string) {
    setSelectedDong(dong);
    setSelectedFloor('');
    setBasicInfo((prev) => ({ ...prev, dong, ho: '' }));
  }

  function handleFloorChange(floor: string) {
    setSelectedFloor(floor);
    setBasicInfo((prev) => ({ ...prev, ho: '' }));
  }

  function handleHoChange(ho: string) {
    setBasicInfo((prev) => ({ ...prev, ho }));
  }

  function handleBasicInfoChange(key: string, value: string) {
    if (key === 'name') value = value.slice(0, 5);
    else if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 11);
    setBasicInfo((prev) => ({ ...prev, [key]: value }));
  }

  function handleAnswerChange(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  function resetForm() {
    setBasicInfo({});
    setSelectedDong('');
    setSelectedFloor('');
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
            {/* 기본정보 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-[#2F5496] text-base">기본정보</h2>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>동 <span className="text-red-400">*</span></label>
                  <select
                    value={selectedDong}
                    onChange={(e) => handleDongChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">동 선택</option>
                    {dongList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>층 <span className="text-red-400">*</span></label>
                  <select
                    value={selectedFloor}
                    onChange={(e) => handleFloorChange(e.target.value)}
                    disabled={!selectedDong}
                    className={selectClass + (!selectedDong ? ' opacity-40' : '')}
                  >
                    <option value="">층 선택</option>
                    {floorList.map((f) => (
                      <option key={f} value={String(f)}>{f}층</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>호수 <span className="text-red-400">*</span></label>
                  <select
                    value={basicInfo.ho || ''}
                    onChange={(e) => handleHoChange(e.target.value)}
                    disabled={!selectedFloor}
                    className={selectClass + (!selectedFloor ? ' opacity-40' : '')}
                  >
                    <option value="">호 선택</option>
                    {hoList.map((h) => (
                      <option key={h} value={h}>{h}호</option>
                    ))}
                  </select>
                </div>
              </div>

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
                      maxLength={field.key === 'name' ? 5 : field.key === 'phone' ? 11 : undefined}
                      className={inputClass}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 질문 */}
            {config.questions.map((q, qi) => (
              <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="font-bold text-base text-gray-800 leading-snug mb-1">
                  {qi + 1}. {q.label}
                  <span className="text-red-400 ml-1">*</span>
                </p>
                {q.description && (
                  <p className="text-sm text-gray-400 mb-3 whitespace-pre-line leading-relaxed">
                    {q.description}
                  </p>
                )}
                <div className="space-y-2 mt-3">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        answers[q.id] === opt
                          ? 'border-[#2F5496] bg-[#2F5496]/5'
                          : 'border-gray-100 bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 shrink-0 transition-colors ${
                          answers[q.id] === opt ? 'border-[#2F5496]' : 'border-gray-300'
                        }`}
                      >
                        {answers[q.id] === opt && (
                          <div className="w-3 h-3 rounded-full bg-[#2F5496]" />
                        )}
                      </div>
                      <span className="text-base leading-snug">{opt}</span>
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => handleAnswerChange(q.id, opt)}
                        className="hidden"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}

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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <p className="text-lg font-bold text-gray-800 mb-2">이미 제출된 호수입니다</p>
              <p className="text-sm text-gray-500 mb-5">
                {basicInfo.dong} {basicInfo.ho}호는 이미 응답 이력이 있습니다.{'\n'}
                그래도 저장하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDuplicateWarning(false)}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-600"
                >
                  취소
                </button>
                <button
                  onClick={() => { setShowDuplicateWarning(false); doSubmit(true); }}
                  className="flex-1 py-3 bg-[#2F5496] text-white rounded-xl text-base font-semibold"
                >
                  그래도 저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
