'use client';

export interface DongStat {
  building: string; // "901동"
  count: number;
  total: number;
  rate: number; // 0–100
}

export interface MissingUnit {
  unitNum: string; // e.g. "1201"
}

interface Props {
  stats: DongStat[];
  selectedDong: string | null;
  onSelectDong: (building: string) => void;
  missingUnits: MissingUnit[];
  missingLoading: boolean;
  missingLabel?: string;
  countLabel?: string;
  onViewDetail?: (building: string) => void;
  detailButtonLabel?: string;
}

function heatBg(rate: number) {
  if (rate < 30) return 'bg-red-100 border border-red-200';
  if (rate < 50) return 'bg-orange-100 border border-orange-200';
  if (rate < 70) return 'bg-yellow-50 border border-yellow-200';
  if (rate < 85) return 'bg-green-100 border border-green-200';
  return 'bg-green-200 border border-green-300';
}

function heatColor(rate: number) {
  if (rate < 30) return 'text-red-600';
  if (rate < 50) return 'text-orange-600';
  if (rate < 70) return 'text-yellow-600';
  if (rate < 85) return 'text-green-600';
  return 'text-green-700';
}

function heatBarColor(rate: number) {
  if (rate < 30) return 'bg-red-400';
  if (rate < 50) return 'bg-orange-400';
  if (rate < 70) return 'bg-yellow-400';
  if (rate < 85) return 'bg-green-400';
  return 'bg-green-500';
}

const LEGEND: [string, string][] = [
  ['bg-red-100 border border-red-200', '~30%'],
  ['bg-orange-100 border border-orange-200', '~50%'],
  ['bg-yellow-50 border border-yellow-200', '~70%'],
  ['bg-green-100 border border-green-200', '~85%'],
  ['bg-green-200 border border-green-300', '85%+'],
];

export default function DongHeatmap({
  stats,
  selectedDong,
  onSelectDong,
  missingUnits,
  missingLoading,
  missingLabel = '미접수 세대',
  countLabel = '접수',
  onViewDetail,
  detailButtonLabel = '상세 보기 →',
}: Props) {
  return (
    <>
      <div className="flex gap-3 px-3 pt-2 pb-1 flex-wrap">
        {LEGEND.map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-3 h-3 rounded-sm inline-block ${cls}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 p-3">
        {stats.map((b) => (
          <button
            key={b.building}
            onClick={() => onSelectDong(b.building)}
            className={`rounded-xl p-2.5 text-center transition-all active:scale-95 ${heatBg(b.rate)} ${
              selectedDong === b.building ? 'ring-2 ring-[#1e3a6e]' : ''
            }`}
          >
            <div className="text-xs font-semibold text-gray-700">
              {b.building.replace('동', '')}동
            </div>
            <div className={`text-lg font-bold mt-0.5 ${heatColor(b.rate)}`}>{b.rate}%</div>
            <div className="text-[10px] text-gray-500">
              {b.count}/{b.total}
            </div>
            <div className="h-1 bg-white/60 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${heatBarColor(b.rate)}`}
                style={{ width: `${b.rate}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {selectedDong && (
        <div className="mx-3 mb-4 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-[#2F5496] text-white px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {selectedDong} {missingLabel}
            </span>
            <div className="flex items-center gap-2">
              {missingLoading ? (
                <span className="text-xs opacity-70">로딩 중...</span>
              ) : (
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full">
                  {missingUnits.length}세대
                </span>
              )}
              {onViewDetail && (
                <button
                  onClick={() => onViewDetail(selectedDong)}
                  className="text-xs bg-white/20 px-2.5 py-1 rounded-lg"
                >
                  {detailButtonLabel}
                </button>
              )}
            </div>
          </div>
          {missingLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : missingUnits.length === 0 ? (
            <div className="py-8 text-center text-green-600 text-sm font-medium">
              🎉 모든 세대가 {countLabel}했습니다!
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {missingUnits.map((u) => {
                const floor = Math.floor(Number(u.unitNum) / 100);
                const ho = (Number(u.unitNum) % 100).toString().padStart(2, '0');
                return (
                  <div key={u.unitNum} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-semibold text-gray-700">{ho}호</span>
                    <span className="text-xs text-gray-400">{floor}층</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!selectedDong && (
        <p className="text-center text-xs text-gray-400 pb-4">
          동 카드를 탭하면 {missingLabel} 목록을 볼 수 있어요
        </p>
      )}
    </>
  );
}
