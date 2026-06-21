import { NextRequest, NextResponse } from 'next/server';
import { updateOpposition } from '@/lib/owner-sheets';

export async function PATCH(req: NextRequest) {
  const { dong, ho, opposition } = await req.json();
  if (!dong || !ho || typeof opposition !== 'boolean') {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  await updateOpposition(String(dong), String(ho), opposition);
  return NextResponse.json({ success: true });
}
