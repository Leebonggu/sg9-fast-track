'use client';

const DEFAULT_COLORS = [
  '#2F5496',
  '#5B9BD5',
  '#70AD47',
  '#FFC000',
  '#FF6B6B',
  '#9E7BC0',
  '#4BACC6',
  '#ED7D31',
];

interface CrossTabChartProps {
  title: string;
  rows: string[];
  cols: string[];
  data: number[][];
  colors?: string[];
}

export default function CrossTabChart({
  title,
  rows,
  cols,
  data,
  colors = DEFAULT_COLORS,
}: CrossTabChartProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>

      {rows.map((rowLabel, rowIdx) => {
        const rowData = data[rowIdx] ?? [];
        const rowTotal = rowData.reduce((sum, count) => sum + count, 0);

        return (
          <div key={rowIdx} className="flex items-center gap-2 mb-2">
            <span className="w-20 text-xs text-gray-600 text-right shrink-0">
              {rowLabel}
            </span>

            <div className="flex-1 h-7 flex rounded overflow-hidden bg-gray-100">
              {rowTotal === 0 ? (
                <div className="flex-1 bg-gray-100" />
              ) : (
                cols.map((colLabel, colIdx) => {
                  const count = rowData[colIdx] ?? 0;
                  const pct = (count / rowTotal) * 100;
                  const color = colors[colIdx % colors.length];

                  return (
                    <div
                      key={colIdx}
                      title={`${colLabel}: ${count}명 (${pct.toFixed(1)}%)`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                      className="inline-flex items-center justify-center overflow-hidden"
                    >
                      {pct >= 8 && (
                        <span className="text-white text-xs font-medium leading-none select-none">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <span className="text-xs text-gray-500 shrink-0 w-14 text-right">
              ({rowTotal}명)
            </span>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-3 mt-3">
        {cols.map((colLabel, colIdx) => {
          const color = colors[colIdx % colors.length];
          return (
            <div key={colIdx} className="flex items-center">
              <span
                className="w-3 h-3 rounded-sm inline-block mr-1 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">{colLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
