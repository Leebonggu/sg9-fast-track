import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제출 현황 확인 — 상계주공 9단지',
  description: '동/호/이름으로 본인 세대의 동의서·설문 제출 여부를 확인하세요',
  openGraph: {
    title: '제출 현황 확인 — 상계주공 9단지',
    description: '동/호/이름으로 본인 세대의 동의서·설문 제출 여부를 확인하세요',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function CheckSubmissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
