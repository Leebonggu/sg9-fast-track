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

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
