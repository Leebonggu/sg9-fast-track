'use client';

import { useState, type ReactNode } from 'react';
import type { FilterType, UnifiedRow } from '@/lib/unified-types';
import { applyFilter } from '@/lib/unified-utils';

interface Props {
  active: FilterType;
  rows: UnifiedRow[];
  surveyIds: string[];
  onChange: (f: FilterType) => void;
}

type Variant = 'blue' | 'orange' | 'green' | 'red' | 'purple';

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
  variant?: Variant;
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

// 카테고리 한 줄 (라벨 + 가로 스크롤 버튼들). 컴포넌트가 아닌 함수 호출로 렌더해 재마운트 방지.
function catRow(label: string | null, labelColor: string, children: ReactNode) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="flex gap-2 items-center px-4 sm:px-0 min-w-max pb-0.5">
        {label && (
          <span className={`text-xs font-medium shrink-0 ${labelColor}`}>{label}</span>
        )}
        {children}
      </div>
    </div>
  );
}

export default function UnifiedFilters({ active, rows, surveyIds, onChange }: Props) {
  const [attrOpen, setAttrOpen] = useState(false);

  // 버튼 하나 렌더 헬퍼
  const btn = (key: FilterType, label: string, variant?: Variant) => (
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
  );

  // 속성별(거주·명의) 필터가 활성이면 접이식 자동 펼침
  const isAttrActive =
    typeof active === 'string' &&
    (active.startsWith('rental') ||
      active.startsWith('resident') ||
      active.startsWith('joint'));
  const showAttr = attrOpen || isAttrActive;

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* 기본 상태 */}
      {catRow(null, '', (
        <>
          {btn('all', '전체')}
          {btn('incomplete', '하나라도 미완료')}
        </>
      ))}

      {/* 제출·수령 */}
      {catRow('제출·수령', 'text-[#2F5496]', (
        <>
          {btn('no-consent', '동의서 미제출')}
          {btn('no-id', '신분증 미제출')}
          {surveyIds.map((id) => btn(`no-${id}` as FilterType, `${shortSurveyLabel(id)} 미완료`))}
          {btn('plan-incomplete', '정비입안 2종')}
          {btn('no-plan-consent', '└ 동의서')}
          {btn('no-plan-privacy', '└ 개인정보')}
        </>
      ))}

      {/* 후원금 */}
      {catRow('후원금', 'text-green-600', (
        <>
          {btn('no-donation', '미납부')}
          {btn('donation', '납부', 'green')}
        </>
      ))}

      {/* 참여·의사 */}
      {catRow('참여·의사', 'text-red-600', (
        <>
          {btn('opposition', '반대 의사', 'red')}
          {btn('kakao-group', '단톡방 참여', 'green')}
          {btn('no-kakao-group', '단톡방 미참여')}
        </>
      ))}

      {/* 속성별 (거주·명의) — 접이식 */}
      <button
        type="button"
        onClick={() => setAttrOpen(!showAttr)}
        className="sm:hidden self-start text-xs text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white flex items-center gap-1"
      >
        <span className="text-orange-500">●</span>
        <span className="text-green-600">●</span>
        <span className="text-purple-600">●</span>
        속성별 필터 (거주·명의)
        <span className="text-gray-400">{showAttr ? '▲' : '▼'}</span>
      </button>

      <div className={`${showAttr ? 'flex' : 'hidden'} sm:flex flex-col gap-2`}>
        {catRow('임대', 'text-orange-500', (
          <>
            {btn('rental', '전체', 'orange')}
            {btn('rental-incomplete', '하나라도 미완료', 'orange')}
            {btn('rental-no-consent', '동의서 미제출', 'orange')}
            {surveyIds.map((id) =>
              btn(`rental-no-${id}` as FilterType, `${shortSurveyLabel(id)} 미완료`, 'orange'),
            )}
          </>
        ))}
        {catRow('실거주', 'text-green-600', (
          <>
            {btn('resident', '전체', 'green')}
            {btn('resident-incomplete', '하나라도 미완료', 'green')}
            {btn('resident-no-consent', '동의서 미제출', 'green')}
            {surveyIds.map((id) =>
              btn(`resident-no-${id}` as FilterType, `${shortSurveyLabel(id)} 미완료`, 'green'),
            )}
          </>
        ))}
        {catRow('공동명의', 'text-purple-600', (
          <>
            {btn('joint', '전체', 'purple')}
            {btn('joint-incomplete', '미완료', 'purple')}
            {btn('joint-no-consent', '동의서 미제출', 'purple')}
          </>
        ))}
      </div>
    </div>
  );
}
