import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';
import { getSurveyStats, getSurveyResponses } from '@/lib/survey-sheets';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const config = getSurveyConfig(surveyId);

    const [stats, responses] = await Promise.all([
      getSurveyStats(config),
      getSurveyResponses(config),
    ]);

    return NextResponse.json({
      stats,
      responses,
      config: {
        id: config.id,
        title: config.title,
        organizer: config.organizer,
        intro: config.intro,
        notice: config.notice,
        basicInfoFields: config.basicInfoFields,
        questions: config.questions,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('알 수 없는 설문') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
