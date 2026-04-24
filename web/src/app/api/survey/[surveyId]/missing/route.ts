import { NextRequest, NextResponse } from 'next/server';
import { getSurveyConfig } from '@/lib/surveys/registry';
import { getSurveyResponses } from '@/lib/survey-sheets';
import { BUILDING_CONFIG, getTotalUnits } from '@/lib/buildings';

type MissingByDong = {
  dong: string;
  total: number;
  responded: number;
  missing: string[];        // 미응답 호수: ["101호", ...]
  respondedHos: string[];   // 응답 호수: ["102호", ...]
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const config = getSurveyConfig(surveyId);
    const responses = await getSurveyResponses(config);

    const result: MissingByDong[] = [];

    for (const [dong, buildingConfig] of Object.entries(BUILDING_CONFIG)) {
      const total = getTotalUnits(dong);
      const excludedSet = new Set(buildingConfig.excludedUnits ?? []);

      const allHos: string[] = [];
      for (let floor = 1; floor <= buildingConfig.floors; floor++) {
        for (const unitSuffix of buildingConfig.units) {
          const ho = String(floor * 100 + unitSuffix);
          if (!excludedSet.has(ho)) {
            allHos.push(ho);
          }
        }
      }

      const respondedSet = new Set(
        responses
          .filter((r) => r.basicInfo.dong === dong)
          .map((r) => r.basicInfo.ho),
      );

      const missing = allHos
        .filter((ho) => !respondedSet.has(ho))
        .map((ho) => `${ho}호`);

      const respondedHoList = allHos
        .filter((ho) => respondedSet.has(ho))
        .map((ho) => `${ho}호`);

      result.push({ dong, total, responded: respondedSet.size, missing, respondedHos: respondedHoList });
    }

    result.sort((a, b) => a.responded / a.total - b.responded / b.total);

    return NextResponse.json({ missing: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('알 수 없는 설문') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
