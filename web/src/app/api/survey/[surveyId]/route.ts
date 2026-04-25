import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';
import { getSurveyStats, getSurveyResponses, deleteSurveyResponse } from '@/lib/survey-sheets';

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

    const closedAt = config.closedAt || '';
    const isClosed = !!closedAt && new Date() >= new Date(closedAt);

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const { rowIndex } = await req.json();
    if (typeof rowIndex !== 'number') {
      return NextResponse.json({ error: 'rowIndex 필요' }, { status: 400 });
    }
    const config = getSurveyConfig(surveyId);
    await deleteSurveyResponse(config, rowIndex);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
