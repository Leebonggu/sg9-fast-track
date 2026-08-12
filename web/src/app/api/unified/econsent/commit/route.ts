import { NextRequest, NextResponse } from 'next/server';
import { commitEconsentUpload } from '@/lib/econsent-import';

// 확정 — 「전자동의원본」을 덮고 「전자동의변경로그」에 전이 이력을 남긴다.
// 통합현황에는 쓰지 않는다. 반영하려면 이후 sync를 1회 실행해야 한다.
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
  const uploader = String(formData.get('uploader') || '').trim() || '(이름 없음)';

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
    const result = await commitEconsentUpload(sintoBuf, planBuf, uploader);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '업로드 실패' },
      { status: 400 },
    );
  }
}
