'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/simulator', label: '시뮬레이터' },
  { href: '/scenario', label: '시나리오 분석' },
  { href: '/slides', label: '발표 모드' },
  { href: '/setup', label: '데이터 설정' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-blue-900 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg print:hidden">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-tight">재건축 분담금 시뮬레이터</span>
        <span className="text-blue-300 text-xs border border-blue-700 px-2 py-0.5 rounded">
          BETA
        </span>
      </div>
      <div className="flex gap-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              pathname.startsWith(link.href)
                ? 'bg-blue-600 text-white'
                : 'text-blue-200 hover:bg-blue-800'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
