import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';
import { addSurveyResponse, checkDuplicateResponse } from '@/lib/survey-sheets';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const config = getSurveyConfig(surveyId);
    const { basicInfo, answers, forceSubmit } = await req.json();

    // 필수 필드 검증
    for (const field of config.basicInfoFields) {
      if (field.required && !basicInfo?.[field.key]) {
        return NextResponse.json(
          { error: `${field.label}을(를) 입력해 주세요.` },
          { status: 400 },
        );
      }
    }

    for (const q of config.questions) {
      if (!answers?.[q.id]) {
        return NextResponse.json(
          { error: `"${q.label}" 항목을 선택해 주세요.` },
          { status: 400 },
        );
      }
    }

    // 중복 체크 (forceSubmit이 아닐 때만)
    if (!forceSubmit) {
      const dong = basicInfo?.dong || '';
      const ho = basicInfo?.ho || '';
      if (dong && ho) {
        const isDuplicate = await checkDuplicateResponse(config, dong, ho);
        if (isDuplicate) {
          return NextResponse.json({ duplicate: true }, { status: 409 });
        }
      }
    }

    await addSurveyResponse(config, basicInfo, answers);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('알 수 없는 설문') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
