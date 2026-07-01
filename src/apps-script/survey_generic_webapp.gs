/**
 * 범용 설문지 PDF 생성 웹앱
 *
 * 모든 설문에서 공유하는 단일 웹앱.
 * 설문별 정보(템플릿, 폴더, 질문, 응답)는 POST body로 전달받음.
 *
 * 배포:
 * 1. Apps Script에 이 코드 추가
 * 2. 배포 → 웹앱 → "나(본인)" 으로 실행, "모든 사용자" 접근 허용
 * 3. 배포된 URL을 .env.local의 SURVEY_WEBAPP_URL에 설정
 *
 * POST body 구조:
 * {
 *   mode: "single" | "blank",
 *   templateDocId: "Google Docs 템플릿 ID",
 *   pdfFolderId: "PDF 저장 Drive 폴더 ID",
 *   basicInfoFields: [{ key: "dong", sheetColumn: "동" }, ...],
 *   basicInfo: { dong: "901동", ho: "101", name: "홍길동", ... },  // single 모드
 *   questions: [{ id: "Q1", options: ["옵션1", "옵션2"] }],
 *   answers: { Q1: "옵션1", ... }  // single 모드
 * }
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── 신분증 사본 업로드/삭제/조회 (PDF 생성과 별개 분기) ──
    if (data.mode === 'idUpload' || data.mode === 'idDelete' || data.mode === 'idFetch') {
      return jsonResponse(handleIdMode(data));
    }

    // ── 스프레드시트 백업 복사/오래된 백업 정리 (PDF 생성과 별개 분기) ──
    if (data.mode === 'backupCopy' || data.mode === 'backupCleanup') {
      return jsonResponse(handleBackupMode(data));
    }

    if (!data.templateDocId) {
      return jsonResponse({ error: 'templateDocId가 필요합니다.' });
    }
    if (!data.pdfFolderId) {
      return jsonResponse({ error: 'pdfFolderId가 필요합니다.' });
    }

    var result;

    if (data.mode === 'blank') {
      result = generateBlankPdf(data);
    } else if (data.mode === 'single') {
      result = generateCheckedPdf(data);
    } else {
      return jsonResponse({ error: 'mode는 blank 또는 single이어야 합니다.' });
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet() {
  return jsonResponse({ status: 'ok', message: '범용 설문지 PDF 생성 웹앱' });
}

/**
 * 빈 설문지 PDF 생성
 */
function generateBlankPdf(data) {
  var templateDocId = data.templateDocId;
  var pdfFolderId = data.pdfFolderId;
  var basicInfoFields = data.basicInfoFields || [];
  var questions = data.questions || [];

  var copy = DriveApp.getFileById(templateDocId).makeCopy(
    '설문지_빈양식',
    DriveApp.getFolderById(pdfFolderId)
  );
  var copiedDocId = copy.getId();

  try {
    var doc = DocumentApp.openById(copiedDocId);
    var body = doc.getBody();

    // 기본정보 → 밑줄
    for (var i = 0; i < basicInfoFields.length; i++) {
      var field = basicInfoFields[i];
      var tag = '\\{\\{' + escapeRegex(field.key) + '\\}\\}';
      body.replaceText(tag, '________________');
    }

    // 모든 선택지 태그 제거 (☐만 남기기)
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var options = q.options || [];
      for (var j = 0; j < options.length; j++) {
        var optionTag = '\\{\\{' + escapeRegex(q.id) + '_' + escapeRegex(options[j]) + '\\}\\}';
        body.replaceText('☐' + optionTag, '☐');
      }
    }

    doc.saveAndClose();

    // PDF 변환
    var pdfBlob = copy.getAs('application/pdf');
    pdfBlob.setName('설문지_빈양식.pdf');
    var pdfFile = DriveApp.getFolderById(pdfFolderId).createFile(pdfBlob);

    return { success: true, link: pdfFile.getUrl() };
  } finally {
    DriveApp.getFileById(copiedDocId).setTrashed(true);
  }
}

/**
 * 응답 기반 체크된 설문지 PDF 생성
 */
function generateCheckedPdf(data) {
  var templateDocId = data.templateDocId;
  var pdfFolderId = data.pdfFolderId;
  var basicInfoFields = data.basicInfoFields || [];
  var basicInfo = data.basicInfo || {};
  var questions = data.questions || [];
  var answers = data.answers || {};

  // 파일명 생성: 동_호호_성명
  var dong = basicInfo.dong || '';
  var ho = basicInfo.ho || '';
  var name = basicInfo.name || '';
  var fileName = '설문지_' + dong + '_' + ho + '호_' + name;

  var copy = DriveApp.getFileById(templateDocId).makeCopy(
    fileName,
    DriveApp.getFolderById(pdfFolderId)
  );
  var copiedDocId = copy.getId();

  try {
    var doc = DocumentApp.openById(copiedDocId);
    var body = doc.getBody();

    // 기본정보 치환
    for (var i = 0; i < basicInfoFields.length; i++) {
      var field = basicInfoFields[i];
      var value = basicInfo[field.key] || '';
      var tag = '\\{\\{' + escapeRegex(field.key) + '\\}\\}';
      body.replaceText(tag, value);
    }

    // 질문 선택지 치환
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var selected = answers[q.id] || '';
      var options = q.options || [];
      for (var j = 0; j < options.length; j++) {
        var optionTag = '\\{\\{' + escapeRegex(q.id) + '_' + escapeRegex(options[j]) + '\\}\\}';
        if (options[j] === selected) {
          body.replaceText('☐' + optionTag, '☑');
        } else {
          body.replaceText('☐' + optionTag, '☐');
        }
      }
    }

    doc.saveAndClose();

    // PDF 변환
    var pdfBlob = copy.getAs('application/pdf');
    pdfBlob.setName(fileName + '.pdf');
    var pdfFile = DriveApp.getFolderById(pdfFolderId).createFile(pdfBlob);

    return { success: true, link: pdfFile.getUrl() };
  } finally {
    DriveApp.getFileById(copiedDocId).setTrashed(true);
  }
}

// ============================================================
// 신분증 사본 업로드/삭제/조회
//   - 비공개 폴더에 파일 저장 (별도 공유 설정 안 함 → 폴더 권한 그대로)
//   - 공유 secret(ID_UPLOAD_SECRET) 검증으로 무단 호출 차단
//   배포 전 1회: setIdUploadSecret('웹.env와_동일한_값') 실행
// ============================================================
function setIdUploadSecret(secret) {
  PropertiesService.getScriptProperties().setProperty('ID_UPLOAD_SECRET', secret);
  Logger.log('신분증 업로드 secret 설정 완료');
}

function checkIdSecret(data) {
  var stored = PropertiesService.getScriptProperties().getProperty('ID_UPLOAD_SECRET');
  return !!stored && data.secret === stored;
}

function handleIdMode(data) {
  if (!checkIdSecret(data)) {
    return { error: '인증 실패(secret 불일치)' };
  }

  if (data.mode === 'idUpload') {
    if (!data.folderId) return { error: 'folderId가 필요합니다.' };
    if (!data.base64) return { error: 'base64가 필요합니다.' };
    var bytes = Utilities.base64Decode(data.base64);
    var blob = Utilities.newBlob(bytes, data.mimeType || 'image/jpeg', data.fileName || 'id.jpg');
    var file = DriveApp.getFolderById(data.folderId).createFile(blob);
    return { success: true, fileId: file.getId(), link: file.getUrl() };
  }

  if (data.mode === 'idDelete') {
    if (!data.fileId) return { error: 'fileId가 필요합니다.' };
    DriveApp.getFileById(data.fileId).setTrashed(true);
    return { success: true };
  }

  if (data.mode === 'idFetch') {
    if (!data.fileId) return { error: 'fileId가 필요합니다.' };
    var f = DriveApp.getFileById(data.fileId);
    var b = f.getBlob();
    return {
      success: true,
      mimeType: b.getContentType(),
      base64: Utilities.base64Encode(b.getBytes())
    };
  }

  return { error: 'unknown id mode' };
}

// secret 검사는 idUpload와 동일한 ID_UPLOAD_SECRET 공유값을 재사용 (웹앱 전체 공용 인증값)
function handleBackupMode(data) {
  if (!checkIdSecret(data)) {
    return { error: '인증 실패(secret 불일치)' };
  }

  if (data.mode === 'backupCopy') {
    if (!data.sourceId) return { error: 'sourceId가 필요합니다.' };
    if (!data.folderId) return { error: 'folderId가 필요합니다.' };
    var name = data.name || ('백업_' + new Date().toISOString());
    var copy = DriveApp.getFileById(data.sourceId).makeCopy(
      name,
      DriveApp.getFolderById(data.folderId)
    );
    return { success: true, fileId: copy.getId(), name: name };
  }

  if (data.mode === 'backupCleanup') {
    if (!data.folderId) return { error: 'folderId가 필요합니다.' };
    var olderThanDays = data.olderThanDays || 30;
    var cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    var files = DriveApp.getFolderById(data.folderId).getFiles();
    var deletedCount = 0;
    while (files.hasNext()) {
      var file = files.next();
      if (file.getDateCreated() < cutoff) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    return { success: true, deletedCount: deletedCount };
  }

  return { error: 'unknown backup mode' };
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
