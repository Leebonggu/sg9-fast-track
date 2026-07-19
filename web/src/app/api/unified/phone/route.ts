import { NextRequest, NextResponse } from 'next/server';
import { updatePhoneOverride } from '@/lib/owner-sheets';

export async function PATCH(req: NextRequest) {
  try {
    const { dong, ho, phone } = await req.json();
    if (!dong || !ho) {
      return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
    }
    // 관리자 입력 — 숫자/하이픈 위주지만 과한 검증은 하지 않는다. 빈값도 허용(연락처 삭제).
    await updatePhoneOverride(String(dong), String(ho), String(phone ?? '').trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '저장 실패' },
      { status: 500 },
    );
  }
}
