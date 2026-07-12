import { NextRequest, NextResponse } from 'next/server';
import { createAdminViewToken } from '@/lib/kakao-verify';

// 관리자 전용: 신분증 인쇄용 보기 등 열람 목적의 (동,호) 스코프 토큰 발급.
// /api/admin/id-correction과 달리 정정윈도우를 열지 않는 순수 조회용 — 부작용 없음.
// 새 탭(target=_blank)에서 sessionStorage의 관리자 비밀번호를 다시 읽지 못하는 문제를
// 피하기 위해, 인쇄 링크 자체에 이 토큰을 실어 보낸다.
// createVerifyToken(주민용)이 아니라 createAdminViewToken을 쓰는 게 중요 — 구조가 달라야
// 동/호/이름만 아는 제3자의 주민 토큰이 이 토큰 행세를 할 수 없다 (신분증 사진 원본 보호).
export async function POST(req: NextRequest) {
  try {
    const { dong: rawDong, ho: rawHo } = await req.json();
    if (!rawDong || !rawHo) {
      return NextResponse.json({ error: '동, 호수가 필요합니다.' }, { status: 400 });
    }
    const dong = String(rawDong).replace(/동$/, '').trim();
    const ho = String(rawHo).trim();
    const token = createAdminViewToken(dong, ho);
    return NextResponse.json({ token });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[admin/id-view-token] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
