import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.GOOGLE_PRIVATE_KEY || '';
  return NextResponse.json({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'NOT SET',
    keyLength: key.length,
    keyStart: key.substring(0, 30),
    keyEnd: key.substring(key.length - 30),
    hasBeginMarker: key.includes('BEGIN PRIVATE KEY'),
    hasEndMarker: key.includes('END PRIVATE KEY'),
    hasBackslashN: key.includes('\\n'),
    hasRealNewline: key.includes('\n'),
    spreadsheetId: process.env.SPREADSHEET_ID || 'NOT SET',
  });
}
