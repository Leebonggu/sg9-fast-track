'use client';

import { useState } from 'react';
import type { FilterType, UnifiedRow } from '@/lib/unified-types';
import { applyFilter } from '@/lib/unified-utils';

interface Props {
  active: FilterType;
  rows: UnifiedRow[];
  surveyIds: string[];
  onChange: (f: FilterType) => void;
}

const shortSurveyLabel = (id: string) =>
  id.replace(/_완료$/, '').replace(/^\d{4}_\d{2}_/, '');

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
  variant?: 'blue' | 'orange' | 'green' | 'red' | 'purple';
}) {
  const count = applyFilter(rows, filterKey, surveyIds).length;
  const isActive = active === filterKey;
  const activeClass =
    variant === 'orange'
      ? 'bg-orange-500 text-white border-orange-500'
      : variant === 'green'
        ? 'bg-green-600 text-white border-green-600'
        : variant === 'red'
          ? 'bg-red-600 text-white border-red-600'
          : variant === 'purple'
            ? 'bg-purple-600 text-white border-purple-600'
            : 'bg-[#2F5496] text-white border-[#2F5496]';
  return (
    <button
      onClick={() => onChange(filterKey)}
      className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors whitespace-nowrap ${
        isActive
          ? activeClass
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label} <span className={isActive ? 'opacity-80' : 'text-gray-400'}>({count})</span>
    </button>
  );
}

export default function UnifiedFilters({ active, rows, surveyIds, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const baseFilters: { key: FilterType; label: string; variant?: 'blue' | 'orange' | 'green' | 'red' }[] = [
    { key: 'all', label: '전체' },
    { key: 'incomplete', label: '하나라도 미완료' },
    { key: 'no-consent', label: '동의서 미제출' },
    { key: 'opposition', label: '반대 의사', variant: 'red' },
    ...surveyIds.map((id) => ({
      key: `no-${id}` as FilterType,
      label: `${shortSurveyLabel(id)} 미완료`,
    })),
  ];

  const rentalFilters: { key: FilterType; label: string }[] = [
    { key: 'rental', label: '임대 전체' },
    { key: 'rental-incomplete', label: '임대·하나라도 미완료' },
    { key: 'rental-no-consent', label: '임대·동의서 미제출' },
    ...surveyIds.map((id) => ({
      key: `rental-no-${id}` as FilterType,
      label: `임대·${shortSurveyLabel(id)} 미완료`,
    })),
  ];

  const residentFilters: { key: FilterType; label: string }[] = [
    { key: 'resident', label: '실거주 전체' },
    { key: 'resident-incomplete', label: '실거주·하나라도 미완료' },
    { key: 'resident-no-consent', label: '실거주·동의서 미제출' },
    ...surveyIds.map((id) => ({
      key: `resident-no-${id}` as FilterType,
      label: `실거주·${shortSurveyLabel(id)} 미완료`,
    })),
  ];

  const [jointOpen, setJointOpen] = useState(false);

  const jointFilters: { key: FilterType; label: string }[] = [
    { key: 'joint', label: '공동명의 전체' },
    { key: 'joint-incomplete', label: '공동명의·미완료' },
    { key: 'joint-no-consent', label: '공동명의·동의서 미제출' },
  ];

  const isResidencyActive =
    typeof active === 'string' &&
    (active.startsWith('rental') || active.startsWith('resident'));
  const showResidency = open || isResidencyActive;

  const isJointActive =
    typeof active === 'string' && active.startsWith('joint');
  const showJoint = jointOpen || isJointActive;

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="flex gap-2 px-4 sm:px-0 min-w-max pb-0.5">
          {baseFilters.map(({ key, label, variant }) => (
            <FilterButton
              key={key}
              filterKey={key}
              label={label}
              active={active}
              rows={rows}
              surveyIds={surveyIds}
              onChange={onChange}
              variant={variant}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(!showResidency)}
          className="sm:hidden self-start text-xs text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white flex items-center gap-1"
        >
          <span className="text-orange-500">●</span>
          <span className="text-green-600">●</span>
          거주구분 필터
          <span className="text-gray-400">{showResidency ? '▲' : '▼'}</span>
        </button>
        <button
          type="button"
          onClick={() => setJointOpen(!showJoint)}
          className="sm:hidden self-start text-xs text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white flex items-center gap-1"
        >
          <span className="text-purple-600">●</span>
          공동명의 필터
          <span className="text-gray-400">{showJoint ? '▲' : '▼'}</span>
        </button>
      </div>

      <div className={`${showJoint ? 'flex' : 'hidden'} sm:flex flex-col gap-2`}>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-2 items-center px-4 sm:px-0 min-w-max pb-0.5">
            <span className="text-xs text-purple-600 font-medium shrink-0">공동명의</span>
            {jointFilters.map(({ key, label }) => (
              <FilterButton
                key={key}
                filterKey={key}
                label={label}
                active={active}
                rows={rows}
                surveyIds={surveyIds}
                onChange={onChange}
                variant="purple"
              />
            ))}
          </div>
        </div>
      </div>

      <div className={`${showResidency ? 'flex' : 'hidden'} sm:flex flex-col gap-2`}>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-2 items-center px-4 sm:px-0 min-w-max pb-0.5">
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
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-2 items-center px-4 sm:px-0 min-w-max pb-0.5">
            <span className="text-xs text-green-600 font-medium shrink-0">실거주</span>
            {residentFilters.map(({ key, label }) => (
              <FilterButton
                key={key}
                filterKey={key}
                label={label}
                active={active}
                rows={rows}
                surveyIds={surveyIds}
                onChange={onChange}
                variant="green"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
