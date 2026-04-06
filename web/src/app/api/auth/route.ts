import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const ok = password === process.env.APP_PASSWORD;
  return NextResponse.json({ ok });
}
