import { NextRequest, NextResponse } from 'next/server';
import { updateOwnerRecord } from '@/lib/owner-sheets';
import type { UnifiedRowOverrides } from '@/lib/unified-types';

const ALLOWED_RESIDENCY = new Set(['', '실거주', '임대']);

function pickString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  return String(v);
}

function resolveOperator(req: NextRequest, fromBody: unknown): string {
  const name = typeof fromBody === 'string' ? fromBody.trim() : '';
  if (name) return name;
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim();
  if (ip) return `ip:${ip}`;
  return 'unknown';
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { dong, ho, overrides, operatorName } = body ?? {};
  if (!dong || !ho || !overrides || typeof overrides !== 'object') {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  const o: UnifiedRowOverrides = {};
  const ownerName = pickString(overrides.ownerName);
  const postalCode = pickString(overrides.postalCode);
  const address = pickString(overrides.address);
  const residency = pickString(overrides.residency);
  if (ownerName !== undefined) o.ownerName = ownerName;
  if (postalCode !== undefined) o.postalCode = postalCode;
  if (address !== undefined) o.address = address;
  if (residency !== undefined) {
    if (!ALLOWED_RESIDENCY.has(residency)) {
      return NextResponse.json({ error: '허용되지 않은 실거주여부 값' }, { status: 400 });
    }
    o.residency = residency;
  }
  if (Object.keys(o).length === 0) {
    return NextResponse.json({ error: '수정할 필드가 없습니다' }, { status: 400 });
  }
  const operator = resolveOperator(req, operatorName);
  const result = await updateOwnerRecord(String(dong), String(ho), o, operator);
  return NextResponse.json({ success: true, changes: result.changes, operator });
}
