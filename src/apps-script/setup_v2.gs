/**
 * 상계주공 9단지 신속통합기획 전자사전 주민동의 시스템 (v2)
 *
 * 사용법:
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드를 전체 붙여넣기
 * 3. setupAll() 함수 선택 후 실행 (▶ 버튼)
 * 4. Google 계정 권한 승인
 * 5. 실행 로그에서 폼 URL과 시트 URL 확인
 *
 * 주의: setupAll()은 최초 1회만 실행하세요.
 *       중복 실행 시 폼/시트가 여러 개 생성됩니다.
 */

// ============================================================
// 설정값
// ============================================================
var CONFIG = {
  FORM_TITLE: '상계주공 9단지 아파트 신속통합기획 추진 사전 전자동의서 v2',
  SHEET_TITLE: '상계주공 9단지 사전 전자동의 관리 v2',
  BUILDINGS: [
    '901동', '902동', '903동', '904동', '905동',
    '906동', '907동', '908동', '909동', '910동',
    '911동', '912동', '913동', '914동', '915동',
    '916동', '917동', '918동', '919동', '920동',
    '921동', '922동', '923동'
  ],
  NOTIFICATION_EMAIL: 'sg9.rebuild@gmail.com',
  // 동별 시트 컬럼 헤더
  BUILDING_HEADERS: [
    '타임스탬프', '성명', '연락처', '호수',
    '주민등록상주소', '사전동의여부', '개인정보동의여부',
    '입력경로', '동의서수거여부', '수거일', '수거자', '비고'
  ],
  // 전체현황 시트 컬럼 헤더
  SUMMARY_HEADERS: ['동', '응답수', '수거완료', '미수거']
};


// ============================================================
// 1. 전체 셋업 (최초 1회 실행)
// ============================================================
function setupAll() {
  Logger.log('=== 상계주공 9단지 전자사전 주민동의 시스템 셋업 시작 ===');

  var form = createForm_();
  Logger.log('폼 생성 완료: ' + form.getEditUrl());
  Logger.log('폼 응답 URL: ' + form.getPublishedUrl());

  var ss = createSpreadsheet_(form);
  Logger.log('시트 생성 완료: ' + ss.getUrl());

  createBuildingSheets_(ss);
  Logger.log('동별 시트 생성 완료');

  createSummarySheet_(ss);
  Logger.log('전체현황 시트 생성 완료');

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('시트 ID 저장 완료: ' + ss.getId());

  createTrigger_(ss);
  Logger.log('트리거 설정 완료');

  deleteDefaultSheet_(ss);

  Logger.log('');
  Logger.log('=== 셋업 완료 ===');
  Logger.log('폼 편집 URL: ' + form.getEditUrl());
  Logger.log('폼 응답 URL (배포용): ' + form.getPublishedUrl());
  Logger.log('시트 URL: ' + ss.getUrl());
}


// ============================================================
// 2. Google Form 생성
// ============================================================
function createForm_() {
  var form = FormApp.create(CONFIG.FORM_TITLE);

  // 폼 설명
  form.setDescription(
    '안녕하세요.\n' +
    '본 동의서는 상계주공 9단지 아파트의 신속통합기획 추진 가능 여부를 검토하기 위해\n' +
    '주민분들의 참여 의사를 확인하는 초기 단계 설문입니다.\n\n' +
    '※ 본 동의는 법적 구속력이 없는 참여 의사 확인입니다.\n' +
    '※ 언제든지 본인의 의사에 따라 철회가 가능합니다.\n\n' +
    '[ 개인정보 수집 및 이용 안내 ]\n\n' +
    '수집 항목: 성명, 연락처, 동/호수\n' +
    '수집 목적: 사전동의 현황 파악 및 향후 안내\n' +
    '보유 기간: 검토 완료 시까지 (이후 파기)\n\n' +
    '※ 개인정보 제공은 자발적이며, 동의하지 않으셔도 불이익은 없습니다.\n' +
    '※ 수집된 정보는 사전동의 현황 파악 목적으로만 사용되며, 검토 완료 후 즉시 파기됩니다.\n' +
    '※ 본 동의는 법적 구속력이 없으며, 향후 정식 절차 진행 시 별도의 서면 동의를 받을 예정입니다.'
  );

  form.setConfirmationMessage(
    '사전동의서가 정상적으로 제출되었습니다.\n\n' +
    '입력하신 연락처로 확인 연락이 갈 수 있으니 참고 부탁드립니다.\n' +
    '향후 정식 서면 동의서 절차가 별도로 안내될 예정입니다.\n\n' +
    '감사합니다.'
  );

  // ── 기본 정보 입력 ──

  // 성명
  var nameItem = form.addTextItem();
  nameItem.setTitle('성명')
    .setRequired(true);

  // 연락처
  var phoneItem = form.addTextItem();
  phoneItem.setTitle('연락처')
    .setHelpText('하이픈(-) 없이 숫자만 입력해주세요.\n예: 01012345678, 0161234567')
    .setRequired(true);
  var phoneValidation = FormApp.createTextValidation()
    .setHelpText('숫자만 입력해주세요. (10~11자리)')
    .requireTextMatchesPattern('^\\d{10,11}$')
    .build();
  phoneItem.setValidation(phoneValidation);

  // 동 선택
  var buildingItem = form.addListItem();
  buildingItem.setTitle('소유 동')
    .setHelpText('소유하고 계신 동을 선택해주세요.')
    .setRequired(true);
  var buildingChoices = CONFIG.BUILDINGS.map(function(b) {
    return buildingItem.createChoice(b);
  });
  buildingItem.setChoices(buildingChoices);

  // 호수
  var unitItem = form.addTextItem();
  unitItem.setTitle('호수')
    .setHelpText('숫자만 입력해주세요. (예: 101, 1504)')
    .setRequired(true);
  var unitValidation = FormApp.createTextValidation()
    .setHelpText('숫자만 입력해주세요. (예: 101, 1504)')
    .requireTextMatchesPattern('^\\d+$')
    .build();
  unitItem.setValidation(unitValidation);

  // 주민등록상주소
  var addressItem = form.addTextItem();
  addressItem.setTitle('주민등록상주소')
    .setHelpText('주민등록상 현재 거주지 주소를 입력해주세요.')
    .setRequired(true);

  // ── 사전동의 여부 ──

  var consentItem = form.addCheckboxItem();
  consentItem.setTitle('신속통합기획 추진 검토를 위한 사전동의')
    .setRequired(true);
  consentItem.setChoiceValues(['신속통합기획 추진 검토에 동의합니다.']);

  // ── 개인정보 수집 및 이용 동의 (체크박스 — 체크해야 제출 가능) ──

  var privacyItem = form.addCheckboxItem();
  privacyItem.setTitle('개인정보 수집 및 이용 동의')
    .setRequired(true);
  privacyItem.setChoiceValues(['개인정보 수집 및 이용에 동의합니다.']);

  return form;
}


// ============================================================
// 3. Google Sheets 생성 및 폼 연결
// ============================================================
function createSpreadsheet_(form) {
  var ss = SpreadsheetApp.create(CONFIG.SHEET_TITLE);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  SpreadsheetApp.flush();
  Utilities.sleep(2000);

  return ss;
}


// ============================================================
// 4. 동별 시트 생성
// ============================================================
function createBuildingSheets_(ss) {
  CONFIG.BUILDINGS.forEach(function(building) {
    var sheet = ss.insertSheet(building);

    var headerRange = sheet.getRange(1, 1, 1, CONFIG.BUILDING_HEADERS.length);
    headerRange.setValues([CONFIG.BUILDING_HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4472C4');
    headerRange.setFontColor('#FFFFFF');

    sheet.setColumnWidth(1, 150);  // 타임스탬프
    sheet.setColumnWidth(2, 80);   // 성명
    sheet.setColumnWidth(3, 130);  // 연락처
    sheet.setColumnWidth(4, 60);   // 호수
    sheet.setColumnWidth(5, 250);  // 주민등록상주소
    sheet.setColumnWidth(6, 120);  // 사전동의여부
    sheet.setColumnWidth(7, 130);  // 개인정보동의여부
    sheet.setColumnWidth(8, 80);   // 입력경로
    sheet.setColumnWidth(9, 120);  // 동의서수거여부
    sheet.setColumnWidth(10, 100); // 수거일
    sheet.setColumnWidth(11, 80);  // 수거자
    sheet.setColumnWidth(12, 150); // 비고

    sheet.setFrozenRows(1);
  });
}


// ============================================================
// 5. 전체현황 시트 생성
// ============================================================
function createSummarySheet_(ss) {
  var sheet = ss.insertSheet('전체현황', 0);

  var headerRange = sheet.getRange(1, 1, 1, CONFIG.SUMMARY_HEADERS.length);
  headerRange.setValues([CONFIG.SUMMARY_HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2F5496');
  headerRange.setFontColor('#FFFFFF');

  for (var i = 0; i < CONFIG.BUILDINGS.length; i++) {
    var row = i + 2;
    var building = CONFIG.BUILDINGS[i];
    var sheetRef = "'" + building + "'";

    sheet.getRange(row, 1).setValue(building);
    // 응답수 (= 동의수)
    sheet.getRange(row, 2).setFormula(
      '=MAX(COUNTA(' + sheetRef + '!A:A)-1, 0)'
    );
    // 수거완료
    sheet.getRange(row, 3).setFormula(
      '=COUNTIF(' + sheetRef + '!I:I, TRUE)'
    );
    // 미수거
    sheet.getRange(row, 4).setFormula(
      '=B' + row + '-C' + row
    );
  }

  // 합계 행
  var totalRow = CONFIG.BUILDINGS.length + 2;
  sheet.getRange(totalRow, 1).setValue('합계');
  sheet.getRange(totalRow, 1).setFontWeight('bold');
  sheet.getRange(totalRow, 2).setFormula('=SUM(B2:B' + (totalRow - 1) + ')');
  sheet.getRange(totalRow, 3).setFormula('=SUM(C2:C' + (totalRow - 1) + ')');
  sheet.getRange(totalRow, 4).setFormula('=SUM(D2:D' + (totalRow - 1) + ')');

  var totalRange = sheet.getRange(totalRow, 1, 1, CONFIG.SUMMARY_HEADERS.length);
  totalRange.setBackground('#D6E4F0');
  totalRange.setFontWeight('bold');

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);

  sheet.setFrozenRows(1);
}


// ============================================================
// 6. 기본 시트 삭제
// ============================================================
function deleteDefaultSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === 'Sheet1' || sheets[i].getName() === '시트1') {
      ss.deleteSheet(sheets[i]);
      break;
    }
  }
}


// ============================================================
// 7. 폼 제출 트리거 생성 (스프레드시트 기반)
// ============================================================
function createTrigger_(ss) {
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
}


// ============================================================
// 8. 폼 응답 처리 (트리거에 의해 자동 실행)
//    e.values 순서: Timestamp, 성명, 연락처, 소유동, 호수, 주민등록상주소, 사전동의여부, 개인정보동의여부
// ============================================================
function onFormSubmit(e) {
  try {
    var ss = e.range.getSheet().getParent();

    var values = e.values;
    var timestamp = new Date(values[0]) || new Date();
    var name = String(values[1] || '');
    var phone = String(values[2] || '');
    var building = String(values[3] || '');
    var unit = String(values[4] || '');
    var address = String(values[5] || '');
    var consent = String(values[6] || '');
    var privacyConsent = String(values[7] || '');

    Logger.log('응답: ' + name + ' / ' + building + ' / ' + unit + '호 / 동의: ' + consent);

    if (!building) {
      Logger.log('동 정보가 없습니다.');
      return;
    }

    var buildingSheet = ss.getSheetByName(building);
    if (!buildingSheet) {
      Logger.log('동별 시트를 찾을 수 없습니다: ' + building);
      return;
    }

    // 중복 체크
    var duplicateInfo = checkDuplicate_(buildingSheet, building, unit);

    // 동별 시트에 데이터 추가
    var newRow = [
      timestamp,      // 타임스탬프
      name,           // 성명
      phone,          // 연락처
      unit,           // 호수
      address,        // 주민등록상주소
      consent,        // 사전동의여부
      privacyConsent, // 개인정보동의여부
      '온라인',       // 입력경로
      false,          // 동의서수거여부
      '',             // 수거일
      '',             // 수거자
      duplicateInfo.isDuplicate ? '중복 응답 (최신)' : '' // 비고
    ];

    buildingSheet.appendRow(newRow);

    var lastRow = buildingSheet.getLastRow();

    // 글자색을 검정으로 설정 (헤더의 흰색 상속 방지)
    buildingSheet.getRange(lastRow, 1, 1, newRow.length)
      .setFontColor('#000000')
      .setBackground('#FFFFFF');

    // 동의서수거여부 열에 체크박스 삽입
    var checkboxCol = CONFIG.BUILDING_HEADERS.indexOf('동의서수거여부') + 1;
    buildingSheet.getRange(lastRow, checkboxCol).insertCheckboxes();

    // 중복인 경우 이전 행 표시
    if (duplicateInfo.isDuplicate) {
      markDuplicateRow_(buildingSheet, duplicateInfo.rowIndex);
    }

    // 이메일 알림 발송
    sendNotification_(name, building, unit, consent, timestamp, duplicateInfo.isDuplicate);

    // 마스터 그리드 업데이트
    try { onFormSubmitGrid(e); } catch(gridErr) { Logger.log('그리드 업데이트 실패: ' + gridErr); }

    Logger.log('처리 완료: ' + building + ' ' + unit + '호 - ' + name);

  } catch (error) {
    Logger.log('오류 발생: ' + error.toString());
    Logger.log('이벤트 객체: ' + JSON.stringify(e));
  }
}


// ============================================================
// 트리거 정리: 중복 트리거를 삭제하고 1개만 남김
// ============================================================
function cleanupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('현재 트리거 수: ' + triggers.length);

  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log('모든 트리거 삭제 완료');

  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    var ss = SpreadsheetApp.openById(ssId);
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
    Logger.log('트리거 1개 재생성 완료');
  } else {
    Logger.log('스프레드시트 ID를 찾을 수 없습니다.');
  }
}


// ============================================================
// 디버그: 현재 상태 확인 + 수동 동기화
// ============================================================
function debugAndSync() {
  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('스프레드시트를 찾을 수 없습니다.');
    return;
  }
  Logger.log('스프레드시트: ' + ss.getName() + ' (' + ss.getId() + ')');

  var sheets = ss.getSheets();
  Logger.log('시트 목록:');
  sheets.forEach(function(s) {
    Logger.log('   - ' + s.getName() + ' (행: ' + s.getLastRow() + ')');
  });

  // 폼 응답 시트 찾기
  var responseSheet = null;
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    if (sheetName !== '전체현황' && CONFIG.BUILDINGS.indexOf(sheetName) === -1) {
      responseSheet = sheets[i];
      break;
    }
  }

  if (!responseSheet) {
    Logger.log('폼 응답 시트를 찾을 수 없습니다.');
    return;
  }
  Logger.log('폼 응답 시트: ' + responseSheet.getName());

  var headers = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getValues()[0];
  Logger.log('폼 응답 시트 헤더: ' + JSON.stringify(headers));

  var lastRow = responseSheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('폼 응답 데이터가 없습니다.');
    return;
  }
  Logger.log('폼 응답 데이터 ' + (lastRow - 1) + '건');

  // 기존 데이터를 동별 시트로 수동 동기화
  var syncCount = 0;
  for (var r = 2; r <= lastRow; r++) {
    var rowData = responseSheet.getRange(r, 1, 1, responseSheet.getLastColumn()).getValues()[0];
    var data = {};
    for (var c = 0; c < headers.length; c++) {
      data[headers[c]] = rowData[c];
    }

    Logger.log('   행 ' + r + ': ' + JSON.stringify(data));

    var building = data['소유 동'] || data['동'] || '';
    if (!building) {
      Logger.log('   행 ' + r + ': 동 정보 없음');
      continue;
    }

    var buildingSheet = ss.getSheetByName(building);
    if (!buildingSheet) {
      Logger.log('   행 ' + r + ': ' + building + ' 시트 없음');
      continue;
    }

    var timestamp = data['타임스탬프'] || data['Timestamp'] || '';
    var name = data['성명'] || '';
    var phone = data['연락처'] || '';
    var unit = data['호수'] || '';
    var address = data['주민등록상주소'] || '';
    var consent = data['신속통합기획 추진 검토를 위한 사전동의에 참여하시겠습니까?'] || '';
    var privacyConsent = data['개인정보 수집 및 이용에 동의하십니까?'] || '';

    var newRow = [
      timestamp, name, phone, unit, address, consent, privacyConsent,
      '온라인', false, '', '', ''
    ];

    buildingSheet.appendRow(newRow);

    var syncLastRow = buildingSheet.getLastRow();
    buildingSheet.getRange(syncLastRow, 1, 1, newRow.length)
      .setFontColor('#000000')
      .setBackground('#FFFFFF');

    var checkboxCol = CONFIG.BUILDING_HEADERS.indexOf('동의서수거여부') + 1;
    buildingSheet.getRange(syncLastRow, checkboxCol).insertCheckboxes();
    syncCount++;
    Logger.log('   ' + building + ' ' + unit + '호 동기화 완료');
  }

  Logger.log('');
  Logger.log('=== 동기화 완료: ' + syncCount + '건 ===');

  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('등록된 트리거: ' + triggers.length + '개');
  triggers.forEach(function(t) {
    Logger.log('   - ' + t.getHandlerFunction() + ' / ' + t.getEventType());
  });
}


// ============================================================
// 연결된 스프레드시트 찾기
// ============================================================
function getLinkedSpreadsheet_() {
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    return SpreadsheetApp.openById(ssId);
  }
  var files = DriveApp.getFilesByName(CONFIG.SHEET_TITLE);
  while (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }
  return null;
}


// ============================================================
// 중복 제출 감지
// ============================================================
function checkDuplicate_(sheet, building, unit) {
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    var existingUnit = String(data[i][3]);
    var note = String(data[i][11]); // 비고

    if (existingUnit === String(unit) && note !== '중복(이전 응답)') {
      return { isDuplicate: true, rowIndex: i + 1 };
    }
  }

  return { isDuplicate: false, rowIndex: -1 };
}


// ============================================================
// 중복 행 표시
// ============================================================
function markDuplicateRow_(sheet, rowIndex) {
  var lastCol = CONFIG.BUILDING_HEADERS.length;
  var range = sheet.getRange(rowIndex, 1, 1, lastCol);
  range.setBackground('#D9D9D9');

  var noteCol = CONFIG.BUILDING_HEADERS.indexOf('비고') + 1;
  sheet.getRange(rowIndex, noteCol).setValue('중복(이전 응답)');
}


// ============================================================
// 이메일 알림 발송
// ============================================================
function sendNotification_(name, building, unit, consent, timestamp, isDuplicate) {
  if (CONFIG.NOTIFICATION_EMAIL === 'your-email@gmail.com') {
    Logger.log('알림 이메일이 설정되지 않았습니다.');
    return;
  }

  var unitDisplay = String(unit).replace(/호$/, '') + '호';
  var subject = '[주민동의] ' + building + ' ' + unitDisplay + ' - ' + name;
  if (isDuplicate) {
    subject = '[주민동의-중복] ' + building + ' ' + unitDisplay + ' - ' + name;
  }

  var body = '새로운 주민동의 응답이 제출되었습니다.\n\n' +
    '성명: ' + name + '\n' +
    '동: ' + building + '\n' +
    '호수: ' + unit + '\n' +
    '사전동의: ' + consent + '\n' +
    '제출시각: ' + (timestamp instanceof Date ? Utilities.formatDate(timestamp, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(timestamp)) + '\n';

  if (isDuplicate) {
    body += '\n동일 동/호수로 이전 응답이 존재합니다. 확인이 필요합니다.\n';
  }

  MailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, subject, body);
}
