import { NextRequest, NextResponse } from 'next/server';
import { fetchIdImage, getIdUploads } from '@/lib/id-upload';
import { verifyAdminViewToken } from '@/lib/kakao-verify';

// 관리자 전용 신분증 이미지 프록시.
// Drive 파일은 비공개라 직접 <img>로 못 열림 → 웹앱(idFetch)으로 바이트를 받아 스트리밍.
// pw(관리자 비밀번호) 또는 t(관리자 전용 열람 토큰, createAdminViewToken) 중 하나로 인증 —
// 둘 다 POST body로만 전달돼 URL/로그에 남지 않음.
// ⚠️ t는 반드시 verifyAdminViewToken이어야 함. 주민용 verifyToken(동/호/이름만으로 발급)을
// 여기서 받아주면, 동/호/이름만 아는 제3자가 신분증 사진 원본을 그대로 받아갈 수 있다
// (실제 재현 확인된 취약점 — 2026-07-12).
// t 경로는 요청한 fileId가 실제 그 토큰의 (동,호) 소유인지도 별도 검증한다(스코프 밖 fileId 차단).
export async function POST(req: NextRequest) {
  try {
    const { fileId, pw, t } = await req.json();
    if (!fileId) {
      return NextResponse.json({ error: 'fileId가 필요합니다.' }, { status: 400 });
    }
    if (pw !== process.env.APP_PASSWORD) {
      if (!t) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
      }
      const tok = verifyAdminViewToken(String(t));
      if (!tok.valid) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
      }
      const uploads = await getIdUploads(tok.dong, tok.ho);
      if (!uploads.some((u) => u.fileId === fileId)) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
      }
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
