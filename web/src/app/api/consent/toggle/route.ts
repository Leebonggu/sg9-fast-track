import { NextRequest, NextResponse } from 'next/server';
import { toggleCollected } from '@/lib/sheets';
import { updateConsentMirror } from '@/lib/owner-sheets';

export async function POST(req: NextRequest) {
  try {
    const { building, unit } = await req.json();
    const collected = await toggleCollected(building, unit);
    // 제출 이력이 없는 세대 — 클라이언트가 성명 확인 후 /api/consent(POST)로 새 행을 만든다.
    if (collected === 'NO_ROW') {
      return NextResponse.json(
        { error: '해당 호수 데이터 없음', code: 'NO_ROW' },
        { status: 404 },
      );
    }
    // 중복 마킹된 행만 남은 세대 — 새로 만들면 진짜 중복이 되므로 생성 경로를 막는다.
    if (collected === 'DUP_ONLY') {
      return NextResponse.json(
        {
          error: '이 세대의 v2 행이 전부 "중복(이전 응답)"으로 마킹돼 있어 수정할 수 없습니다. 시트에서 마킹을 확인해 주세요.',
          code: 'DUP_ONLY',
        },
        { status: 409 },
      );
    }
    // 통합현황은 다음 정기 동기화 전까지 스냅샷이라, 안 해두면 새로고침 시 토글 전으로 되돌아간 것처럼 보인다.
    const dong = building.endsWith('동') ? building.slice(0, -1) : building;
    await updateConsentMirror(dong, unit, collected).catch((e) =>
      console.error('통합현황 신속통합동의서_제출_완료 즉시 반영 실패', e),
    );
    return NextResponse.json({ success: true, collected });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
