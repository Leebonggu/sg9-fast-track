import type { SurveyConfig } from './types';

const DONG_OPTIONS = Array.from({ length: 23 }, (_, i) => `${901 + i}동`);

export const SURVEY_002_CONFIG: SurveyConfig = {
  id: 'survey-002',
  title: '상계9단지 재건축 추진 의향 설문',
  organizer: '상계주공9단지아파트 재건축추진준비위원회',
  intro:
    '안녕하십니까.\n' +
    '상계9단지는 2021년 예비안전진단 이후 현재까지 사업이 멈춰 있는 상태입니다.\n' +
    '반면, 주변 단지들은 재건축이 빠르게 진행되고 있어 격차가 벌어지고 있습니다.\n' +
    '이에 따라 주민 여러분의 의견을 확인하고자 합니다.',
  notice:
    '본 설문은 재건축 추진을 위한 참고자료로만 활용되며, 개인정보는 외부에 공개되지 않습니다.',
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
  ],
  questions: [
    {
      id: 'Q2',
      label: '재건축 필요성',
      options: ['매우 필요', '필요', '보통', '불필요'],
    },
    {
      id: 'Q3',
      label: '현재 상황에 대한 인식',
      options: ['빠른 추진이 필요하다', '현 상태 유지도 괜찮다', '잘 모르겠다'],
    },
    {
      id: 'Q4',
      label: '재건축 추진 의향',
      options: ['적극 찬성', '조건부 찬성', '반대', '잘 모르겠다'],
    },
    {
      id: 'Q5',
      label: '추진 시 가장 중요한 요소 (1개 선택)',
      options: ['사업 속도', '수익성', '안정성', '주거환경 개선'],
    },
    {
      id: 'Q6',
      label: '향후 추진 시 참여 의향',
      options: ['적극 참여', '상황 보고 참여', '참여하지 않음'],
    },
    {
      id: 'Q7',
      label: '추진 방식 비교 (참고 후 선택)',
      description:
        '[ 조합방식 ] 주민 주도 / 수익성 높음 / 조합원 간 갈등 및 사업기간 지연 시 비용 증가로 수익률 하락 가능\n' +
        '[ 신탁방식 ] 신탁사 주도 / 사업 속도 빠름 / 수익 일부 제한',
      options: ['조합방식 선호', '신탁방식 선호', '잘 모르겠다'],
    },
    {
      id: 'Q8',
      label: '재건축 시 선호 평형 (1개 선택)',
      options: ['20평대', '30평대', '40평대 이상', '잘 모르겠다'],
    },
  ],
  // closedAt: '2025-04-30',  // 마감일 설정 시 주석 해제
  envKeys: {
    spreadsheetId: 'SURVEY_002_SPREADSHEET_ID',
    templateDocId: 'SURVEY_002_TEMPLATE_DOC_ID',
    pdfFolderId: 'SURVEY_002_PDF_FOLDER_ID',
  },
};
