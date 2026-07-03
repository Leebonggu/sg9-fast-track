import type { NextRequest } from 'next/server';

// Vercel은 요청 체인의 각 홉을 x-forwarded-for에 순서대로 append하므로,
// 클라이언트가 위조할 수 있는 건 앞쪽 값들이고 신뢰 가능한 실제 접속 IP는 마지막 값이다.
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown';
}
