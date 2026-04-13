/**
 * 설문지 PDF 생성 웹앱
 *
 * 사용법:
 * 1. Apps Script에 이 코드 추가
 * 2. 배포 → 웹앱 → "나(본인)" 으로 실행, "모든 사용자" 접근 허용
 * 3. 배포된 URL을 .env.local의 SURVEY_WEBAPP_URL에 설정
 *
 * 엔드포인트:
 *   POST { mode: "blank" }  → 빈 설문지 PDF 생성
 *   POST { mode: "single", dong, ho, name, phone, answers }  → 체크된 설문지 PDF 생성
 */

var TEMPLATE_DOC_ID = '1QGWn6SYGdx01Qyq-DalUchKW3BwgF0lVGQ2dCOttvd0';
var TEMPLATE_FOLDER_ID = '1UdJbtCDGQrIYcZ7CkigWBMqaAx7u3T5X';
var PDF_FOLDER_ID = '1hZARwBA0_LF47mOsHC9way1ebYq2Muka';

// 질문 설정 (survey-config.ts와 동일)
var QUESTIONS = [
  { id: 'Q2', options: ['매우 필요', '필요', '보통', '불필요'] },
  { id: 'Q3', options: ['빠른 추진이 필요하다', '현 상태 유지도 괜찮다', '잘 모르겠다'] },
  { id: 'Q4', options: ['적극 찬성', '조건부 찬성', '반대', '잘 모르겠다'] },
  { id: 'Q5', options: ['사업 속도', '수익성', '안정성', '주거환경 개선'] },
  { id: 'Q6', options: ['적극 참여', '상황 보고 참여', '참여하지 않음'] },
  { id: 'Q7', options: ['조합방식 선호', '신탁방식 선호', '잘 모르겠다'] },
  { id: 'Q8', options: ['20평대', '30평대', '40평대 이상', '잘 모르겠다'] }
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result;

    if (data.mode === 'blank') {
      result = generateBlankPdf();
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

function doGet(e) {
  return jsonResponse({ status: 'ok', message: '설문지 PDF 생성 웹앱' });
}

/**
 * 빈 설문지 PDF 생성
 */
function generateBlankPdf() {
  var copy = DriveApp.getFileById(TEMPLATE_DOC_ID).makeCopy('설문지_빈양식', DriveApp.getFolderById(TEMPLATE_FOLDER_ID));
  var copiedDocId = copy.getId();

  try {
    var doc = DocumentApp.openById(copiedDocId);
    var body = doc.getBody();

    // 기본정보 → 밑줄
    body.replaceText('\\{\\{동\\}\\}', '______');
    body.replaceText('\\{\\{호\\}\\}', '______');
    body.replaceText('\\{\\{성명\\}\\}', '________________');
    body.replaceText('\\{\\{연락처\\}\\}', '________________');

    // 모든 선택지 태그 제거
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      for (var j = 0; j < q.options.length; j++) {
        var tag = '\\{\\{' + q.id + '_' + escapeRegex(q.options[j]) + '\\}\\}';
        body.replaceText('☐' + tag, '☐');
      }
    }

    doc.saveAndClose();

    // PDF 변환
    var pdfBlob = copy.getAs('application/pdf');
    pdfBlob.setName('설문지_빈양식.pdf');
    var pdfFile = DriveApp.getFolderById(TEMPLATE_FOLDER_ID).createFile(pdfBlob);

    var pdfLink = pdfFile.getUrl();

    return { success: true, link: pdfLink };
  } finally {
    // 임시 복사본 삭제
    DriveApp.getFileById(copiedDocId).setTrashed(true);
  }
}

/**
 * 응답 기반 체크된 설문지 PDF 생성
 */
function generateCheckedPdf(data) {
  var dong = data.dong || '';
  var ho = data.ho || '';
  var name = data.name || '';
  var phone = data.phone || '';
  var answers = data.answers || {};

  var fileName = '설문지_' + dong + '_' + ho + '호_' + name;
  var copy = DriveApp.getFileById(TEMPLATE_DOC_ID).makeCopy(fileName, DriveApp.getFolderById(PDF_FOLDER_ID));
  var copiedDocId = copy.getId();

  try {
    var doc = DocumentApp.openById(copiedDocId);
    var body = doc.getBody();

    // 기본정보 치환
    body.replaceText('\\{\\{동\\}\\}', dong.replace('동', ''));
    body.replaceText('\\{\\{호\\}\\}', ho);
    body.replaceText('\\{\\{성명\\}\\}', name);
    body.replaceText('\\{\\{연락처\\}\\}', phone);

    // Q2~Q8 선택지 치환
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      var selected = answers[q.id] || '';
      for (var j = 0; j < q.options.length; j++) {
        var tag = '\\{\\{' + q.id + '_' + escapeRegex(q.options[j]) + '\\}\\}';
        if (q.options[j] === selected) {
          body.replaceText('☐' + tag, '☑');
        } else {
          body.replaceText('☐' + tag, '☐');
        }
      }
    }

    doc.saveAndClose();

    // PDF 변환
    var pdfBlob = copy.getAs('application/pdf');
    pdfBlob.setName(fileName + '.pdf');
    var pdfFile = DriveApp.getFolderById(PDF_FOLDER_ID).createFile(pdfBlob);

    var pdfLink = pdfFile.getUrl();

    return { success: true, link: pdfLink };
  } finally {
    // 임시 복사본 삭제
    DriveApp.getFileById(copiedDocId).setTrashed(true);
  }
}

// ============================================================
// 배치: 10분 트리거용 — 미생성 응답 자동 PDF 생성
// ============================================================

var SURVEY_SHEET_ID = '1pKcRb1lLfZvKQXyzfwrquEeiADERPQBkVSHfuoSFC9Q';

// 시트 컬럼 매핑 (폼 응답 시트 기준)
var COL = {
  TIMESTAMP: 0,   // A: 타임스탬프
  DONG: 1,        // B: 동
  HO: 2,          // C: 호
  NAME: 3,        // D: 성명
  PHONE: 4,       // E: 연락처
  Q2: 5,          // F: 재건축 필요성
  Q3: 6,          // G: 현재 상황에 대한 인식
  Q4: 7,          // H: 재건축 추진 의향
  Q5: 8,          // I: 추진 시 가장 중요한 요소
  Q6: 9,          // J: 향후 추진 시 참여 의향
  Q7: 10,         // K: 추진 방식 비교
  Q8: 11,         // L: 재건축 시 선호 평형
  PDF_DONE: 12,   // M: PDF생성여부
  PDF_LINK: 13    // N: PDF링크
};

/**
 * 10분마다 실행: 미생성 응답에 대해 PDF 생성
 * Apps Script 트리거에서 이 함수를 시간 기반 트리거로 등록
 */
function batchGeneratePdfs() {
  var ss = SpreadsheetApp.openById(SURVEY_SHEET_ID);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  var generated = 0;
  var BATCH_LIMIT = 50; // 6분 제한 안전선

  // 1행은 헤더, 2행부터 데이터
  for (var i = 1; i < data.length; i++) {
    if (generated >= BATCH_LIMIT) {
      Logger.log('배치 한도 ' + BATCH_LIMIT + '건 도달, 나머지는 다음 배치에서 처리');
      break;
    }
    var row = data[i];

    // 이미 생성된 건 스킵
    if (String(row[COL.PDF_DONE]).toUpperCase() === 'TRUE') continue;

    // 데이터 없는 행 스킵
    if (!row[COL.DONG] || !row[COL.NAME]) continue;

    try {
      var answers = {};
      answers['Q2'] = String(row[COL.Q2] || '');
      answers['Q3'] = String(row[COL.Q3] || '');
      answers['Q4'] = String(row[COL.Q4] || '');
      answers['Q5'] = String(row[COL.Q5] || '');
      answers['Q6'] = String(row[COL.Q6] || '');
      answers['Q7'] = String(row[COL.Q7] || '');
      answers['Q8'] = String(row[COL.Q8] || '');

      var result = generateCheckedPdf({
        dong: String(row[COL.DONG]),
        ho: String(row[COL.HO]),
        name: String(row[COL.NAME]),
        phone: String(row[COL.PHONE]),
        answers: answers
      });

      if (result.success) {
        // 시트에 완료 표시 (i+1 = 시트 행번호, 1-based)
        sheet.getRange(i + 1, COL.PDF_DONE + 1).setValue('TRUE');
        sheet.getRange(i + 1, COL.PDF_LINK + 1).setValue(result.link);
        generated++;
      }
    } catch (e) {
      Logger.log('행 ' + (i + 1) + ' 실패: ' + e.message);
    }
  }

  Logger.log('배치 완료: ' + generated + '건 생성');
}

/**
 * 10분 트리거 자동 설정
 * 최초 1회 실행하면 10분마다 batchGeneratePdfs 실행됨
 */
function setupBatchTrigger() {
  // 기존 트리거 제거
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'batchGeneratePdfs') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 10분 간격 트리거 설정
  ScriptApp.newTrigger('batchGeneratePdfs')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('10분 배치 트리거 설정 완료');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
