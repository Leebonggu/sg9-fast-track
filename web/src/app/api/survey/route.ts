import { NextResponse } from 'next/server';
import { getSurveyStats, getSurveyResponses } from '@/lib/survey-sheets';

export async function GET() {
  try {
    const [stats, responses] = await Promise.all([
      getSurveyStats(),
      getSurveyResponses(),
    ]);
    return NextResponse.json({ stats, responses });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
