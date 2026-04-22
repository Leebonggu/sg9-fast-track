import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';
import { checkDuplicateResponse } from '@/lib/survey-sheets';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const config = getSurveyConfig(surveyId);
    const dong = req.nextUrl.searchParams.get('dong') || '';
    const ho = req.nextUrl.searchParams.get('ho') || '';

    if (!dong || !ho) {
      return NextResponse.json({ duplicate: false });
    }

    const duplicate = await checkDuplicateResponse(config, dong, ho);
    return NextResponse.json({ duplicate });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
