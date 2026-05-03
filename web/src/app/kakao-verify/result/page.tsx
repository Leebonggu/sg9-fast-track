import Link from 'next/link';
import { verifyToken } from '@/lib/kakao-verify';

export default async function KakaoVerifyResultPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  if (!t) {
    return <ErrorView message="잘못된 접근입니다." />;
  }

  const result = verifyToken(t);

  if (!result.valid) {
    if (result.reason === 'expired') {
      return <ExpiredView />;
    }
    return <ErrorView message="유효하지 않은 인증 링크입니다." />;
  }

  const kakaoLink = process.env.KAKAO_GROUP_LINK ?? '';
  const kakaoPassword = process.env.KAKAO_GROUP_PASSWORD ?? '';

  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="text-5xl mb-3">✓</div>
        <h2 className="text-xl font-bold text-[#2F5496] mb-1">소유자 인증 완료</h2>
        <p className="text-sm text-gray-500 mb-6">
          {result.dong}동 {result.ho}호 소유자로 확인되었습니다.
        </p>

        {kakaoPassword && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
            <p className="text-xs text-gray-400 mb-1">단톡방 입장 비밀번호</p>
            <p className="text-3xl font-bold tracking-widest text-[#2F5496]">
              {kakaoPassword}
            </p>
          </div>
        )}

        {kakaoLink ? (
          <a
            href={kakaoLink}
            className="block w-full py-4 bg-[#FEE500] text-[#3C1E1E] rounded-2xl text-base font-bold active:opacity-80"
          >
            카카오톡 단톡방 입장하기
          </a>
        ) : (
          <p className="text-sm text-gray-400">링크가 아직 설정되지 않았습니다.</p>
        )}

        <p className="text-xs text-gray-400 mt-4">이 페이지는 30분간 유효합니다.</p>
      </div>
    </div>
  );
}

function ExpiredView() {
  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="text-4xl mb-3">⏱️</div>
        <h2 className="text-lg font-bold text-gray-700 mb-2">인증이 만료되었습니다</h2>
        <p className="text-sm text-gray-500 mb-6">
          인증 유효 시간(30분)이 지났습니다. 다시 인증해 주세요.
        </p>
        <Link
          href="/kakao-verify"
          className="block w-full py-4 bg-[#2F5496] text-white rounded-2xl text-base font-bold"
        >
          다시 인증하기
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-gray-700 mb-2">인증 오류</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <Link
          href="/kakao-verify"
          className="block w-full py-4 bg-[#2F5496] text-white rounded-2xl text-base font-bold"
        >
          처음으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
