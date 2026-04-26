'use client';

import Link from 'next/link';
import { BUILDING_CONFIG } from '@/lib/buildings';

interface Props {
  selectedDong: string | null; // null = 전체
}

export default function UnifiedSidebar({ selectedDong }: Props) {
  const dongs = Object.keys(BUILDING_CONFIG); // ["901동", ...]

  return (
    <aside className="w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-2 text-xs text-gray-400 text-center pt-4">동 선택</div>
      <Link
        href="/unified"
        className={`mx-2 mb-1 py-2 text-center text-xs font-medium rounded-md transition-colors ${
          !selectedDong
            ? 'bg-[#2F5496] text-white'
            : 'bg-white text-gray-500 hover:bg-gray-100'
        }`}
      >
        전체
      </Link>
      {dongs.map((dongKey) => {
        const dongNum = dongKey.replace('동', '');
        return (
          <Link
            key={dongKey}
            href={`/unified/${dongNum}`}
            className={`mx-2 mb-1 py-2 text-center text-xs font-medium rounded-md transition-colors ${
              selectedDong === dongNum
                ? 'bg-[#2F5496] text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            {dongNum}동
          </Link>
        );
      })}
    </aside>
  );
}
