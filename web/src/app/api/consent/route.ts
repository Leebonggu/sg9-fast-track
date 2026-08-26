import { NextRequest, NextResponse } from 'next/server';
import { addConsent, updateConsent, deleteConsent } from '@/lib/sheets';
import { updateConsentMirror } from '@/lib/owner-sheets';

export async function POST(req: NextRequest) {
  try {
    const { building, unit, name, collected, phone } = await req.json();
    await addConsent(building, unit, name, !!collected, phone ?? '');
    // 통합현황은 다음 정기 동기화 전까지 스냅샷이라, 안 해두면 새로고침 시 등록 전으로 되돌아간 것처럼 보인다.
    const dong = building.endsWith('동') ? building.slice(0, -1) : building;
    await updateConsentMirror(dong, unit, !!collected).catch((e) =>
      console.error('통합현황 신속통합동의서_제출_완료 즉시 반영 실패', e),
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { building, unit, name, phone } = await req.json();
    await updateConsent(building, unit, name, phone);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { building, unit } = await req.json();
    const collected = await deleteConsent(building, unit);
    const dong = building.endsWith('동') ? building.slice(0, -1) : building;
    await updateConsentMirror(dong, unit, collected).catch((e) =>
      console.error('통합현황 신속통합동의서_제출_완료 즉시 반영 실패', e),
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
