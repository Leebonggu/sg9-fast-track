import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 30 * 60 * 1000;

function getSecret(): string {
  const s = process.env.VERIFY_SECRET;
  if (!s) throw new Error('VERIFY_SECRET 환경변수가 설정되지 않았습니다.');
  return s;
}

export function createVerifyToken(dong: string, ho: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${dong}|${ho}|${expiry}`;
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${hmac}`).toString('base64url');
}

export type VerifyTokenResult =
  | { valid: true; dong: string; ho: string }
  | { valid: false; reason: 'expired' | 'invalid' };

export function verifyToken(token: string): VerifyTokenResult {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return { valid: false, reason: 'invalid' };

    const payload = decoded.slice(0, lastDot);
    const providedHmac = decoded.slice(lastDot + 1);

    const expectedHmac = createHmac('sha256', getSecret())
      .update(payload)
      .digest('base64url');

    const a = Buffer.from(providedHmac);
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'invalid' };
    }

    const parts = payload.split('|');
    if (parts.length !== 3) return { valid: false, reason: 'invalid' };

    const [dong, ho, expiryStr] = parts;
    if (Date.now() > parseInt(expiryStr, 10)) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, dong, ho };
  } catch {
    return { valid: false, reason: 'invalid' };
  }
}
