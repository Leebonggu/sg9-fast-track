'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { BUILDING_CONFIG } from '@/lib/buildings';

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
  intro: string;
  notice: string;
  basicInfoFields: BasicInfoFieldMeta[];
  questions: SurveyQuestion[];
};

export default function SurveyFormPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [config, setConfig] = useState<SurveyConfigMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [basicInfo, setBasicInfo] = useState<Record<string, string>>({});
  const [selectedDong, setSelectedDong] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
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
      setError('설문 정보를 불러올 수 없습니다.');
    }
    setLoading(false);
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
    setBasicInfo((prev) => ({ ...prev, [key]: value }));
  }

  function handleAnswerChange(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/survey/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basicInfo, answers }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    }
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

  const otherBasicFields = config.basicInfoFields.filter(
    (f) => !['dong', 'ho'].includes(f.key),
  );

  const selectClass =
    'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496] bg-white appearance-none';
  const inputClass =
    'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496]';
  const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-[#2F5496] text-white px-4 py-5 text-center">
        <h1 className="text-xl font-bold leading-snug">{config.title}</h1>
        <p className="text-sm text-white/70 mt-1">{config.organizer}</p>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-10">
        {/* 안내문 */}
        {config.intro && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-base text-gray-600 leading-relaxed whitespace-pre-line">
              {config.intro}
            </p>
          </div>
        )}

        {/* 기본정보 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-[#2F5496] text-base">기본정보</h2>

          {/* 동/층/호 — 3개 나란히 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>
                동 <span className="text-red-400">*</span>
              </label>
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
              <label className={labelClass}>
                층 <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedFloor}
                onChange={(e) => handleFloorChange(e.target.value)}
                disabled={!selectedDong}
                className={selectClass + ((!selectedDong) ? ' opacity-40' : '')}
              >
                <option value="">층 선택</option>
                {floorList.map((f) => (
                  <option key={f} value={String(f)}>{f}층</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                호수 <span className="text-red-400">*</span>
              </label>
              <select
                value={basicInfo.ho || ''}
                onChange={(e) => handleHoChange(e.target.value)}
                disabled={!selectedFloor}
                className={selectClass + ((!selectedFloor) ? ' opacity-40' : '')}
              >
                <option value="">호 선택</option>
                {hoList.map((h) => (
                  <option key={h} value={h}>{h}호</option>
                ))}
              </select>
            </div>
          </div>

          {/* 나머지 기본정보 */}
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
                  placeholder={field.key === 'phone' ? '010-0000-0000' : `${field.label} 입력`}
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

        {/* 하단 안내 */}
        {config.notice && (
          <p className="text-sm text-gray-400 text-center whitespace-pre-line leading-relaxed px-2">
            {config.notice}
          </p>
        )}

        {/* 에러 */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-base text-center">
            {error}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-[#2F5496] text-white rounded-2xl text-lg font-bold disabled:opacity-50 active:bg-[#1e3a6e] transition-colors"
        >
          {submitting ? '제출 중...' : '제출하기'}
        </button>
      </div>
    </div>
  );
}
