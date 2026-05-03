import { NextRequest, NextResponse } from 'next/server';
import { createVerifyToken } from '@/lib/kakao-verify';
import { appendVerifyLog } from '@/lib/kakao-verify-log';

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

    const { dong: rawDong, ho: rawHo } = await req.json();

    if (!rawDong || !rawHo) {
      return NextResponse.json({ error: '동과 호수를 입력해 주세요.' }, { status: 400 });
    }

    const dong = String(rawDong).replace(/동$/, '').trim();
    const ho = String(rawHo).trim();

    const token = createVerifyToken(dong, ho);
    await appendVerifyLog(dong, ho, '', '어드민발급', ip);

    return NextResponse.json({ token });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
