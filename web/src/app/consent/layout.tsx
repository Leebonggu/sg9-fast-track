import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '신통기획접수 — 상계주공 9단지',
  description: '동별 동의서 수거 현황',
  openGraph: {
    title: '신통기획접수 — 상계주공 9단지',
    description: '동별 동의서 수거 현황',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function ConsentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
