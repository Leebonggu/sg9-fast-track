import { NextRequest, NextResponse } from 'next/server';
import { addConsent, updateConsent, deleteConsent } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const { building, unit, name, collected } = await req.json();
    await addConsent(building, unit, name, !!collected);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { building, unit, name } = await req.json();
    await updateConsent(building, unit, name);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { building, unit } = await req.json();
    await deleteConsent(building, unit);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
