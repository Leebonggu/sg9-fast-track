import type { UnifiedRow } from '@/lib/unified-types';
import MemoCell from './MemoCell';

interface Props {
  rows: UnifiedRow[];
  surveyIds: string[];
  showDong: boolean;
}

const Check = ({ value }: { value: boolean }) =>
  value ? (
    <span className="text-green-600 font-bold text-sm">✓</span>
  ) : (
    <span className="text-red-300 text-sm">✗</span>
  );

export default function UnifiedTable({ rows, surveyIds, showDong }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400">
            {showDong && <th className="text-left py-2 px-3 font-medium">동</th>}
            <th className="text-left py-2 px-3 font-medium">호수</th>
            <th className="text-left py-2 px-3 font-medium">소유자</th>
            <th className="text-center py-2 px-3 font-medium">실거주</th>
            <th className="text-center py-2 px-3 font-medium">신속통합동의서_제출</th>
            {surveyIds.map((id) => (
              <th key={id} className="text-center py-2 px-3 font-medium">
                {id}
              </th>
            ))}
            <th className="text-left py-2 px-3 font-medium">메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const doneCount = (row.consent ? 1 : 0) + surveyIds.filter((id) => row.surveys[id]).length;
            const totalCount = 1 + surveyIds.length;
            const allDone = doneCount === totalCount;
            const noneDone = doneCount === 0;
            const rowBg = allDone ? '' : noneDone ? 'bg-red-50' : 'bg-amber-50';
            return (
              <tr
                key={`${row.dong}-${row.ho}`}
                className={`border-b border-gray-100 hover:bg-gray-50 ${rowBg}`}
              >
                {showDong && (
                  <td className="py-2 px-3 text-gray-400 text-xs">{row.dong}</td>
                )}
                <td className="py-2 px-3 font-medium">{row.ho}</td>
                <td className="py-2 px-3 text-gray-700">{row.ownerName}</td>
                <td className="py-2 px-3 text-center text-xs text-gray-400">
                  {row.residency}
                </td>
                <td className="py-2 px-3 text-center">
                  <Check value={row.consent} />
                </td>
                {surveyIds.map((id) => (
                  <td key={id} className="py-2 px-3 text-center">
                    <Check value={row.surveys[id] ?? false} />
                  </td>
                ))}
                <td className="py-2 px-3 min-w-[120px]">
                  <MemoCell dong={row.dong} ho={row.ho} initialMemo={row.memo} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">해당 조건의 세대가 없습니다.</div>
      )}
    </div>
  );
}
