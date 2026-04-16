/**
 * 호환 레이어: 기존 코드에서 SURVEY_CONFIG를 참조하는 곳을 위해 유지.
 * 실제 설정은 surveys/survey-002.ts에 있음.
 */
export type { SurveyQuestion } from './surveys/types';
export { SURVEY_002_CONFIG as SURVEY_CONFIG } from './surveys/survey-002';
