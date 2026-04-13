import { NextRequest, NextResponse } from 'next/server';
import { getSurveyResponses, getResponseByIndex, markAsGenerated } from '@/lib/survey-sheets';
import { generateSurveyPdf, generateBlankSurveyPdf } from '@/lib/survey-pdf';

export async function POST(req: NextRequest) {
  try {
    const { mode, rowIndex } = await req.json();

    if (mode === 'blank') {
      const link = await generateBlankSurveyPdf();
      return NextResponse.json({ success: true, count: 1, links: [link] });
    }

    if (mode === 'single') {
      const response = await getResponseByIndex(rowIndex);
      if (!response) {
        return NextResponse.json({ error: '해당 응답 없음' }, { status: 404 });
      }
      const link = await generateSurveyPdf(response);
      await markAsGenerated(rowIndex, link);
      return NextResponse.json({ success: true, count: 1, links: [link] });
    }

    if (mode === 'all') {
      const responses = await getSurveyResponses();
      const pending = responses.filter(r => !r.pdfGenerated);

      if (pending.length === 0) {
        return NextResponse.json({ success: true, count: 0, links: [], message: '생성할 항목이 없습니다.' });
      }

      const links: string[] = [];
      for (const response of pending) {
        const link = await generateSurveyPdf(response);
        await markAsGenerated(response.rowIndex, link);
        links.push(link);
      }

      return NextResponse.json({ success: true, count: links.length, links });
    }

    return NextResponse.json({ error: 'mode는 all, single, blank 중 하나여야 합니다.' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
