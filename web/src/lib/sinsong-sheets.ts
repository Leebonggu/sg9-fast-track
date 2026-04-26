// web/src/lib/sinsong-sheets.ts
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';
import { BUILDING_CONFIG } from './buildings';

let sinsongDocCache: GoogleSpreadsheet | null = null;

async function getSinsongDoc(): Promise<GoogleSpreadsheet> {
  if (sinsongDocCache) return sinsongDocCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.SINSONG_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  sinsongDocCache = doc;
  return doc;
}

// 신통기획접수 완료 세대 키셋 반환: Set<"901-101">
// 시트명: "901동", 호수 컬럼: "호수"
export async function getSinsongKeyset(): Promise<Set<string>> {
  const doc = await getSinsongDoc();
  const dongs = Object.keys(BUILDING_CONFIG); // ["901동", "902동", ...]
  const result = new Set<string>();

  for (const dongKey of dongs) {
    const dongNum = dongKey.replace('동', ''); // "901동" → "901"
    const sheet = doc.sheetsByTitle[dongKey];
    if (!sheet) continue;
    const rows = await sheet.getRows();
    for (const row of rows) {
      const ho = String(row.get('호수') || '').trim();
      if (ho) result.add(`${dongNum}-${ho}`);
    }
  }

  return result;
}
