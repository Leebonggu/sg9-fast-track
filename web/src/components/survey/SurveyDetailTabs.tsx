'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = { surveyId: string };

export default function SurveyDetailTabs({ surveyId }: Props) {
  const pathname = usePathname();
  const base = `/survey/${surveyId}`;

  const tabs = [
    { href: base, label: '응답 목록', exact: true },
    { href: `${base}/missing`, label: '미응답', exact: false },
    { href: `${base}/analytics`, label: '통계 분석', exact: false },
  ];

  return (
    <div className="sticky top-[64px] z-30 bg-gray-100 px-2 py-1.5 flex gap-1">
      {tabs.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-2 text-xs text-center rounded-lg whitespace-nowrap transition-all ${
              active
                ? 'bg-white text-[#2F5496] font-semibold shadow-sm'
                : 'text-gray-500 font-medium'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
