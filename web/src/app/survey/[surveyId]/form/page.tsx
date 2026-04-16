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

  // 기본정보
  const [basicInfo, setBasicInfo] = useState<Record<string, string>>({});
  // 동/층/호 캐스케이딩
  const [selectedDong, setSelectedDong] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  // 답변
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

  // 동 목록
  const dongList = useMemo(() => Object.keys(BUILDING_CONFIG), []);

  // 선택된 동의 층 목록
  const floorList = useMemo(() => {
    if (!selectedDong || !BUILDING_CONFIG[selectedDong]) return [];
    const { floors } = BUILDING_CONFIG[selectedDong];
    return Array.from({ length: floors }, (_, i) => i + 1);
  }, [selectedDong]);

  // 선택된 동+층의 호수 목록
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
        <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
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
          <div className="text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold text-[#2F5496] mb-2">제출 완료</h2>
          <p className="text-gray-500 text-sm">설문에 참여해 주셔서 감사합니다.</p>
        </div>
      </div>
    );
  }

  // 동/호를 제외한 기본정보 필드
  const otherBasicFields = config.basicInfoFields.filter(
    (f) => !['dong', 'ho'].includes(f.key),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-[#2F5496] text-white p-4 text-center">
        <h1 className="text-lg font-bold">{config.title}</h1>
        <p className="text-xs text-white/70 mt-1">{config.organizer}</p>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* 안내문 */}
        {config.intro && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 whitespace-pre-line">{config.intro}</p>
          </div>
        )}

        {/* 기본정보 */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-[#2F5496] text-sm">기본정보</h2>

          {/* 동 선택 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              동 <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedDong}
              onChange={(e) => handleDongChange(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2F5496]"
            >
              <option value="">동을 선택하세요</option>
              {dongList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 층 선택 */}
          {selectedDong && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                층 <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedFloor}
                onChange={(e) => handleFloorChange(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2F5496]"
              >
                <option value="">층을 선택하세요</option>
                {floorList.map((f) => (
                  <option key={f} value={String(f)}>
                    {f}층
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 호수 선택 */}
          {selectedFloor && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                호수 <span className="text-red-400">*</span>
              </label>
              <select
                value={basicInfo.ho || ''}
                onChange={(e) => handleHoChange(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2F5496]"
              >
                <option value="">호수를 선택하세요</option>
                {hoList.map((h) => (
                  <option key={h} value={h}>
                    {h}호
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 나머지 기본정보 필드 */}
          {otherBasicFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-500 mb-1">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  value={basicInfo[field.key] || ''}
                  onChange={(e) => handleBasicInfoChange(field.key, e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2F5496]"
                >
                  <option value="">선택하세요</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={basicInfo[field.key] || ''}
                  onChange={(e) => handleBasicInfoChange(field.key, e.target.value)}
                  placeholder={
                    field.key === 'phone' ? '010-0000-0000' : `${field.label}을 입력하세요`
                  }
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2F5496]"
                />
              )}
            </div>
          ))}
        </div>

        {/* 질문 */}
        {config.questions.map((q, qi) => (
          <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-800 mb-1">
              {qi + 1}. {q.label} <span className="text-red-400">*</span>
            </h3>
            {q.description && (
              <p className="text-xs text-gray-400 mb-2 whitespace-pre-line">{q.description}</p>
            )}
            <div className="space-y-2 mt-2">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    answers[q.id] === opt
                      ? 'border-[#2F5496] bg-[#2F5496]/5'
                      : 'border-gray-200 active:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 shrink-0 ${
                      answers[q.id] === opt ? 'border-[#2F5496]' : 'border-gray-300'
                    }`}
                  >
                    {answers[q.id] === opt && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#2F5496]" />
                    )}
                  </div>
                  <span className="text-sm">{opt}</span>
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
          <p className="text-xs text-gray-400 text-center whitespace-pre-line">{config.notice}</p>
        )}

        {/* 에러 */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center">{error}</div>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full p-4 bg-[#2F5496] text-white rounded-xl text-lg font-semibold disabled:opacity-50 active:bg-[#1e3a6e]"
        >
          {submitting ? '제출 중...' : '제출하기'}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
