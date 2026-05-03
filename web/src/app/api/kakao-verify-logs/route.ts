import { NextResponse } from 'next/server';
import { getVerifyLogs } from '@/lib/kakao-verify-log';

export async function GET() {
  try {
    const logs = await getVerifyLogs();
    return NextResponse.json({ logs });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
