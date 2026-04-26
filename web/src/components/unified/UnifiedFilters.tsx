'use client';

import type { FilterType } from '@/lib/unified-types';

interface Props {
  active: FilterType;
  surveyIds: string[];
  onChange: (f: FilterType) => void;
}

export default function UnifiedFilters({ active, surveyIds, onChange }: Props) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'incomplete', label: '미완료' },
    { key: 'no-consent', label: '동의 미완료' },
    ...surveyIds.map((id) => ({ key: `no-${id}` as FilterType, label: `${id} 미완료` })),
  ];

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
            active === key
              ? 'bg-[#2F5496] text-white border-[#2F5496]'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
