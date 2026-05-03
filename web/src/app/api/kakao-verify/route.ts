import { NextRequest, NextResponse } from 'next/server';
import { getOwnersByDongHo } from '@/lib/owner-sheets';
import { createVerifyToken } from '@/lib/kakao-verify';
import { checkRateLimit, appendVerifyLog } from '@/lib/kakao-verify-log';

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

    const blocked = await checkRateLimit(ip);
    if (blocked) {
      return NextResponse.json(
        { error: '잠시 후 다시 시도해 주세요. (10분 후 재시도 가능)' },
        { status: 429 },
      );
    }

    const { dong: rawDong, ho: rawHo, name: rawName } = await req.json();

    if (!rawDong || !rawHo || !rawName) {
      return NextResponse.json(
        { error: '동, 호수, 이름을 모두 입력해 주세요.' },
        { status: 400 },
      );
    }

    // "901동" → "901"
    const dong = String(rawDong).replace(/동$/, '').trim();
    const ho = String(rawHo).trim();
    const name = String(rawName).trim();

    const owners = await getOwnersByDongHo(dong, ho);

    const notFound = owners.length === 0;
    const matched =
      !notFound &&
      owners.some((o) => o.replace(/\s/g, '') === name.replace(/\s/g, ''));

    if (notFound || !matched) {
      await appendVerifyLog(dong, ho, name, '실패', ip);
      return NextResponse.json(
        { error: '동/호수 또는 이름이 일치하지 않습니다. 다시 확인해 주세요.' },
        { status: 403 },
      );
    }

    await appendVerifyLog(dong, ho, name, '성공', ip);
    const token = createVerifyToken(dong, ho);

    return NextResponse.json({ token });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[kakao-verify] API error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
