import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const config = getSurveyConfig(surveyId);

    const closedAtEnvKey = config.envKeys.closedAt;
    const closedAt = closedAtEnvKey ? (process.env[closedAtEnvKey] || '') : '';
    const isClosed = !!closedAt && new Date() >= new Date(closedAt);

    return NextResponse.json({
      config: {
        id: config.id,
        title: config.title,
        organizer: config.organizer,
        intro: config.intro,
        notice: config.notice,
        basicInfoFields: config.basicInfoFields,
        questions: config.questions,
        isClosed,
        closedAt,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('알 수 없는 설문') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
