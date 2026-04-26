import type { SurveyConfig } from './types';
import { SURVEY_001_CONFIG } from './survey-001';

const SURVEY_REGISTRY: Record<string, SurveyConfig> = {
  '2026_04_기본조사_제출': SURVEY_001_CONFIG,
};

export function getSurveyConfig(surveyId: string): SurveyConfig {
  const config = SURVEY_REGISTRY[surveyId];
  if (!config) throw new Error(`알 수 없는 설문: ${surveyId}`);
  return config;
}

export function getAllSurveyConfigs(): SurveyConfig[] {
  return Object.values(SURVEY_REGISTRY);
}
