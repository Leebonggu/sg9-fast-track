import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const BUILDING_CONFIG: Record<string, { floors: number; units: number[]; excludedUnits?: string[] }> = {
  '901동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
  '902동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '903동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '904동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '905동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '906동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
  '907동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '908동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '909동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '910동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '911동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '912동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '913동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
  '914동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '915동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '916동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '917동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  '918동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7] },
  '919동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '920동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '921동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '922동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '923동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7] },
};

export { BUILDING_CONFIG };

// 컬럼 인덱스 (v2 시트 헤더 순서)
const COL = {
  TIMESTAMP: 0, NAME: 1, PHONE: 2, UNIT: 3,
  ADDRESS: 4, CONSENT: 5, PRIVACY: 6, SOURCE: 7,
  COLLECTED: 8, COLLECT_DATE: 9, COLLECTOR: 10, NOTE: 11,
};

let docCache: GoogleSpreadsheet | null = null;

async function getDoc(): Promise<GoogleSpreadsheet> {
  if (docCache) return docCache;

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '')
      .replace(/\\n/g, '\n')
      .replace(/"/g, ''),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
}

function getTotalUnits(building: string): number {
  const config = BUILDING_CONFIG[building];
  if (!config) return 0;
  return config.floors * config.units.length - (config.excludedUnits?.length || 0);
}

export async function getDashboardData() {
  const doc = await getDoc();
  const buildings = Object.keys(BUILDING_CONFIG);
  const result = [];
  let totalReceived = 0;
  let totalCollected = 0;
  let totalUnits = 0;

  const summarySheet = doc.sheetsByTitle['전체현황'];
  let summaryData: Record<string, { received: number; collected: number }> = {};

  if (summarySheet) {
    const rows = await summarySheet.getRows();
    for (const row of rows) {
      const dong = String(row.get('동') || '');
      const received = parseInt(String(row.get('응답수') || '0'), 10);
      const collected = parseInt(String(row.get('수거완료') || '0'), 10);
      if (dong && !isNaN(received)) {
        summaryData[dong] = { received, collected: isNaN(collected) ? 0 : collected };
      }
    }
  }

  for (const building of buildings) {
    const unitCount = getTotalUnits(building);
    const data = summaryData[building] || { received: 0, collected: 0 };

    result.push({
      building,
      received: data.received,
      collected: data.collected,
      total: unitCount,
      receivedRate: unitCount > 0 ? Math.round(data.received / unitCount * 1000) / 10 : 0,
      collectedRate: unitCount > 0 ? Math.round(data.collected / unitCount * 1000) / 10 : 0,
    });

    totalReceived += data.received;
    totalCollected += data.collected;
    totalUnits += unitCount;
  }

  return {
    buildings: result,
    totalReceived,
    totalCollected,
    totalUnits,
    receivedRate: totalUnits > 0 ? Math.round(totalReceived / totalUnits * 1000) / 10 : 0,
    collectedRate: totalUnits > 0 ? Math.round(totalCollected / totalUnits * 1000) / 10 : 0,
  };
}

export async function getBuildingData(building: string) {
  const config = BUILDING_CONFIG[building];
  if (!config) return null;

  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  const grid: Record<string, { name: string; source: string; timestamp: string; phone: string; collected: boolean }> = {};

  if (sheet) {
    const rows = await sheet.getRows();

    // 뒤에서부터 읽어서 최신 데이터만 수집
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const unit = String(row.get('호수') || '');
      const name = String(row.get('성명') || '');
      const note = String(row.get('비고') || '');

      if (!unit || !name) continue;
      if (note.includes('중복(이전 응답)')) continue;
      if (note.includes('삭제')) continue;
      if (grid[unit]) continue;

      const collectedVal = String(row.get('동의서수거여부') || '');
      grid[unit] = {
        name,
        source: String(row.get('입력경로') || ''),
        timestamp: String(row.get('타임스탬프') || ''),
        phone: String(row.get('연락처') || ''),
        collected: collectedVal === 'TRUE' || collectedVal === 'true',
      };
    }
  }

  const values = Object.values(grid);
  const onlineCount = values.filter(v => v.source === '온라인').length;
  const manualCount = values.filter(v => v.source !== '온라인').length;
  const onlineCollectedCount = values.filter(v => v.source === '온라인' && v.collected).length;
  const manualCollectedCount = values.filter(v => v.source !== '온라인' && v.collected).length;

  return {
    building,
    floors: config.floors,
    units: config.units,
    excludedUnits: config.excludedUnits || [],
    totalUnits: getTotalUnits(building),
    receivedCount: values.length,
    collectedCount: values.filter(v => v.collected).length,
    onlineCount,
    manualCount,
    onlineCollectedCount,
    manualCollectedCount,
    grid,
  };
}

export async function addConsent(building: string, unit: string, name: string, collected = false) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  if (!sheet) throw new Error('시트 없음: ' + building);

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  await sheet.addRow({
    '타임스탬프': now,
    '성명': name,
    '연락처': '',
    '호수': unit,
    '주민등록상주소': '',
    '사전동의여부': '신속통합기획 추진 검토에 동의합니다.',
    '개인정보동의여부': '개인정보 수집 및 이용에 동의합니다.',
    '입력경로': '수동입력(웹)',
    '동의서수거여부': collected ? 'TRUE' : 'FALSE',
    '수거일': collected ? now.split(' ')[0] : '',
    '수거자': '',
    '비고': '',
  });
}

export async function updateConsent(building: string, unit: string, newName: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  if (!sheet) throw new Error('시트 없음: ' + building);

  const rows = await sheet.getRows();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rowUnit = String(row.get('호수') || '');
    const note = String(row.get('비고') || '');

    if (rowUnit === unit && !note.includes('중복(이전 응답)') && !note.includes('삭제')) {
      row.set('성명', newName);
      await row.save();
      return;
    }
  }
  throw new Error('해당 호수 데이터 없음');
}

export async function deleteConsent(building: string, unit: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  if (!sheet) throw new Error('시트 없음: ' + building);

  const rows = await sheet.getRows();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rowUnit = String(row.get('호수') || '');
    const note = String(row.get('비고') || '');

    if (rowUnit === unit && !note.includes('중복(이전 응답)') && !note.includes('삭제')) {
      await row.delete();
      return;
    }
  }
  throw new Error('해당 호수 데이터 없음');
}

export async function toggleCollected(building: string, unit: string) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  if (!sheet) throw new Error('시트 없음: ' + building);

  const rows = await sheet.getRows();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rowUnit = String(row.get('호수') || '');
    const note = String(row.get('비고') || '');

    if (rowUnit === unit && !note.includes('중복(이전 응답)') && !note.includes('삭제')) {
      const current = String(row.get('동의서수거여부') || '');
      const newVal = (current === 'TRUE' || current === 'true') ? 'FALSE' : 'TRUE';
      row.set('동의서수거여부', newVal);
      await row.save();
      return newVal === 'TRUE';
    }
  }
  throw new Error('해당 호수 데이터 없음');
}
