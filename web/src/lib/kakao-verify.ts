import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 30 * 60 * 1000;

function getSecret(): string {
  const s = process.env.KAKAO_VERIFY_SECRET;
  if (!s) throw new Error('VERIFY_SECRET 환경변수가 설정되지 않았습니다.');
  return s;
}

export function createVerifyToken(dong: string, ho: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${dong}|${ho}|${expiry}`;
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${hmac}`).toString('base64url');
}

// 서명 검증 + payload 분해까지만 공통 처리 (parts 개수/포맷 해석은 호출측 책임).
// 반환: 서명이 유효한 payload의 '|' 분해 조각들, 또는 위변조/형식오류 시 null.
function verifySignedPayload(token: string): string[] | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;

    const payload = decoded.slice(0, lastDot);
    const providedHmac = decoded.slice(lastDot + 1);

    const expectedHmac = createHmac('sha256', getSecret())
      .update(payload)
      .digest('base64url');

    const a = Buffer.from(providedHmac);
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return payload.split('|');
  } catch {
    return null;
  }
}

export type VerifyTokenResult =
  | { valid: true; dong: string; ho: string }
  | { valid: false; reason: 'expired' | 'invalid' };

// 주민용 토큰(/check-submission 등) — 동/호/이름 대조만으로 발급되는 약한 인증.
// 3-파트 payload(dong|ho|expiry)만 인정.
export function verifyToken(token: string): VerifyTokenResult {
  const parts = verifySignedPayload(token);
  if (!parts || parts.length !== 3) return { valid: false, reason: 'invalid' };

  const [dong, ho, expiryStr] = parts;
  if (Date.now() > parseInt(expiryStr, 10)) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, dong, ho };
}

// 관리자 전용 열람 토큰(/api/admin/id-view-token) — pw 인증을 거친 관리자만 발급 가능.
// 4-파트('admin-view' 프리픽스 포함) payload라 주민 토큰(3-파트)과 구조적으로 섞일 수 없음.
// 신분증 사진 원본 바이트(/api/upload-id/image)는 이 토큰만 인정해야 함 — 주민 토큰이
// 통과되면 동/호/이름만 아는 제3자가 사진을 그대로 받아갈 수 있음(실제 확인된 취약점).
export function createAdminViewToken(dong: string, ho: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `admin-view|${dong}|${ho}|${expiry}`;
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${hmac}`).toString('base64url');
}

export function verifyAdminViewToken(token: string): VerifyTokenResult {
  const parts = verifySignedPayload(token);
  if (!parts || parts.length !== 4 || parts[0] !== 'admin-view') {
    return { valid: false, reason: 'invalid' };
  }
  const [, dong, ho, expiryStr] = parts;
  if (Date.now() > parseInt(expiryStr, 10)) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, dong, ho };
}
