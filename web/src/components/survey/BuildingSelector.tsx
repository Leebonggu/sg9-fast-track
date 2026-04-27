'use client';

const selectClass =
  'w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496] bg-white appearance-none';
const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';

interface Props {
  selectedDong: string;
  selectedFloor: string;
  selectedHo: string;
  dongList: string[];
  floorList: number[];
  hoList: string[];
  onDongChange: (dong: string) => void;
  onFloorChange: (floor: string) => void;
  onHoChange: (ho: string) => void;
}

export function BuildingSelector({
  selectedDong,
  selectedFloor,
  selectedHo,
  dongList,
  floorList,
  hoList,
  onDongChange,
  onFloorChange,
  onHoChange,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className={labelClass}>
          동 <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedDong}
          onChange={(e) => onDongChange(e.target.value)}
          className={selectClass}
        >
          <option value="">동 선택</option>
          {dongList.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>
          층 <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedFloor}
          onChange={(e) => onFloorChange(e.target.value)}
          disabled={!selectedDong}
          className={selectClass + (!selectedDong ? ' opacity-40' : '')}
        >
          <option value="">층 선택</option>
          {floorList.map((f) => (
            <option key={f} value={String(f)}>{f}층</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>
          호수 <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedHo}
          onChange={(e) => onHoChange(e.target.value)}
          disabled={!selectedFloor}
          className={selectClass + (!selectedFloor ? ' opacity-40' : '')}
        >
          <option value="">호 선택</option>
          {hoList.map((h) => (
            <option key={h} value={h}>{h}호</option>
          ))}
        </select>
      </div>
    </div>
  );
}
