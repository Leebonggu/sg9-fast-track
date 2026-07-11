import { NextRequest, NextResponse } from 'next/server';

// 관리자 전용 API 경로 — 통째로 보호 (하위 경로 전부 포함)
const PROTECTED_PREFIXES = [
  '/api/unified',
  '/api/consent',
  '/api/dashboard',
  '/api/building',
  '/api/kakao-verify-logs',
  '/api/admin/kakao-link',
  '/api/admin/id-correction',
];

// /api/survey/[surveyId]는 공개 제출 폼과 관리자 화면이 같은 경로를 나눠 쓰므로
// 하위 경로 이름으로만 관리자 전용 여부를 판단 (missing/generate는 관리자 전용 화면에서만 호출됨)
const ADMIN_ONLY_SURVEY_SUFFIXES = ['/missing', '/generate'];

function isProtectedPath(pathname: string, method: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (ADMIN_ONLY_SURVEY_SUFFIXES.some((s) => pathname.endsWith(s))) return true;
  // GET /api/survey/[surveyId]는 공개 조회(참여 현황 페이지)라 공개, 그 외 메서드(수정/삭제)는 관리자 전용
  if (/^\/api\/survey\/[^/]+$/.test(pathname) && method !== 'GET') return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPath(pathname, req.method)) return NextResponse.next();

  const pw = req.headers.get('x-app-password');
  if (!pw || pw !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
