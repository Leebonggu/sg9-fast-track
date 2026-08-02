// web/src/lib/backup.ts
// OWNER_SPREADSHEET_ID 스프레드시트를 매일 복사해 BACKUP_FOLDER_ID에 보관.
// 서비스 계정은 Drive 파일을 소유할 수 없어(id-upload.ts와 동일 제약),
// 실제 복사/정리는 사람 계정으로 배포된 Apps Script 웹앱(SURVEY_WEBAPP_URL)에 위임.

function getWebappUrl(): string {
  const url = process.env.SURVEY_WEBAPP_URL;
  if (!url) throw new Error('환경변수 SURVEY_WEBAPP_URL이 설정되지 않았습니다.');
  return url;
}

function getSecret(): string {
  const s = process.env.ID_UPLOAD_SECRET;
  if (!s) throw new Error('환경변수 ID_UPLOAD_SECRET이 설정되지 않았습니다.');
  return s;
}

// 백업 cron은 UTC 16:00(=KST 01:00)에 돈다. toISOString()은 UTC라 이 시각의 날짜가
// KST 기준으로는 전날이 되어, 백업 파일명이 항상 하루 밀린 채 붙었다. → KST 날짜로 붙인다.
function todayLabel(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export async function backupOwnerSpreadsheet(): Promise<{ fileId: string; name: string }> {
  const sourceId = process.env.OWNER_SPREADSHEET_ID;
  const folderId = process.env.BACKUP_FOLDER_ID;
  if (!sourceId) throw new Error('환경변수 OWNER_SPREADSHEET_ID가 설정되지 않았습니다.');
  if (!folderId) throw new Error('환경변수 BACKUP_FOLDER_ID가 설정되지 않았습니다.');

  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'backupCopy',
      secret: getSecret(),
      sourceId,
      folderId,
      name: `통합현황백업_${todayLabel()}`,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { fileId: data.fileId, name: data.name };
}

export async function cleanupOldBackups(olderThanDays = 30): Promise<{ deletedCount: number }> {
  const folderId = process.env.BACKUP_FOLDER_ID;
  if (!folderId) throw new Error('환경변수 BACKUP_FOLDER_ID가 설정되지 않았습니다.');

  const res = await fetch(getWebappUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'backupCleanup',
      secret: getSecret(),
      folderId,
      olderThanDays,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { deletedCount: data.deletedCount };
}
