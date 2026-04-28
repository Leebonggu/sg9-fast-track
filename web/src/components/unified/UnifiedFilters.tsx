'use client';

import type { FilterType, UnifiedRow } from '@/lib/unified-types';
import { applyFilter } from '@/lib/unified-utils';

interface Props {
  active: FilterType;
  rows: UnifiedRow[];
  surveyIds: string[];
  onChange: (f: FilterType) => void;
}

function FilterButton({
  filterKey,
  label,
  active,
  rows,
  surveyIds,
  onChange,
  variant = 'blue',
}: {
  filterKey: FilterType;
  label: string;
  active: FilterType;
  rows: UnifiedRow[];
  surveyIds: string[];
  onChange: (f: FilterType) => void;
  variant?: 'blue' | 'orange';
}) {
  const count = applyFilter(rows, filterKey, surveyIds).length;
  const isActive = active === filterKey;
  const activeClass =
    variant === 'orange'
      ? 'bg-orange-500 text-white border-orange-500'
      : 'bg-[#2F5496] text-white border-[#2F5496]';
  return (
    <button
      onClick={() => onChange(filterKey)}
      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
        isActive ? activeClass : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label} <span className={isActive ? 'opacity-80' : 'text-gray-400'}>({count})</span>
    </button>
  );
}

export default function UnifiedFilters({ active, rows, surveyIds, onChange }: Props) {
  const baseFilters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'incomplete', label: '하나라도 미완료' },
    { key: 'no-consent', label: '신속통합동의서 미제출' },
    ...surveyIds.map((id) => ({
      key: `no-${id}` as FilterType,
      label: `${id.replace(/_완료$/, '')} 미완료`,
    })),
  ];

  const rentalFilters: { key: FilterType; label: string }[] = [
    { key: 'rental', label: '임대 전체' },
    { key: 'rental-no-consent', label: '임대 + 동의서 미제출' },
    ...surveyIds.map((id) => ({
      key: `rental-no-${id}` as FilterType,
      label: `임대 + ${id.replace(/_완료$/, '')} 미완료`,
    })),
  ];

  return (
    <div className="flex flex-col gap-2 mb-2">
      <div className="flex gap-2 flex-wrap">
        {baseFilters.map(({ key, label }) => (
          <FilterButton
            key={key}
            filterKey={key}
            label={label}
            active={active}
            rows={rows}
            surveyIds={surveyIds}
            onChange={onChange}
          />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-orange-500 font-medium shrink-0">임대</span>
        {rentalFilters.map(({ key, label }) => (
          <FilterButton
            key={key}
            filterKey={key}
            label={label}
            active={active}
            rows={rows}
            surveyIds={surveyIds}
            onChange={onChange}
            variant="orange"
          />
        ))}
      </div>
    </div>
  );
}
