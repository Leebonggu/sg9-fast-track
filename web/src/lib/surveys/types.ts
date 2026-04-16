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
  title: string;
  organizer: string;
  intro: string;
  notice: string;
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
  pdfGenerated: boolean;
  pdfLink: string;
};

export type SurveyStats = {
  total: number;
  generated: number;
  pending: number;
};
