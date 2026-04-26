export type SurveyQuestion = {
  id: string;
  label: string;
  description?: string;
  options: string[];
};

export type BasicInfoField = {
  /** 내부 키 (e.g. 'dong', 'ho', 'name', 'phone', 'ageGroup') */
  key: string;
  /** Google Sheet 컬럼명 (e.g. '동', '호', '성명') */
  sheetColumn: string;
  /** UI 표시용 라벨 */
  label: string;
  type: 'text' | 'select';
  options?: string[];
  required: boolean;
};

export type SurveyConfig = {
  id: string;
  displayId?: string; // 통합현황 컬럼 표시용 (없으면 id 사용)
  title: string;
  organizer: string;
  intro: string;
  notice: string;
  closedAt?: string;  // 'YYYY-MM-DD' 형식, 설정 시 해당 날짜부터 마감
  basicInfoFields: BasicInfoField[];
  questions: SurveyQuestion[];
  envKeys: {
    spreadsheetId: string;
    templateDocId: string;
    pdfFolderId: string;
  };
};

export type SurveyResponse = {
  rowIndex: number;
  timestamp: string;
  basicInfo: Record<string, string>;
  answers: Record<string, string>;
  entryPath: string;
  pdfGenerated: boolean;
  pdfLink: string;
};

export type SurveyStats = {
  total: number;
  generated: number;
  pending: number;
};
