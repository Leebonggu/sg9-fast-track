import { NextRequest, NextResponse } from 'next/server';
import { getAllSurveyConfigs } from '@/lib/surveys/registry';
import { getSurveyResponses, markAsGenerated } from '@/lib/survey-sheets';
import { generateSurveyPdf } from '@/lib/survey-pdf';

export async function GET(req: NextRequest) {
  // Vercel Cron 인증 (CRON_SECRET 환경변수로 보호)
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configs = getAllSurveyConfigs();
  const results: { surveyId: string; generated: number; errors: string[] }[] = [];

  for (const config of configs) {
    const errors: string[] = [];
    let generated = 0;

    try {
      const responses = await getSurveyResponses(config);
      const pending = responses.filter((r) => !r.pdfGenerated);

      for (const response of pending) {
        try {
          const link = await generateSurveyPdf(config, response);
          await markAsGenerated(config, response.rowIndex, link);
          generated++;
        } catch (e) {
          errors.push(
            `rowIndex ${response.rowIndex}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    results.push({ surveyId: config.id, generated, errors });
  }

  const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
  console.log(`[cron] PDF 자동생성 완료: ${totalGenerated}건`, results);

  return NextResponse.json({ success: true, results });
}
