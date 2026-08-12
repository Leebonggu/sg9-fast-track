import { NextRequest, NextResponse } from 'next/server';
import { previewEconsentUpload } from '@/lib/econsent-import';

// 파일 2개를 받아 파싱·집계하고 직전 업로드 대비 변경분을 돌려준다. 시트에는 쓰지 않는다.
// /api/unified/* 는 middleware.ts가 x-app-password로 보호한다.
export async function POST(req: NextRequest) {
  // body가 multipart가 아니면 formData()가 그대로 던져서 500이 된다 → 400으로 받아준다.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '파일 업로드 형식이 아닙니다.' }, { status: 400 });
  }
  const sinto = formData.get('sinto');
  const plan = formData.get('plan');

  if (!(sinto instanceof Blob) || !(plan instanceof Blob)) {
    return NextResponse.json(
      { error: '신속통합·정비계획입안 파일 2개를 모두 선택해 주세요.' },
      { status: 400 },
    );
  }

  const [sintoBuf, planBuf] = await Promise.all([
    sinto.arrayBuffer().then(Buffer.from),
    plan.arrayBuffer().then(Buffer.from),
  ]);

  try {
    const preview = await previewEconsentUpload(sintoBuf, planBuf);
    return NextResponse.json(preview);
  } catch (e) {
    // 파서는 파일이 뒤바뀌었거나 짝이 안 맞으면 사람이 읽을 수 있는 메시지로 throw한다.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '파싱 실패' },
      { status: 400 },
    );
  }
}
