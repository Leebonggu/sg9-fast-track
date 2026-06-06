import { NextRequest, NextResponse } from 'next/server';
import { fetchIdImage } from '@/lib/id-upload';

// 관리자 전용 신분증 이미지 프록시.
// Drive 파일은 비공개라 직접 <img>로 못 열림 → 웹앱(idFetch)으로 바이트를 받아 스트리밍.
// pw는 POST body로 전달 → URL/로그에 비밀번호가 남지 않음.
export async function POST(req: NextRequest) {
  try {
    const { fileId, pw } = await req.json();
    if (pw !== process.env.APP_PASSWORD) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
    }
    if (!fileId) {
      return NextResponse.json({ error: 'fileId가 필요합니다.' }, { status: 400 });
    }
    const { base64, mimeType } = await fetchIdImage(String(fileId));
    const buf = Buffer.from(base64, 'base64');
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[upload-id/image] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
