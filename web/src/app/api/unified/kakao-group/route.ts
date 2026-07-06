import { NextRequest, NextResponse } from 'next/server';
import { updateKakaoGroup } from '@/lib/owner-sheets';

export async function PATCH(req: NextRequest) {
  const { dong, ho, kakaoGroup } = await req.json();
  if (!dong || !ho || typeof kakaoGroup !== 'boolean') {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  await updateKakaoGroup(String(dong), String(ho), kakaoGroup);
  return NextResponse.json({ success: true });
}
