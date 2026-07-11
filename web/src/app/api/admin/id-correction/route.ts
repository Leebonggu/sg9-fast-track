import { NextRequest, NextResponse } from 'next/server';
import { createVerifyToken } from '@/lib/kakao-verify';
import { appendVerifyLog } from '@/lib/kakao-verify-log';
import { getClientIp } from '@/lib/request-ip';
import { allowCorrection } from '@/lib/id-upload';

// 관리자 전용: 이미 제출된 신분증 슬롯에 대해 1회성 정정 윈도우를 연다.
// middleware.ts가 x-app-password 헤더를 검사하므로 여기서 별도 pw 체크 불필요.
export async function POST(req: NextRequest) {
  try {
    const { dong: rawDong, ho: rawHo, ownerIndex } = await req.json();
    if (!rawDong || !rawHo || ownerIndex === undefined) {
      return NextResponse.json({ error: '동, 호수, 소유자 순번이 필요합니다.' }, { status: 400 });
    }

    const dong = String(rawDong).replace(/동$/, '').trim();
    const ho = String(rawHo).trim();
    const idx = Number(ownerIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json({ error: '잘못된 소유자 순번입니다.' }, { status: 400 });
    }

    const ok = await allowCorrection(dong, ho, idx);
    if (!ok) {
      return NextResponse.json({ error: '제출 이력이 없는 슬롯입니다.' }, { status: 404 });
    }

    const token = createVerifyToken(dong, ho);
    await appendVerifyLog(dong, ho, `소유자${idx + 1}`, '어드민발급', getClientIp(req));

    return NextResponse.json({ token });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[admin/id-correction] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
