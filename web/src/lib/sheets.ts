import { GoogleSpreadsheet } from 'google-spreadsheet';
import { BUILDING_CONFIG, getTotalUnits } from './buildings';
import { getServiceAccountAuth } from './google-auth';

export { BUILDING_CONFIG };

let docCache: GoogleSpreadsheet | null = null;

async function getDoc(): Promise<GoogleSpreadsheet> {
  if (docCache) return docCache;

  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  docCache = doc;
  return doc;
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
  type GridEntry = { name: string; source: string; timestamp: string; phone: string; collected: boolean };
  const grid: Record<string, GridEntry> = {};
  const duplicates: Record<string, GridEntry[]> = {};
  const unitCount: Record<string, number> = {};

  if (sheet) {
    const rows = await sheet.getRows();

    // 뒤에서부터 읽어서 최신 데이터만 수집 + 중복 추적
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const unit = String(row.get('호수') || '');
      const name = String(row.get('성명') || '');
      const note = String(row.get('비고') || '');

      if (!unit || !name) continue;
      if (note.includes('중복(이전 응답)')) continue;
      if (note.trim() === '삭제') continue;

      const collectedVal = String(row.get('동의서수거여부') || '');
      const entry: GridEntry = {
        name,
        source: String(row.get('입력경로') || ''),
        timestamp: String(row.get('타임스탬프') || ''),
        phone: String(row.get('연락처') || ''),
        collected: collectedVal === 'TRUE' || collectedVal === 'true',
      };

      unitCount[unit] = (unitCount[unit] || 0) + 1;

      if (!grid[unit]) {
        grid[unit] = entry;
      } else {
        if (!duplicates[unit]) duplicates[unit] = [];
        duplicates[unit].push(entry);
      }
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
    duplicates,
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
    '주민등록상주소': `노원구 노원로 532, ${building} ${unit}호`,
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

    if (rowUnit === unit && !note.includes('중복(이전 응답)') && note.trim() !== '삭제') {
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

    if (rowUnit === unit && !note.includes('중복(이전 응답)') && note.trim() !== '삭제') {
      await row.delete();

      // 삭제 후 같은 호수의 "중복(이전 응답)" 마킹된 행이 남아있으면 마킹 해제 (최신 1개만)
      const remainingRows = await sheet.getRows();
      for (let j = remainingRows.length - 1; j >= 0; j--) {
        const r = remainingRows[j];
        const rUnit = String(r.get('호수') || '');
        const rNote = String(r.get('비고') || '');
        if (rUnit === unit && rNote.includes('중복(이전 응답)') && !rNote.includes('삭제')) {
          r.set('비고', rNote.replace('중복(이전 응답)', '').trim());
          await r.save();
          break;
        }
      }
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

    if (rowUnit === unit && !note.includes('중복(이전 응답)') && note.trim() !== '삭제') {
      const current = String(row.get('동의서수거여부') || '');
      const newVal = (current === 'TRUE' || current === 'true') ? 'FALSE' : 'TRUE';
      row.set('동의서수거여부', newVal);
      await row.save();
      return newVal === 'TRUE';
    }
  }
  throw new Error('해당 호수 데이터 없음');
}
