import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '단톡방 인증 — 상계주공 9단지',
  description: '소유자 본인 확인 후 카카오톡 단톡방 비밀번호를 발급받습니다',
  openGraph: {
    title: '단톡방 인증 — 상계주공 9단지',
    description: '소유자 본인 확인 후 카카오톡 단톡방 비밀번호를 발급받습니다',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function KakaoVerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
