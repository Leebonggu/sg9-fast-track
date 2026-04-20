import type { SurveyConfig } from './types';

const DONG_OPTIONS = Array.from({ length: 23 }, (_, i) => `${901 + i}동`);

export const SURVEY_001_CONFIG: SurveyConfig = {
  id: 'survey-001',
  title: '상계9단지 재건축 관련 간단 설문 (1차)',
  organizer: '상계주공9단지아파트 재건축추진준비위원회',
  intro:
    '안녕하십니까.\n' +
    '상계9단지 주민 여러분의 재건축 관련 의견을 확인하고자 간단한 설문을 진행합니다.\n' +
    '소요시간은 약 30초입니다.',
  notice:
    '본 설문은 재건축 추진을 위한 주민 의견 참고자료로만 활용됩니다.\n감사합니다.',
  basicInfoFields: [
    {
      key: 'dong',
      sheetColumn: '동',
      label: '동',
      type: 'select',
      options: DONG_OPTIONS,
      required: true,
    },
    {
      key: 'ho',
      sheetColumn: '호',
      label: '호수',
      type: 'text',
      required: true,
    },
    {
      key: 'name',
      sheetColumn: '성명',
      label: '성명',
      type: 'text',
      required: true,
    },
    {
      key: 'phone',
      sheetColumn: '연락처',
      label: '연락처',
      type: 'text',
      required: true,
    },
    {
      key: 'ageGroup',
      sheetColumn: '연령대',
      label: '연령대',
      type: 'select',
      options: ['20대', '30대', '40대', '50대', '60대 이상'],
      required: true,
    },
  ],
  questions: [
    {
      id: 'Q1',
      label: '우리 단지 재건축이 필요하다고 생각하십니까?',
      options: ['필요하다', '잘 모르겠다', '필요하지 않다'],
    },
    {
      id: 'Q2',
      label: '재건축이 추진된다면 어떤 방향이 더 중요하다고 생각하십니까?',
      options: [
        '사업 지연 없이 최대한 빠르게 추진하는 것 (속도 우선)',
        '시간과 비용이 더 들더라도 신중하게 추진하는 것',
        '잘 모르겠다',
      ],
    },
    {
      id: 'Q3',
      label:
        '마들역 인근 단지(임광, 마들대림, 상계주공10·11단지, 상계보람 등)가 재건축 안전진단 완료 및 신속통합기획 접수를 진행 중인 사실을 알고 계셨습니까?',
      options: ['잘 알고 있다', '어느 정도 알고 있다', '잘 모른다'],
    },
    {
      id: 'Q4',
      label:
        '상계주공 9단지가 서울시 복합정비구역으로 지정·고시되어 고층 개발(약 60층 수준)이 가능하다는 점을 알고 계셨습니까?',
      options: ['알고 있다', '처음 알았다'],
    },
    {
      id: 'Q5',
      label: '향후 재건축 관련 정보 안내를 받아보시겠습니까?',
      options: ['희망한다', '희망하지 않는다'],
    },
    {
      id: 'Q6',
      label: '재건축 후 선호하는 평형대는 어떻게 됩니까?',
      options: ['10평대', '20평대', '30평대', '40평대 이상'],
    },
  ],
  closedAt: '2026-12-31',
  envKeys: {
    spreadsheetId: 'SURVEY_001_SPREADSHEET_ID',
    templateDocId: 'SURVEY_001_TEMPLATE_DOC_ID',
    pdfFolderId: 'SURVEY_001_PDF_FOLDER_ID',
  },
};
