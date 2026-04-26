'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      <Link
        href="/"
        className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
          pathname === '/' ? 'text-[#2F5496]' : 'text-gray-400'
        }`}
      >
        홈
      </Link>
      <Link
        href="/consent"
        className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
          pathname.startsWith('/consent') ? 'text-[#2F5496]' : 'text-gray-400'
        }`}
      >
        신통기획접수
      </Link>
      <Link
        href="/survey"
        className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
          pathname.startsWith('/survey') ? 'text-[#2F5496]' : 'text-gray-400'
        }`}
      >
        설문
      </Link>
      <Link
        href="/unified"
        className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
          pathname.startsWith('/unified') ? 'text-[#2F5496]' : 'text-gray-400'
        }`}
      >
        통합현황
      </Link>
    </nav>
  );
}
