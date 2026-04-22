import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';
import { getSurveyResponses, getResponseByIndex, markAsGenerated } from '@/lib/survey-sheets';
import { generateSurveyPdf, generateBlankSurveyPdf } from '@/lib/survey-pdf';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const config = getSurveyConfig(surveyId);
    const { mode, rowIndex } = await req.json();

    if (mode === 'blank') {
      const link = await generateBlankSurveyPdf(config);
      return NextResponse.json({ success: true, count: 1, links: [link] });
    }

    if (mode === 'single') {
      const response = await getResponseByIndex(config, rowIndex);
      if (!response) {
        return NextResponse.json({ error: '해당 응답 없음' }, { status: 404 });
      }
      const link = await generateSurveyPdf(config, response);
      await markAsGenerated(config, rowIndex, link);
      return NextResponse.json({ success: true, count: 1, links: [link] });
    }

    if (mode === 'all') {
      const BATCH_SIZE = 5;
      const responses = await getSurveyResponses(config);
      const pending = responses.filter((r) => !r.pdfGenerated);

      if (pending.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          remaining: 0,
          links: [],
          message: '생성할 항목이 없습니다.',
        });
      }

      const batch = pending.slice(0, BATCH_SIZE);
      const links: string[] = [];
      for (const response of batch) {
        const link = await generateSurveyPdf(config, response);
        await markAsGenerated(config, response.rowIndex, link);
        links.push(link);
      }

      const remaining = pending.length - batch.length;
      return NextResponse.json({ success: true, count: links.length, remaining, links });
    }

    return NextResponse.json(
      { error: 'mode는 all, single, blank 중 하나여야 합니다.' },
      { status: 400 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('알 수 없는 설문') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
