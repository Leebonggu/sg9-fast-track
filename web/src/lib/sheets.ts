import { GoogleSpreadsheet } from 'google-spreadsheet';
import { google } from 'googleapis';
import { BUILDING_CONFIG, getTotalUnits } from './buildings';
import { getServiceAccountAuth } from './google-auth';
import { normalizePhone } from './phone-format';

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

export async function addConsent(building: string, unit: string, name: string, collected = false, phone = '') {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  if (!sheet) throw new Error('시트 없음: ' + building);

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  await sheet.addRow({
    '타임스탬프': now,
    '성명': name,
    '연락처': phone,
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

export async function updateConsent(building: string, unit: string, newName: string, phone?: string) {
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
      if (phone !== undefined) row.set('연락처', phone);
      await row.save();
      return;
    }
  }
  throw new Error('해당 호수 데이터 없음');
}

// 삭제 후 이 세대의 동의서수거여부 최종 상태를 반환한다(호출부가 통합현황 즉시 반영에 씀).
// 마킹 해제된 중복행이 남으면 그 행의 값, 아무 행도 안 남으면 false(미제출).
export async function deleteConsent(building: string, unit: string): Promise<boolean> {
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
          const restored = String(r.get('동의서수거여부') || '');
          return restored === 'TRUE' || restored === 'true';
        }
      }
      return false;
    }
  }
  throw new Error('해당 호수 데이터 없음');
}

// 기존 제출 행의 수거여부만 뒤집는다. 뒤집을 행이 없을 때 두 경우를 구분해서 알린다.
//   'NO_ROW'   — 제출 이력이 전혀 없음(전체 2,830세대 중 다수). 호출부에서 새 행 생성 가능.
//   'DUP_ONLY' — 행은 있는데 전부 '중복(이전 응답)' 마킹. 짝이 사라진 고아 마킹일 수 있으므로
//                새로 만들면 진짜 중복이 된다. 시트에서 마킹을 확인·해제해야 한다.
export async function toggleCollected(
  building: string,
  unit: string,
): Promise<boolean | 'NO_ROW' | 'DUP_ONLY'> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[building];
  if (!sheet) throw new Error('시트 없음: ' + building);

  const rows = await sheet.getRows();
  let duplicateOnly = false;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rowUnit = String(row.get('호수') || '');
    const note = String(row.get('비고') || '');

    if (rowUnit !== unit || note.trim() === '삭제') continue;
    if (note.includes('중복(이전 응답)')) { duplicateOnly = true; continue; }

    const current = String(row.get('동의서수거여부') || '');
    const newVal = (current === 'TRUE' || current === 'true') ? 'FALSE' : 'TRUE';
    row.set('동의서수거여부', newVal);
    await row.save();
    return newVal === 'TRUE';
  }
  return duplicateOnly ? 'DUP_ONLY' : 'NO_ROW';
}

// 사전동의 완료 세대 키셋 반환: Set<"901-101"> + 중복 TRUE 행 목록
export async function getConsentKeyset(): Promise<{
  keys: Set<string>;
  nameMap: Map<string, string>;
  duplicates: { dong: string; ho: string; count: number }[];
}> {
  const doc = await getDoc();
  const dongs = Object.keys(BUILDING_CONFIG); // ["901동", "902동", ...]
  const keys = new Set<string>();
  const nameMap = new Map<string, string>(); // "901-101" → "홍길동"
  const duplicates: { dong: string; ho: string; count: number }[] = [];

  for (const dongKey of dongs) {
    const dongNum = dongKey.replace('동', ''); // "901동" → "901"
    const sheet = doc.sheetsByTitle[dongKey];
    if (!sheet) continue;
    const rows = await sheet.getRows();
    const countMap: Record<string, number> = {};
    for (const row of rows) {
      const ho = String(row.get('호수') || '').trim();
      const collected = String(row.get('동의서수거여부') || '').trim();
      const name = String(row.get('성명') || '').trim();
      const note = String(row.get('비고') || '').trim();
      if (!ho || collected !== 'TRUE' || note === '삭제') continue;
      const key = `${dongNum}-${ho}`;
      keys.add(key);
      if (name) nameMap.set(key, name);
      countMap[ho] = (countMap[ho] || 0) + 1;
    }
    for (const [ho, count] of Object.entries(countMap)) {
      if (count > 1) duplicates.push({ dong: dongKey, ho, count });
    }
  }

  return { keys, nameMap, duplicates };
}

// 동별 시트에서 세대별 연락처 맵 (폼 제출한 모든 세대, 수거여부 무관)
// key "901-101" → "홍길동 010-1234-5678" 또는 공동/다중 제출 시 "홍길동 010-... / 김철수 010-...".
// 최신(뒤쪽) 행 우선, 같은 번호는 중복 제거, 빈 연락처·삭제·중복행 제외.
export async function getPhoneMap(): Promise<Map<string, string>> {
  const doc = await getDoc();
  const dongs = Object.keys(BUILDING_CONFIG);
  const acc = new Map<string, { seen: Set<string>; entries: string[] }>();
  for (const dongKey of dongs) {
    const dongNum = dongKey.replace('동', '');
    const sheet = doc.sheetsByTitle[dongKey];
    if (!sheet) continue;
    const rows = await sheet.getRows();
    // 뒤에서부터 읽어 최신 응답 우선
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const ho = String(row.get('호수') || '').trim();
      // v2 시트도 번호를 숫자로 저장해 선행 0이 날아가 있다(1,073건 중 1,071건).
      // 시트 원본은 그대로 두고 읽는 쪽에서만 복원한다.
      const phone = normalizePhone(String(row.get('연락처') || '').trim());
      const name = String(row.get('성명') || '').trim();
      const note = String(row.get('비고') || '').trim();
      if (!ho || !phone) continue;
      if (note === '삭제' || note.includes('중복(이전 응답)')) continue;
      const key = `${dongNum}-${ho}`;
      let d = acc.get(key);
      if (!d) { d = { seen: new Set(), entries: [] }; acc.set(key, d); }
      if (!d.seen.has(phone)) {           // 같은 번호 중복 제거
        d.seen.add(phone);
        d.entries.push(name ? `${name} ${phone}` : phone);
      }
    }
  }
  return new Map([...acc].map(([k, d]) => [k, d.entries.join(' / ')]));
}

/**
 * 동의 현황과 연락처를 v2 동별 시트에서 한 번에 읽는다.
 *
 * getConsentKeyset과 getPhoneMap은 같은 23개 시트를 각각 getRows()로 훑어
 * 합쳐서 46회를 호출했다. Sheets 읽기 쿼터가 사용자당 분당 60회라 sync 한 번에
 * 그 대부분을 써버렸고, 2026-08-13에 실제로 429가 나면서 쓰기 도중 끊겨
 * 통합현황 2,830행이 날아갔다.
 *
 * batchGet은 여러 범위를 한 번의 호출로 가져온다 → 46회가 1회가 된다.
 * 판정 규칙은 기존 두 함수와 동일하게 유지한다.
 */
export async function getConsentAndPhone(): Promise<{
  consent: Awaited<ReturnType<typeof getConsentKeyset>>;
  phones: Map<string, string>;
}> {
  const dongs = Object.keys(BUILDING_CONFIG);
  const api = google.sheets({ version: 'v4', auth: getServiceAccountAuth() });
  const res = await api.spreadsheets.values.batchGet({
    spreadsheetId: process.env.SPREADSHEET_ID!,
    ranges: dongs.map((d) => `'${d}'!A:L`),
  });

  const keys = new Set<string>();
  const nameMap = new Map<string, string>();
  const duplicates: { dong: string; ho: string; count: number }[] = [];
  const acc = new Map<string, { seen: Set<string>; entries: string[] }>();

  const ranges = res.data.valueRanges ?? [];
  dongs.forEach((dongKey, i) => {
    const values = ranges[i]?.values ?? [];
    if (values.length < 2) return; // 헤더뿐이거나 없는 시트
    const header = values[0].map((h) => String(h ?? '').trim());
    const col = (name: string) => header.indexOf(name);
    const [iHo, iCollected, iName, iNote, iPhone] = [
      col('호수'), col('동의서수거여부'), col('성명'), col('비고'), col('연락처'),
    ];
    const cell = (row: unknown[], idx: number) =>
      idx < 0 ? '' : String(row[idx] ?? '').trim();

    const dongNum = dongKey.replace('동', '');
    const body = values.slice(1);
    const countMap: Record<string, number> = {};

    for (const row of body) {
      const ho = cell(row, iHo);
      const note = cell(row, iNote);
      if (!ho) continue;
      // 동의 판정 — getConsentKeyset과 동일
      if (cell(row, iCollected) === 'TRUE' && note !== '삭제') {
        const key = `${dongNum}-${ho}`;
        keys.add(key);
        const name = cell(row, iName);
        if (name) nameMap.set(key, name);
        countMap[ho] = (countMap[ho] || 0) + 1;
      }
    }
    for (const [ho, count] of Object.entries(countMap)) {
      if (count > 1) duplicates.push({ dong: dongKey, ho, count });
    }

    // 연락처 — getPhoneMap과 동일하게 뒤에서부터(최신 우선)
    for (let i2 = body.length - 1; i2 >= 0; i2--) {
      const row = body[i2];
      const ho = cell(row, iHo);
      const phone = normalizePhone(cell(row, iPhone));
      const note = cell(row, iNote);
      if (!ho || !phone) continue;
      if (note === '삭제' || note.includes('중복(이전 응답)')) continue;
      const key = `${dongNum}-${ho}`;
      let d = acc.get(key);
      if (!d) { d = { seen: new Set(), entries: [] }; acc.set(key, d); }
      if (!d.seen.has(phone)) {
        d.seen.add(phone);
        const name = cell(row, iName);
        d.entries.push(name ? `${name} ${phone}` : phone);
      }
    }
  });

  return {
    consent: { keys, nameMap, duplicates },
    phones: new Map([...acc].map(([k, d]) => [k, d.entries.join(' / ')])),
  };
}
