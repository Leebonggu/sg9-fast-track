'use client';

import Link from 'next/link';
import { BUILDING_CONFIG } from '@/lib/buildings';

interface Props {
  selectedDong: string | null;
}

export default function UnifiedSidebar({ selectedDong }: Props) {
  const dongs = Object.keys(BUILDING_CONFIG);

  const desktopClass = (active: boolean) =>
    `mx-2 mb-1 py-2 text-center text-xs font-medium rounded-md transition-colors ${
      active ? 'bg-[#2F5496] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
    }`;

  const mobileClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
      active ? 'bg-[#2F5496] text-white' : 'bg-white text-gray-500 border border-gray-200'
    }`;

  return (
    <>
      {/* 데스크톱: 수직 사이드바 */}
      <aside className="hidden sm:flex w-20 shrink-0 bg-gray-50 border-r border-gray-200 flex-col overflow-y-auto">
        <div className="p-2 text-xs text-gray-400 text-center pt-4">동 선택</div>
        <Link href="/unified" className={desktopClass(!selectedDong)}>전체</Link>
        {dongs.map((dongKey) => {
          const dongNum = dongKey.replace('동', '');
          return (
            <Link key={dongKey} href={`/unified/${dongNum}`} className={desktopClass(selectedDong === dongNum)}>
              {dongNum}동
            </Link>
          );
        })}
      </aside>

      {/* 모바일: 수평 스크롤 동 선택 */}
      <nav className="sm:hidden overflow-x-auto shrink-0 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2 px-3 py-2 min-w-max">
          <Link href="/unified" className={mobileClass(!selectedDong)}>전체</Link>
          {dongs.map((dongKey) => {
            const dongNum = dongKey.replace('동', '');
            return (
              <Link key={dongKey} href={`/unified/${dongNum}`} className={mobileClass(selectedDong === dongNum)}>
                {dongNum}동
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
