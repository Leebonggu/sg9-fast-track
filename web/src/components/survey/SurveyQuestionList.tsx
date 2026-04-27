'use client';

import { SurveyQuestion } from '@/lib/surveys/types';

interface Props {
  questions: SurveyQuestion[];
  answers: Record<string, string>;
  onChange: (questionId: string, option: string) => void;
}

export function SurveyQuestionList({ questions, answers, onChange }: Props) {
  return (
    <>
      {questions.map((q, qi) => (
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
                  onChange={() => onChange(q.id, opt)}
                  className="hidden"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
