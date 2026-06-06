import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '사용 가이드 — 상계주공 9단지',
  description: '재건축 준비 시스템 사용 안내',
  openGraph: {
    title: '사용 가이드 — 상계주공 9단지',
    description: '재건축 준비 시스템 사용 안내',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
