import { NextRequest, NextResponse } from 'next/server';
import { parseImportFile, classifyRows } from '@/lib/donation-import';
import { getExistingDonationsByKey } from '@/lib/donation';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseImportFile(buffer);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '파싱 실패' }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ new: [], review: [], duplicates: [] });
  }

  const existing = await getExistingDonationsByKey();
  const classified = classifyRows(parsed, existing);

  return NextResponse.json({
    new: classified.filter((r) => r.classification === 'new'),
    review: classified.filter((r) => r.classification === 'review'),
    duplicates: classified.filter((r) => r.classification === 'duplicate'),
  });
}
