import { NextRequest, NextResponse } from 'next/server';
import { getExistingDonationsByKey, bulkAddDonations, type BulkDonationInput } from '@/lib/donation';
import { buildDedupKey } from '@/lib/donation-import';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const records: BulkDonationInput[] = body.records ?? [];
  const registrant: string = body.registrant || '엑셀 일괄등록';

  const invalid = records.filter((r) => !r.dong || !r.ho || !r.amount || !r.iso);
  if (invalid.length > 0) {
    return NextResponse.json({ error: '동/호수/금액이 비어있는 레코드가 있습니다.' }, { status: 400 });
  }

  const existing = await getExistingDonationsByKey();
  const toInsert = records.filter((r) => !existing.has(buildDedupKey(r.iso, r.amount)));
  const skipped = records.length - toInsert.length;

  await bulkAddDonations(toInsert, registrant);

  return NextResponse.json({ inserted: toInsert.length, skipped });
}
