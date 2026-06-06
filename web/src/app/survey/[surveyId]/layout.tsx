import type { Metadata } from 'next';
import { getSurveyConfig } from '@/lib/surveys/registry';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}): Promise<Metadata> {
  const { surveyId } = await params;
  try {
    const cfg = getSurveyConfig(surveyId);
    const desc = (cfg.intro ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return {
      title: `${cfg.title} — 상계주공 9단지`,
      description: desc || `${cfg.title} 응답`,
      openGraph: {
        title: cfg.title,
        description: desc || `${cfg.title} 응답`,
        type: 'website',
        locale: 'ko_KR',
      },
    };
  } catch {
    return { title: '설문 — 상계주공 9단지' };
  }
}

export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
