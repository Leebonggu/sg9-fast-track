import { NextRequest, NextResponse } from 'next/server';

// 관리자 페이지 접근을 위원 5명으로 제한 — 공유 비밀번호 하나만 아는 제3자를 막기 위한
// 추가 게이트. 이름 자체는 비밀이 아니므로(위원 명단은 공개) 여기 하드코딩해도 무방하지만,
// 비밀번호와 함께 둘 다 맞아야 통과되므로 실질적인 방어가 된다.
const ALLOWED_OPERATORS = ['이봉구', '박용규', '이지윤', '이병준', '김우진'];

export async function POST(req: NextRequest) {
  const { password, name } = await req.json();
  const normalizedName = typeof name === 'string' ? name.replace(/\s/g, '') : '';
  const ok =
    password === process.env.APP_PASSWORD && ALLOWED_OPERATORS.includes(normalizedName);
  return NextResponse.json({ ok });
}
