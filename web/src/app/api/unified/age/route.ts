import { NextRequest, NextResponse } from 'next/server';
import { updateAge } from '@/lib/owner-sheets';
import { AGE_GROUP_OPTIONS } from '@/lib/unified-utils';

export async function PATCH(req: NextRequest) {
  const { dong, ho, ageGroup } = await req.json();
  if (!dong || !ho || typeof ageGroup !== 'string' || !AGE_GROUP_OPTIONS.includes(ageGroup)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  await updateAge(String(dong), String(ho), ageGroup);
  return NextResponse.json({ success: true });
}
