import { NextRequest, NextResponse } from 'next/server';
import { updateMemo } from '@/lib/owner-sheets';

export async function PATCH(req: NextRequest) {
  const { dong, ho, memo } = await req.json();
  if (!dong || !ho || memo === undefined) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  await updateMemo(String(dong), String(ho), String(memo));
  return NextResponse.json({ success: true });
}
