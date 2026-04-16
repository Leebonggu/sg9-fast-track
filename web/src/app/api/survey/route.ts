import { NextResponse } from 'next/server';
import { getAllSurveyConfigs } from '@/lib/surveys/registry';

export async function GET() {
  const configs = getAllSurveyConfigs();
  const surveys = configs.map((c) => ({
    id: c.id,
    title: c.title,
    organizer: c.organizer,
  }));
  return NextResponse.json({ surveys });
}
