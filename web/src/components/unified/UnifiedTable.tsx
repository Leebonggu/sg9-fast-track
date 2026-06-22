'use client';

import { memo } from 'react';
import type { UnifiedRow } from '@/lib/unified-types';
import MemoCell from './MemoCell';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
  showDong: boolean;
  onRowClick: (row: UnifiedRow) => void;
}

const Check = ({ value }: { value: boolean }) =>
  value ? (
    <span className="text-green-600 font-bold text-sm">✓</span>
  ) : (
    <span className="text-red-300 text-sm">✗</span>
  );

const shortSurveyLabel = (id: string) =>
  id.replace(/_완료$/, '').replace(/^\d{4}_\d{2}_/, '');

function Chip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-full border ${
        done
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50/60 text-red-400 border-red-100'
      }`}
    >
      <span className="font-bold">{done ? '✓' : '✗'}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

function IdBadge({ consent, count }: { consent: boolean; count: number }) {
  if (!consent) return <span className="text-gray-300 text-xs">-</span>;
  if (count > 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-full border bg-green-50 text-green-700 border-green-200">
        <span className="font-bold">✓</span>
        <span className="whitespace-nowrap">{count}장</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] leading-none px-2 py-1 rounded-full border bg-red-50/60 text-red-400 border-red-100">
      <span className="font-bold">✗</span>
      <span className="whitespace-nowrap">미제출</span>
    </span>
  );
}

function ResidencyBadge({ value }: { value: string }) {
  if (!value) return null;
  const base =
    value === '실거주'
      ? 'bg-green-100 text-green-700'
      : value === '임대'
        ? 'bg-orange-100 text-orange-700'
        : 'bg-gray-100 text-gray-500';
  return (
    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${base}`}>
      {value}
    </span>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors"
      title="원본 데이터 수정"
    >
      수정
    </button>
  );
}

function rowBgClass(doneCount: number, totalCount: number) {
  if (doneCount === totalCount) return '';
  if (doneCount === 0) return 'bg-red-50';
  return 'bg-amber-50';
}

function UnifiedTableInner({ rows, surveyIds, showDong, onRowClick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        해당 조건의 세대가 없습니다.
      </div>
    );
  }

  return (
    <>
      {/* 모바일: 카드 리스트 */}
      <div className="sm:hidden flex flex-col gap-2 -mx-1">
        {rows.map((row) => {
          const doneCount =
            (row.consent ? 1 : 0) + surveyIds.filter((id) => row.surveys[id]).length;
          const totalCount = 1 + surveyIds.length;
          const bg = rowBgClass(doneCount, totalCount) || 'bg-white';
          return (
            <div
              key={`${row.dong}-${row.ho}`}
              className={`rounded-lg border border-gray-200 ${bg} px-3 py-2.5`}
            >
              <div className="flex items-baseline justify-between mb-1 gap-2">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  {showDong && (
                    <span className="text-xs text-gray-400 shrink-0">{row.dong}동</span>
                  )}
                  <span className="font-semibold text-sm text-gray-800 shrink-0">
                    {row.ho}호
                  </span>
                  <span className="text-xs text-gray-700 truncate">
                    {row.ownerName || '-'}
                  </span>
                  {row.nameMismatch && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium" title={`동의서: ${row.consentName}`}>이름불일치</span>
                  )}
                  {row.opposition && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">반대</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ResidencyBadge value={row.residency} />
                  <EditButton onClick={() => onRowClick(row)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2 items-center">
                <Chip done={row.consent} label="동의서" />
                {surveyIds.map((id) => (
                  <Chip
                    key={id}
                    done={row.surveys[id] ?? false}
                    label={shortSurveyLabel(id)}
                  />
                ))}
              </div>
              <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
            </div>
          );
        })}
      </div>

      {/* 데스크톱: 테이블 */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-400">
              {showDong && (
                <th className="text-left py-2 px-3 font-medium whitespace-nowrap">동</th>
              )}
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">호수</th>
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">소유자</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">실거주</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">
                신속통합동의서_제출
              </th>
              {surveyIds.map((id) => (
                <th
                  key={id}
                  className="text-center py-2 px-3 font-medium whitespace-nowrap"
                >
                  {id}
                </th>
              ))}
              <th className="text-left py-2 px-3 font-medium whitespace-nowrap">메모</th>
              <th className="text-center py-2 px-3 font-medium whitespace-nowrap">수정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const doneCount =
                (row.consent ? 1 : 0) +
                surveyIds.filter((id) => row.surveys[id]).length;
              const totalCount = 1 + surveyIds.length;
              const bg = rowBgClass(doneCount, totalCount);
              return (
                <tr
                  key={`${row.dong}-${row.ho}`}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${bg}`}
                >
                  {showDong && (
                    <td className="py-2 px-3 text-gray-400 text-xs">{row.dong}</td>
                  )}
                  <td className="py-2 px-3 font-medium">{row.ho}</td>
                  <td className="py-2 px-3 text-gray-700">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {row.ownerName}
                      {row.nameMismatch && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium" title={`동의서: ${row.consentName}`}>이름불일치</span>
                      )}
                      {row.opposition && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">반대</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <ResidencyBadge value={row.residency} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Check value={row.consent} />
                  </td>
                  {surveyIds.map((id) => (
                    <td key={id} className="py-2 px-3 text-center">
                      <Check value={row.surveys[id] ?? false} />
                    </td>
                  ))}
                  <td className="py-2 px-3 min-w-[100px]">
                    <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <EditButton onClick={() => onRowClick(row)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const UnifiedTable = memo(UnifiedTableInner);
export default UnifiedTable;
