import { NextRequest, NextResponse } from 'next/server';
import { updatePlanTracking } from '@/lib/owner-sheets';

const FIELDS = ['consent', 'privacy', 'id'] as const;

export async function PATCH(req: NextRequest) {
  const { dong, ho, field, value } = await req.json();
  if (!dong || !ho || typeof value !== 'boolean' || !FIELDS.includes(field)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  await updatePlanTracking(String(dong), String(ho), field, value);
  return NextResponse.json({ success: true });
}
