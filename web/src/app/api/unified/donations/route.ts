import { NextRequest, NextResponse } from 'next/server';
import { getDonations, getAllDonations, addDonation, updateDonation, cancelDonation } from '@/lib/donation';

function resolveOperator(req: NextRequest, fromBody: unknown): string {
  const name = typeof fromBody === 'string' ? fromBody.trim() : '';
  if (name) return name;
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim();
  if (ip) return `ip:${ip}`;
  return 'unknown';
}

export async function GET(req: NextRequest) {
  const dong = req.nextUrl.searchParams.get('dong');
  const ho = req.nextUrl.searchParams.get('ho');
  if (dong && ho) {
    const donations = await getDonations(dong, ho);
    return NextResponse.json({ donations });
  }
  const donations = await getAllDonations();
  return NextResponse.json({ donations });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dong, ho, paidDate, amount, registrant, note } = body ?? {};
  if (!dong || !ho || !paidDate || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  const operator = resolveOperator(req, registrant);
  await addDonation({
    dong: String(dong),
    ho: String(ho),
    paidDate: String(paidDate),
    amount,
    registrant: operator,
    note: typeof note === 'string' ? note : '',
  });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, paidDate, amount, note, operatorName } = body ?? {};
  if (!id) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  const updates: { paidDate?: string; amount?: number; note?: string } = {};
  if (paidDate !== undefined) updates.paidDate = String(paidDate);
  if (amount !== undefined) {
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: '금액이 올바르지 않습니다' }, { status: 400 });
    }
    updates.amount = amount;
  }
  if (note !== undefined) updates.note = String(note);

  const operator = resolveOperator(req, operatorName);
  await updateDonation(String(id), updates, operator);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id, operatorName } = body ?? {};
  if (!id) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  const operator = resolveOperator(req, operatorName);
  await cancelDonation(String(id), operator);
  return NextResponse.json({ success: true });
}
