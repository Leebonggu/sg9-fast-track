import { NextRequest, NextResponse } from 'next/server';
import { getMasterRows } from '@/lib/owner-sheets';

export async function GET(req: NextRequest) {
  const dong = req.nextUrl.searchParams.get('dong'); // "901" or null
  const { rows, surveyIds } = await getMasterRows();
  const filtered = dong ? rows.filter((r) => r.dong === dong) : rows;
  return NextResponse.json({ rows: filtered, surveyIds });
}
