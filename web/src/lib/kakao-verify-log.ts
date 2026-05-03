import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from './google-auth';

const LOG_SHEET_TITLE = '카카오인증로그';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 5;

let logDocCache: GoogleSpreadsheet | null = null;

async function getLogDoc(): Promise<GoogleSpreadsheet> {
  if (logDocCache) return logDocCache;
  const auth = getServiceAccountAuth();
  const doc = new GoogleSpreadsheet(process.env.OWNER_SPREADSHEET_ID!, auth);
  await doc.loadInfo();
  logDocCache = doc;
  return doc;
}

async function ensureLogSheet(doc: GoogleSpreadsheet) {
  let sheet = doc.sheetsByTitle[LOG_SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: LOG_SHEET_TITLE,
      headerValues: ['타임스탬프', '동', '호수', '이름', '결과', 'IP'],
    });
  }
  return sheet;
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const doc = await getLogDoc();
    const sheet = doc.sheetsByTitle[LOG_SHEET_TITLE];
    if (!sheet) return false;

    const rows = await sheet.getRows();
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;

    const recentFailures = rows.filter((row) => {
      if (String(row.get('결과') || '') !== '실패') return false;
      if (String(row.get('IP') || '') !== ip) return false;
      const ts = new Date(String(row.get('타임스탬프') || '')).getTime();
      return !isNaN(ts) && ts > cutoff;
    });

    return recentFailures.length >= RATE_LIMIT_MAX_FAILURES;
  } catch {
    return false;
  }
}

export async function appendVerifyLog(
  dong: string,
  ho: string,
  name: string,
  result: '성공' | '실패' | '어드민발급',
  ip: string,
): Promise<void> {
  try {
    const doc = await getLogDoc();
    const sheet = await ensureLogSheet(doc);
    await sheet.addRow({
      타임스탬프: new Date().toISOString(),
      동: dong,
      호수: ho,
      이름: name,
      결과: result,
      IP: ip,
    });
  } catch (e) {
    console.error('[kakao-verify-log] 로그 기록 실패:', e);
  }
}

export interface VerifyLogRow {
  timestamp: string;
  dong: string;
  ho: string;
  name: string;
  result: string;
  ip: string;
}

export async function getVerifyLogs(): Promise<VerifyLogRow[]> {
  const doc = await getLogDoc();
  const sheet = doc.sheetsByTitle[LOG_SHEET_TITLE];
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows
    .map((row) => ({
      timestamp: String(row.get('타임스탬프') || ''),
      dong: String(row.get('동') || ''),
      ho: String(row.get('호수') || ''),
      name: String(row.get('이름') || ''),
      result: String(row.get('결과') || ''),
      ip: String(row.get('IP') || ''),
    }))
    .reverse();
}
