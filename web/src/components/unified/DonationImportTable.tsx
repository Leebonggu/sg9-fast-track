'use client';

import type { ClassifiedImportRow } from '@/lib/donation-import-types';

export interface EditableRow extends ClassifiedImportRow {
  checked: boolean;
}

interface Props {
  newRows: EditableRow[];
  reviewRows: EditableRow[];
  duplicateCount: number;
  onEdit: (rowIdx: number, field: 'dong' | 'ho', value: string) => void;
  onToggle: (rowIdx: number) => void;
}

function formatTime(iso: string) {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}/${m[2]} ${m[3]}` : iso;
}

function RowTable({
  rows, onEdit, onToggle, showExisting,
}: {
  rows: EditableRow[];
  onEdit: Props['onEdit'];
  onToggle: Props['onToggle'];
  showExisting?: boolean;
}) {
  if (rows.length === 0) return <p className="text-xs text-gray-400">없음</p>;
  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-2"></th>
            <th className="p-2 text-left">시각</th>
            <th className="p-2 text-left">동</th>
            <th className="p-2 text-left">호수</th>
            {showExisting && <th className="p-2 text-left">기존 등록값</th>}
            <th className="p-2 text-right">금액</th>
            <th className="p-2 text-left">원본텍스트</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowIdx} className="border-t border-gray-100">
              <td className="p-2">
                <input type="checkbox" checked={r.checked} onChange={() => onToggle(r.rowIdx)} />
              </td>
              <td className="p-2 whitespace-nowrap">{formatTime(r.iso)}</td>
              <td className="p-2">
                <input
                  className="w-14 border border-gray-200 rounded px-1 py-0.5"
                  value={r.dong}
                  onChange={(e) => onEdit(r.rowIdx, 'dong', e.target.value)}
                />
              </td>
              <td className="p-2">
                <input
                  className="w-16 border border-gray-200 rounded px-1 py-0.5"
                  value={r.ho}
                  onChange={(e) => onEdit(r.rowIdx, 'ho', e.target.value)}
                />
              </td>
              {showExisting && (
                <td className="p-2 text-gray-400">{r.existingDong}/{r.existingHo}</td>
              )}
              <td className="p-2 text-right">{r.amount.toLocaleString()}</td>
              <td className="p-2 text-gray-400 truncate max-w-[200px]">
                {r.sender}{r.memo ? ` (메모: ${r.memo})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DonationImportTable({ newRows, reviewRows, duplicateCount, onEdit, onToggle }: Props) {
  const newSum = newRows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          신규 {newRows.length}건 (합계 {newSum.toLocaleString()}원)
        </h2>
        <RowTable rows={newRows} onEdit={onEdit} onToggle={onToggle} />
      </section>

      {reviewRows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-orange-600 mb-2">확인 필요 {reviewRows.length}건</h2>
          <p className="text-xs text-gray-400 mb-2">
            시각·금액은 기존 등록건과 일치하지만 동/호수가 다릅니다. 확인 후 등록하세요.
          </p>
          <RowTable rows={reviewRows} onEdit={onEdit} onToggle={onToggle} showExisting />
        </section>
      )}

      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer">이미 등록됨 {duplicateCount}건 (자동 제외)</summary>
      </details>
    </div>
  );
}
